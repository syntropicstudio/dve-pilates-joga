-- DVĚ – pgTAP: atomické rezervace, obsazenost, expirace, změny stavu
-- Souběh skutečných paralelních transakcí testuje supabase/tests/concurrency/last_spot.sh.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

-- ---------------------------------------------------------------- data
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'admin@example.com');
insert into public.admin_profiles (id, email, display_name)
values ('00000000-0000-0000-0000-0000000000a1', 'admin@example.com', 'Admin');

insert into public.events (id, slug, title, category, start_at, end_at, time_label, price, capacity, status) values
  ('00000000-0000-0000-0000-00000000e001', 'mala-akce', 'Malá akce', 'pilates',
   now() + interval '10 days', now() + interval '10 days 1 hour', '18:00–19:00', 260, 3, 'published'),
  ('00000000-0000-0000-0000-00000000e002', 'koncept', 'Koncept', 'joga',
   now() + interval '10 days', now() + interval '10 days 1 hour', '9:00–10:00', 100, 5, 'draft'),
  ('00000000-0000-0000-0000-00000000e003', 'probehla', 'Proběhlá', 'joga',
   now() - interval '2 days', now() - interval '2 days' + interval '1 hour', '9:00–10:00', 100, 5, 'published');

-- Výsledky volání si ukládáme do dočasné tabulky (přístupné i pro service_role).
create temp table r (name text primary key, result jsonb);
grant all on r to service_role, authenticated;

