-- DVĚ – pgTAP: regresní testy k finální kontrole před nasazením
--   A) lhůta na zaplacení vs. začátek akce
--   B) oddělení stavu rezervace od stavu platby
--   C) audit efektivních oprávnění funkcí (allowlist)
--   D) ochrana kapacity u zrušené akce a přímých zápisů
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'uzivatel@example.com');
insert into public.admin_profiles (id, email, display_name)
values ('00000000-0000-0000-0000-0000000000a1', 'admin@example.com', 'Admin');

insert into public.events (id, slug, title, category, start_at, end_at, time_label, price, capacity, status) values
  ('00000000-0000-0000-0000-00000000e010', 'za-deset-hodin', 'Za 10 h', 'joga',
   now() + interval '10 hours', now() + interval '11 hours', '18:00–19:00', 100, 5, 'published'),
  ('00000000-0000-0000-0000-00000000e011', 'za-deset-minut', 'Za 10 min', 'joga',
   now() + interval '10 minutes', now() + interval '70 minutes', '18:00–19:00', 100, 5, 'published'),
  ('00000000-0000-0000-0000-00000000e012', 'za-tri-dny', 'Za 3 dny', 'joga',
   now() + interval '3 days', now() + interval '3 days 1 hour', '18:00–19:00', 100, 2, 'published'),
  ('00000000-0000-0000-0000-00000000e013', 'za-mesic', 'Za měsíc', 'joga',
   now() + interval '30 days', now() + interval '30 days 1 hour', '18:00–19:00', 100, 5, 'published');

create temp table r (name text primary key, result jsonb);
grant all on r to service_role, authenticated;

-- ============================================================ A) lhůta vs. začátek akce
set local role service_role;

