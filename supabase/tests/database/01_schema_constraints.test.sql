-- DVĚ – pgTAP: struktura schématu a databázová omezení
-- Spuštění: npx supabase test db   (lokálně; nikdy s --remote)
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(35);

-- ---------------------------------------------------------------- tabulky
select has_table('public', 'events', 'tabulka events existuje');
select has_table('public', 'reservations', 'tabulka reservations existuje');
select has_table('public', 'payments', 'tabulka payments existuje');
select has_table('public', 'admin_profiles', 'tabulka admin_profiles existuje');
select has_table('public', 'gallery_items', 'tabulka gallery_items existuje');
select has_table('public', 'notification_log', 'tabulka notification_log existuje');
select has_view('public', 'admin_event_occupancy', 'pohled admin_event_occupancy existuje');

-- ---------------------------------------------------------------- typy sloupců
select col_type_is('public', 'events', 'start_at', 'timestamp with time zone', 'start_at je timestamptz');
select col_type_is('public', 'events', 'end_at', 'timestamp with time zone', 'end_at je timestamptz');
select col_type_is('public', 'events', 'price', 'numeric(10,2)', 'cena je numeric, ne float');
select col_type_is('public', 'payments', 'amount', 'numeric(10,2)', 'částka platby je numeric');
select col_type_is('public', 'reservations', 'reservation_status', 'reservation_status', 'stav rezervace je enum');
select col_type_is('public', 'reservations', 'payment_status', 'payment_status', 'stav platby je enum');

-- ---------------------------------------------------------------- cizí klíče
select fk_ok('public', 'reservations', 'event_id', 'public', 'events', 'id');
select fk_ok('public', 'payments', 'reservation_id', 'public', 'reservations', 'id');
select fk_ok('public', 'admin_profiles', 'id', 'auth', 'users', 'id');
select fk_ok('public', 'notification_log', 'reservation_id', 'public', 'reservations', 'id');