-- ---------------------------------------------------------------- create_reservation (backend)
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into r select 'a', public.create_reservation('00000000-0000-0000-0000-00000000e001', '  Jana Nováková ', 'JANA@Example.com', '+420 123  456 789', 2, 'Poprvé');
select is((select result ->> 'ok' from r where name = 'a'), 'true', 'vytvoření rezervace na 2 místa');
select is((select result #>> '{reservation,reservation_status}' from r where name = 'a'), 'pending_payment', 'nová rezervace čeká na platbu');
select is((select result #>> '{reservation,payment_status}' from r where name = 'a'), 'unpaid', 'nová rezervace je nezaplacená');
select is((select (result ->> 'available_spots')::int from r where name = 'a'), 1, 'zbývá 1 místo');
select ok(
  (select (result #>> '{reservation,expires_at}')::timestamptz between now() + interval '47 hours' and now() + interval '49 hours' from r where name = 'a'),
  'expirace je explicitně nastavená (~48 h)');
select is(
  (select customer_email || '|' || customer_phone || '|' || customer_name from public.reservations where id = (select (result #>> '{reservation,id}')::uuid from r where name = 'a')),
  'jana@example.com|+420 123 456 789|Jana Nováková', 'vstupy jsou normalizované');

insert into r select 'b', public.create_reservation('00000000-0000-0000-0000-00000000e001', 'Petr Dvořák', 'petr@example.com', '123456789', 2);
select is((select result ->> 'code' from r where name = 'b'), 'not_enough_spots', 'víc míst než zbývá → not_enough_spots');
select is((select (result ->> 'available_spots')::int from r where name = 'b'), 1, 'chyba vrací počet volných míst');

insert into r select 'c', public.create_reservation('00000000-0000-0000-0000-00000000e001', 'Eva Malá', 'eva@example.com', '123456789', 1);
select is((select result ->> 'ok' from r where name = 'c'), 'true', 'poslední místo lze rezervovat');

insert into r select 'd', public.create_reservation('00000000-0000-0000-0000-00000000e001', 'Ota Pozdní', 'ota@example.com', '123456789', 1);
select is((select result ->> 'code' from r where name = 'd'), 'sold_out', 'plná akce → sold_out');

select is(
  (public.create_reservation('00000000-0000-0000-0000-00000000e001', 'Jana Nováková', 'neni-email', '123456789', 1)) ->> 'field',
  'customer_email', 'neplatný e-mail → invalid_input');
select is(
  (public.create_reservation('00000000-0000-0000-0000-00000000e001', 'Jana Nováková', 'a@b.cz', '123456789', 21)) ->> 'field',
  'number_of_spots', 'víc než 20 míst → invalid_input');
select is(
  (public.create_reservation('00000000-0000-0000-0000-00000000e001', 'Jana Nováková', 'a@b.cz', '123456789', 1, null, interval '30 days')) ->> 'field',
  'hold', 'nepřiměřená lhůta na zaplacení → invalid_input');
select is(
  (public.create_reservation('00000000-0000-0000-0000-00000000e002', 'Jana Nováková', 'a@b.cz', '123456789', 1)) ->> 'code',
  'event_not_found', 'nepublikovaná akce → event_not_found');
select is(
  (public.create_reservation('00000000-0000-0000-0000-00000000e003', 'Jana Nováková', 'a@b.cz', '123456789', 1)) ->> 'code',
  'event_not_bookable', 'proběhlá akce → event_not_bookable');

-- Obejití funkce přímým INSERTem (i jako service_role) invariant nepřekoná.
select throws_ok(
  $$insert into public.reservations (event_id, customer_name, customer_email, customer_phone, number_of_spots, expires_at)
    values ('00000000-0000-0000-0000-00000000e001', 'Přímý Zápis', 'primy@example.com', '123456789', 1, now() + interval '1 day')$$,
  'P0001', 'not_enough_spots', 'přímý INSERT nad kapacitu zablokuje trigger');
select throws_ok(
  $$update public.reservations set number_of_spots = 3
     where id = (select (result #>> '{reservation,id}')::uuid from r where name = 'c')$$,
  'P0001', 'not_enough_spots', 'zvýšení počtu míst nad kapacitu zablokuje trigger');
reset role;

-- ---------------------------------------------------------------- změny stavu (administrátorka)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select is(
  (public.set_reservation_status((select (result #>> '{reservation,id}')::uuid from r where name = 'a'), 'confirmed')) ->> 'ok',
  'true', 'potvrzení čekající rezervace na plné akci projde (obsazenost neroste)');
select is(
  (public.set_reservation_status((select (result #>> '{reservation,id}')::uuid from r where name = 'c'), 'cancelled')) ->> 'ok',
  'true', 'zrušení rezervace');
select is((select available_spots from public.get_public_event('mala-akce')), 1, 'zrušení uvolní místo');
reset role;

-- Mezitím někdo obsadí uvolněné místo (backend).
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into r select 'e', public.create_reservation('00000000-0000-0000-0000-00000000e001', 'Iva Rychlá', 'iva@example.com', '123456789', 1);
select is((select result ->> 'ok' from r where name = 'e'), 'true', 'uvolněné místo lze znovu rezervovat');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is(
  (public.set_reservation_status((select (result #>> '{reservation,id}')::uuid from r where name = 'c'), 'confirmed')) ->> 'code',
  'not_enough_spots', 'opětovné potvrzení zrušené rezervace na plné akci je odmítnuto');
select is(
  (public.set_reservation_status('00000000-0000-0000-0000-000000000000', 'confirmed')) ->> 'code',
  'not_found', 'neexistující rezervace → not_found');
reset role;

-- ---------------------------------------------------------------- expirace pending_payment
-- Simulace uplynutí lhůty: rezervaci „e“ posuneme expiraci do minulosti (jako postgres).
update public.reservations set expires_at = now() - interval '1 minute'
 where id = (select (result #>> '{reservation,id}')::uuid from r where name = 'e');
select is((select available_spots from public.get_public_event('mala-akce')), 1, 'prošlá pending rezervace už neblokuje kapacitu');
select is(private.expire_pending_reservations(), 1, 'plánovaná úloha označí 1 rezervaci jako expirovanou');
select is(
  (select reservation_status::text from public.reservations where id = (select (result #>> '{reservation,id}')::uuid from r where name = 'e')),
  'expired', 'rezervace je ve stavu expired');

-- ---------------------------------------------------------------- kapacita a stav akce
select throws_ok(
  $$update public.events set capacity = 1 where slug = 'mala-akce'$$,
  'P0001', 'capacity_below_reserved', 'kapacitu nelze snížit pod obsazenost (2 potvrzená místa)');
select lives_ok($$update public.events set capacity = 2 where slug = 'mala-akce'$$, 'snížení kapacity na obsazenost je povoleno');

update public.events set status = 'cancelled' where slug = 'mala-akce';
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  (public.create_reservation('00000000-0000-0000-0000-00000000e001', 'Jana Nováková', 'a@b.cz', '123456789', 1)) ->> 'code',
  'event_not_found', 'na zrušenou akci nelze rezervovat');
select is(
  (public.set_reservation_status((select (result #>> '{reservation,id}')::uuid from r where name = 'e'), 'pending_payment')) ->> 'code',
  'event_not_bookable', 'na zrušené akci nelze obnovit blokující rezervaci');
reset role;

select * from finish();
rollback;