insert into r select 'soon', public.create_reservation('00000000-0000-0000-0000-00000000e010', 'Jana Nováková', 'jana@example.com', '123456789', 1);
select is(
  (select (result #>> '{reservation,expires_at}')::timestamptz from r where name = 'soon'),
  now() + interval '10 hours',
  'akce za 10 h: lhůta končí začátkem akce, ne po 48 h');

select is(
  (public.create_reservation('00000000-0000-0000-0000-00000000e011', 'Jana Nováková', 'jana@example.com', '123456789', 1)) ->> 'reason',
  'payment_window_closed', 'akce za 10 min: na zaplacení není čas → rezervace se nevytvoří');

insert into r select 'cutoff', public.create_reservation('00000000-0000-0000-0000-00000000e012', 'Petr Dvořák', 'petr@example.com', '123456789', 1,
  null, interval '48 hours', interval '2 days');
select is(
  (select (result #>> '{reservation,expires_at}')::timestamptz from r where name = 'cutoff'),
  now() + interval '1 day',
  'odstup před začátkem (např. QR převod 2 dny): lhůta = začátek − 2 dny');

select is(
  (public.create_reservation('00000000-0000-0000-0000-00000000e012', 'Petr Dvořák', 'petr@example.com', '123456789', 1,
     null, interval '48 hours', interval '3 days')) ->> 'reason',
  'payment_window_closed', 'odstup delší než zbývající čas → payment_window_closed');

select is(
  (public.create_reservation('00000000-0000-0000-0000-00000000e012', 'Petr Dvořák', 'petr@example.com', '123456789', 1,
     null, interval '48 hours', interval '-1 hour')) ->> 'field',
  'payment_cutoff', 'záporný odstup → invalid_input');

select throws_ok(
  $$insert into public.reservations (event_id, customer_name, customer_email, customer_phone, number_of_spots, expires_at)
    values ('00000000-0000-0000-0000-00000000e010', 'Přímý Zápis', 'primy@example.com', '123456789', 1, now() + interval '2 days')$$,
  'P0001', 'expiry_after_event_start', 'přímý zápis s lhůtou po začátku akce je odmítnut');

insert into r select 'month', public.create_reservation('00000000-0000-0000-0000-00000000e013', 'Eva Malá', 'eva@example.com', '123456789', 1);
reset role;

-- Přesunutí akce dříve zkrátí lhůty čekajících rezervací.
update public.events set start_at = now() + interval '5 hours', end_at = now() + interval '6 hours'
 where id = '00000000-0000-0000-0000-00000000e013';
select is(
  (select expires_at from public.reservations where id = (select (result #>> '{reservation,id}')::uuid from r where name = 'month')),
  now() + interval '5 hours',
  'posunutí začátku akce dříve zkrátí lhůtu nezaplacené rezervace');

-- ============================================================ B) stav rezervace × stav platby
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

insert into r select 'manual', public.set_reservation_status((select (result #>> '{reservation,id}')::uuid from r where name = 'soon'), 'confirmed');
select is((select result ->> 'ok' from r where name = 'manual'), 'true', 'admin smí rezervaci ručně potvrdit');
select is((select result #>> '{reservation,payment_status}' from r where name = 'manual'), 'unpaid', 'ruční potvrzení nemění stav platby');
select is((select result #>> '{reservation,payment_verified}' from r where name = 'manual'), 'false', 'ruční potvrzení není ověřená platba');
select is(
  (select status_changed_by from public.reservations where id = (select (result #>> '{reservation,id}')::uuid from r where name = 'soon')),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'u ručního potvrzení je zaznamenáno, kdo ho provedl');
select is(
  (public.set_reservation_status((select (result #>> '{reservation,id}')::uuid from r where name = 'soon'), 'expired')) ->> 'code',
  'invalid_transition', 'potvrzenou rezervaci nelze označit jako vypršelou');
reset role;

-- Backend zaznamená ověřenou platbu (service_role) – i tady oba stavy nezávisle.
set local role service_role;
update public.reservations set payment_status = 'paid'
 where id = (select (result #>> '{reservation,id}')::uuid from r where name = 'soon');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is(
  (public.set_reservation_status((select (result #>> '{reservation,id}')::uuid from r where name = 'soon'), 'pending_payment')) ->> 'code',
  'invalid_transition', 'zaplacenou rezervaci nelze vrátit do čekání na platbu');
select is(
  (public.set_reservation_status((select (result #>> '{reservation,id}')::uuid from r where name = 'soon'), 'cancelled')) #>> '{reservation,payment_status}',
  'paid', 'zrušení zaplacené rezervace stav platby nemění (refundace je věc backendu)');
reset role;

select throws_ok(
  $$update public.reservations set payment_status = 'paid'
     where id = (select (result #>> '{reservation,id}')::uuid from r where name = 'cutoff')$$,
  '23514', null, 'stav pending_payment + paid je zakázán (zaplacené místo by po expiraci propadlo)');

-- Podvržené claims nedají běžnému uživateli práva backendu.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"service_role"}', true);
set local role authenticated;
select throws_ok(
  $$select public.set_reservation_status((select (result #>> '{reservation,id}')::uuid from r where name = 'cutoff'), 'confirmed')$$,
  '42501', 'forbidden', 'authenticated s podvrženým role=service_role v claims dostane forbidden');
select is(private.is_service_role(), false, 'is_service_role() rozhoduje podle skutečné role, ne podle claims');
reset role;

-- ============================================================ C) audit oprávnění funkcí
create temp view fn_audit as
select ((n.nspname || '.' || p.proname)::text collate "default") as fn, p.oid, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) as owner
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'private') and p.prokind = 'f';

select results_eq(
  $$select fn from fn_audit where has_function_privilege('anon', oid, 'execute') order by fn$$,
  $$values ('public.get_public_event'), ('public.list_public_events')$$,
  'anon smí spustit jen veřejné čtecí funkce');
select results_eq(
  $$select fn from fn_audit where has_function_privilege('authenticated', oid, 'execute') order by fn$$,
  $$values ('private.is_admin'), ('private.is_service_role'), ('private.reservation_blocks_capacity'),
           ('public.get_public_event'), ('public.list_public_events'), ('public.set_reservation_status')$$,
  'authenticated smí spustit jen schválené funkce (set_reservation_status uvnitř ověřuje admina)');
select ok(
  not has_function_privilege('authenticated', 'private.blocked_spots(uuid,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.expire_pending_reservations()', 'execute'),
  'authenticated nesmí volat interní výpočty ani expiraci');
select results_eq(
  $$select fn from fn_audit where prosecdef order by fn$$,
  $$values ('private.blocked_spots'), ('private.clamp_pending_expiry_to_event_start'), ('private.enforce_reservation_capacity'),
           ('private.expire_pending_reservations'), ('private.is_admin'), ('private.validate_event'),
           ('public.get_public_event'), ('public.list_public_events'), ('public.set_reservation_status')$$,
  'seznam SECURITY DEFINER funkcí odpovídá schválenému návrhu');
select is_empty(
  $$select fn from fn_audit where prosecdef and (owner <> 'postgres' or not ('search_path=""' = any (proconfig)))$$,
  'všechny SECURITY DEFINER funkce vlastní postgres a mají search_path = ''''');
select is_empty(
  $$select fn from fn_audit where not prosecdef and not coalesce('search_path=""' = any (proconfig), false)$$,
  'i ostatní funkce mají pevný prázdný search_path');
select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'is_admin'),
  've veřejném API není žádná funkce is_admin, kterou by šlo zneužít');
select ok(
  not has_column_privilege('authenticated', 'public.reservations', 'status_changed_by', 'update')
  and not has_column_privilege('authenticated', 'public.reservations', 'expires_at', 'update')
  and not has_column_privilege('authenticated', 'public.reservations', 'number_of_spots', 'update'),
  'admin nemůže přímo měnit audit, lhůtu ani počet míst');

-- Běžný uživatel: žádná cesta k admin právům ani cizím rezervacím.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select is(private.is_admin(), false, 'běžný uživatel není admin');
select is_empty($$select * from public.admin_profiles$$, 'běžný uživatel nevidí cizí admin profily');
select is_empty($$select * from public.reservations$$, 'běžný uživatel nevidí žádné rezervace');
reset role;

-- ============================================================ D) kapacita u zrušené akce
set local role service_role;
insert into r select 'cancel-ev', public.create_reservation('00000000-0000-0000-0000-00000000e012', 'Iva Rychlá', 'iva@example.com', '123456789', 1);
reset role;
update public.events set status = 'cancelled' where id = '00000000-0000-0000-0000-00000000e012';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is(
  (public.set_reservation_status((select (result #>> '{reservation,id}')::uuid from r where name = 'cancel-ev'), 'confirmed')) ->> 'code',
  'event_not_bookable', 'na zrušené akci nelze potvrdit ani čekající rezervaci');
reset role;

set local role service_role;
select throws_ok(
  $$update public.reservations set reservation_status = 'confirmed'
     where id = (select (result #>> '{reservation,id}')::uuid from r where name = 'cancel-ev')$$,
  'P0001', 'event_not_bookable', 'ani přímý zápis backendu nepotvrdí rezervaci na zrušené akci');
reset role;

select * from finish();
rollback;