-- ---------------------------------------------------------------- RLS zapnuté všude
select ok(
  (select bool_and(c.relrowsecurity)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'),
  'RLS je zapnuté na všech tabulkách ve schématu public'
);

-- ---------------------------------------------------------------- omezení events
create temp table t_event as
  select gen_random_uuid() as id;

insert into public.events (id, slug, title, category, start_at, end_at, time_label, price, capacity, status)
select id, 'test-akce', 'Test', 'joga', now() + interval '10 days', now() + interval '10 days 1 hour', '9:00–10:00', 100, 2, 'published'
from t_event;

select throws_ok(
  $$insert into public.events (slug, title, category, start_at, end_at, time_label, price, capacity)
    values ('zaporna-cena', 'X', 'joga', now(), now() + interval '1 hour', '9:00–10:00', -1, 5)$$,
  '23514', null, 'záporná cena je odmítnuta');
select throws_ok(
  $$insert into public.events (slug, title, category, start_at, end_at, time_label, price, capacity)
    values ('nulova-kapacita', 'X', 'joga', now(), now() + interval '1 hour', '9:00–10:00', 0, 0)$$,
  '23514', null, 'nulová kapacita je odmítnuta');
select throws_ok(
  $$insert into public.events (slug, title, category, start_at, end_at, time_label, price, capacity)
    values ('spatny-interval', 'X', 'joga', now(), now() - interval '1 hour', '9:00–10:00', 0, 5)$$,
  '23514', null, 'konec před začátkem je odmítnut');
select throws_ok(
  $$insert into public.events (slug, title, category, start_at, end_at, time_label, price, capacity)
    values ('Neplatny Slug!', 'X', 'joga', now(), now() + interval '1 hour', '9:00–10:00', 0, 5)$$,
  '23514', null, 'neplatný slug je odmítnut');
select throws_ok(
  $$insert into public.events (slug, title, category, start_at, end_at, time_label, price, capacity, timezone)
    values ('spatne-pasmo', 'X', 'joga', now(), now() + interval '1 hour', '9:00–10:00', 0, 5, 'Mars/Olympus')$$,
  '22023', 'invalid_timezone', 'neexistující časové pásmo je odmítnuto');
select throws_ok(
  $$insert into public.events (slug, title, category, start_at, end_at, time_label, price, capacity)
    values ('test-akce', 'X', 'joga', now(), now() + interval '1 hour', '9:00–10:00', 0, 5)$$,
  '23505', null, 'duplicitní slug je odmítnut');

-- ---------------------------------------------------------------- omezení reservations
select throws_ok(
  $$insert into public.reservations (event_id, customer_name, customer_email, customer_phone, number_of_spots, reservation_status)
    select id, 'Jana Test', 'jana@example.com', '123456789', 1, 'pending_payment' from t_event$$,
  '23514', null, 'pending_payment bez expires_at je odmítnuta');
select throws_ok(
  $$insert into public.reservations (event_id, customer_name, customer_email, customer_phone, number_of_spots, expires_at)
    select id, 'Jana Test', 'jana@example.com', '123456789', 0, now() + interval '1 day' from t_event$$,
  '23514', null, 'nula míst je odmítnuta');
select throws_ok(
  $$insert into public.reservations (event_id, customer_name, customer_email, customer_phone, number_of_spots, expires_at)
    select id, 'Jana Test', 'neni-email', '123456789', 1, now() + interval '1 day' from t_event$$,
  '23514', null, 'neplatný e-mail je odmítnut');
select throws_ok(
  $$insert into public.reservations (event_id, customer_name, customer_email, customer_phone, number_of_spots, expires_at)
    select id, 'Jana Test', 'jana@example.com', 'abc', 1, now() + interval '1 day' from t_event$$,
  '23514', null, 'neplatný telefon je odmítnut');

insert into public.reservations (event_id, customer_name, customer_email, customer_phone, number_of_spots, expires_at)
select id, 'Jana Test', 'jana@example.com', '123456789', 1, now() + interval '1 day' from t_event;

select matches(
  (select public_code from public.reservations where customer_email = 'jana@example.com'),
  '^R-[A-Z0-9]{8}$',
  'veřejné číslo rezervace má tvar R-XXXXXXXX'
);
select throws_ok(
  $$delete from public.events where slug = 'test-akce'$$,
  '23503', null, 'akci s rezervacemi nelze smazat (on delete restrict)');

-- ---------------------------------------------------------------- payments, notifikace, galerie
insert into public.payments (reservation_id, provider, amount, provider_reference)
select id, 'gopay', 100, 'GP-1' from public.reservations where customer_email = 'jana@example.com';

select throws_ok(
  $$insert into public.payments (reservation_id, provider, amount, provider_reference)
    select id, 'gopay', 100, 'GP-1' from public.reservations where customer_email = 'jana@example.com'$$,
  '23505', null, 'duplicitní reference platby (webhook) je odmítnuta');

insert into public.notification_log (type, reservation_id, recipient, dedupe_key)
select 'reservation_created', id, 'jana@example.com', 'reservation_created:' || id
from public.reservations where customer_email = 'jana@example.com';

select throws_ok(
  $$insert into public.notification_log (type, reservation_id, recipient, dedupe_key)
    select 'reservation_created', id, 'jana@example.com', 'reservation_created:' || id
    from public.reservations where customer_email = 'jana@example.com'$$,
  '23505', null, 'duplicitní notifikace je odmítnuta (dedupe_key)');
select throws_ok(
  $$insert into public.notification_log (type, recipient, dedupe_key) values ('event_reminder', 'x@example.com', 'bez-vazby')$$,
  '23514', null, 'notifikace bez vazby na rezervaci/akci je odmítnuta');
select throws_ok(
  $$insert into public.gallery_items (alt_text) values ('Bez obrázku')$$,
  '23514', null, 'položka galerie bez obrázku je odmítnuta');
select throws_ok(
  $$insert into public.gallery_items (alt_text, image_url) values ('Nezabezpečené', 'http://example.com/a.jpg')$$,
  '23514', null, 'obrázek galerie musí být přes https');

select * from finish();
rollback;
