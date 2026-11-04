-- DVĚ – pgTAP: oprávnění (GRANT), Row Level Security a role
-- Negativní testy: anon ani běžný přihlášený uživatel nesmí číst rezervace
-- ani provádět administrátorské operace; ani administrátorka nesmí měnit platby.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(46);

-- ---------------------------------------------------------------- testovací data (jako postgres)
-- Lokální seed (ukázkové akce) se v rámci testu dočasně odstraní – transakce končí ROLLBACK.
delete from public.events where is_demo;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'uzivatel@example.com');
insert into public.admin_profiles (id, email, display_name)
values ('00000000-0000-0000-0000-0000000000a1', 'admin@example.com', 'Testovací administrátorka');

insert into public.events (id, slug, title, category, start_at, end_at, time_label, price, capacity, status)
values
  ('00000000-0000-0000-0000-00000000e001', 'verejna-akce', 'Veřejná', 'joga',
   now() + interval '10 days', now() + interval '10 days 1 hour', '9:00–10:00', 100, 5, 'published'),
  ('00000000-0000-0000-0000-00000000e002', 'skryta-akce', 'Skrytá', 'joga',
   now() + interval '10 days', now() + interval '10 days 1 hour', '9:00–10:00', 100, 5, 'draft');

insert into public.reservations (id, event_id, customer_name, customer_email, customer_phone, number_of_spots, expires_at)
values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000e001',
        'Tajná Zákaznice', 'tajna@example.com', '123456789', 2, now() + interval '1 day');

insert into public.gallery_items (alt_text, image_url, is_published) values
  ('Publikovaná', 'https://example.com/a.jpg', true),
  ('Skrytá', 'https://example.com/b.jpg', false);

-- ---------------------------------------------------------------- GRANT (bez ohledu na RLS)
select ok(not has_table_privilege('anon', 'public.reservations', 'select'), 'anon nemá SELECT na reservations');
select ok(not has_table_privilege('anon', 'public.reservations', 'insert'), 'anon nemá INSERT na reservations');
select ok(not has_table_privilege('anon', 'public.events', 'select'), 'anon nemá přímý SELECT na events');
select ok(not has_table_privilege('anon', 'public.events', 'update'), 'anon nemá UPDATE na events');
select ok(not has_table_privilege('anon', 'public.payments', 'select'), 'anon nemá SELECT na payments');
select ok(not has_table_privilege('anon', 'public.admin_profiles', 'select'), 'anon nemá SELECT na admin_profiles');
select ok(not has_table_privilege('anon', 'public.notification_log', 'select'), 'anon nemá SELECT na notification_log');
select ok(not has_table_privilege('authenticated', 'public.admin_profiles', 'insert'), 'authenticated nemůže zakládat admin_profiles');
select ok(not has_table_privilege('authenticated', 'public.admin_profiles', 'update'), 'authenticated nemůže měnit admin_profiles');
select ok(not has_column_privilege('authenticated', 'public.reservations', 'payment_status', 'update'), 'authenticated nemůže měnit payment_status');
select ok(not has_column_privilege('authenticated', 'public.reservations', 'reservation_status', 'update'), 'stav rezervace jen přes set_reservation_status');
select ok(not has_table_privilege('authenticated', 'public.payments', 'insert'), 'authenticated nemůže zapisovat platby');
select ok(not has_function_privilege('anon', 'public.create_reservation(uuid,text,text,text,integer,text,interval,interval)', 'execute'), 'anon nemůže volat create_reservation přímo');
select ok(not has_function_privilege('authenticated', 'public.create_reservation(uuid,text,text,text,integer,text,interval,interval)', 'execute'), 'authenticated nemůže volat create_reservation přímo');
select ok(not has_function_privilege('anon', 'public.set_reservation_status(uuid,public.reservation_status,interval,interval)', 'execute'), 'anon nemůže volat set_reservation_status');
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon nemá přístup ke schématu private');
select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef
       and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
  ),
  'každá SECURITY DEFINER funkce má pevný search_path');
select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef and pg_get_userbyid(p.proowner) <> 'postgres'
  ),
  'SECURITY DEFINER funkce vlastní role postgres');
select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'execute')
  ),
  'anon nemůže spustit žádnou funkci ze schématu private');
select ok(
  not exists (
    select 1 from unnest(array['customer_name', 'customer_email', 'customer_phone', 'note', 'status', 'created_at', 'updated_at']) col
     where col = any (select unnest(proargnames) from pg_proc where proname = 'list_public_events')
  ),
  'list_public_events nevrací osobní údaje ani interní pole');

-- ---------------------------------------------------------------- anon (veřejný návštěvník)
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select * from public.reservations', '42501', null, 'anon: čtení rezervací je zakázáno');
select throws_ok(
  $$insert into public.reservations (event_id, customer_name, customer_email, customer_phone, number_of_spots, expires_at)
    values ('00000000-0000-0000-0000-00000000e001', 'Bot', 'bot@example.com', '123456789', 1, now() + interval '1 day')$$,
  '42501', null, 'anon: přímé vložení rezervace je zakázáno');
select throws_ok($$update public.events set price = 0$$, '42501', null, 'anon: změna akcí je zakázána');
select throws_ok($$update public.reservations set payment_status = 'paid'$$, '42501', null, 'anon: změna platby je zakázána');
select throws_ok(
  $$select public.create_reservation('00000000-0000-0000-0000-00000000e001', 'Bot Botů', 'bot@example.com', '123456789', 1)$$,
  '42501', null, 'anon: create_reservation nelze volat přímo');
select throws_ok(
  $$select public.set_reservation_status('00000000-0000-0000-0000-00000000c001', 'cancelled')$$,
  '42501', null, 'anon: set_reservation_status je zakázána');
select throws_ok($$select * from public.admin_event_occupancy$$, '42501', null, 'anon: obsazenost pro adminy je zakázána');
select results_eq(
  $$select slug from public.list_public_events()$$,
  $$values ('verejna-akce'::text)$$,
  'anon: veřejný seznam obsahuje jen publikované akce');
select is(
  (select available_spots from public.get_public_event('verejna-akce')),
  3, 'anon: vidí jen agregovanou obsazenost (5 − 2)');
select is_empty($$select * from public.get_public_event('skryta-akce')$$, 'anon: skrytou akci nevidí ani podle slugu');
select results_eq(
  $$select alt_text from public.gallery_items$$,
  $$values ('Publikovaná'::text)$$,
  'anon: galerie vrací jen publikované položky');
reset role;

-- ---------------------------------------------------------------- přihlášený uživatel bez admin profilu
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;

select is_empty('select * from public.reservations', 'neadmin: nevidí žádné rezervace');
select is_empty('select * from public.events', 'neadmin: nevidí tabulku events přímo');
select throws_ok(
  $$insert into public.admin_profiles (id, email, display_name)
    values ('00000000-0000-0000-0000-0000000000b1', 'uzivatel@example.com', 'Hacker')$$,
  '42501', null, 'neadmin: nemůže si sám přidělit roli administrátora');
select throws_ok(
  $$insert into public.events (slug, title, category, start_at, end_at, time_label, price, capacity)
    values ('podvrh', 'X', 'joga', now() + interval '1 day', now() + interval '1 day 1 hour', '9:00–10:00', 0, 5)$$,
  '42501', null, 'neadmin: nemůže vytvořit akci (RLS)');
select throws_ok(
  $$select public.set_reservation_status('00000000-0000-0000-0000-00000000c001', 'confirmed')$$,
  '42501', 'forbidden', 'neadmin: set_reservation_status vrací forbidden');
reset role;

-- ---------------------------------------------------------------- administrátorka
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.reservations), 1, 'admin: vidí rezervace');
select is((select count(*)::int from public.events), 2, 'admin: vidí i nepublikované akce');
select lives_ok(
  $$update public.reservations set note = 'Volala, přijde dřív' where id = '00000000-0000-0000-0000-00000000c001'$$,
  'admin: smí upravit poznámku a kontaktní údaje');
select throws_ok(
  $$update public.reservations set payment_status = 'paid' where id = '00000000-0000-0000-0000-00000000c001'$$,
  '42501', null, 'admin: nesmí sama nastavit zaplaceno (jen backend)');
select throws_ok(
  $$update public.reservations set reservation_status = 'confirmed' where id = '00000000-0000-0000-0000-00000000c001'$$,
  '42501', null, 'admin: stav nemění přímým UPDATE, jen přes funkci');
select throws_ok(
  $$insert into public.payments (reservation_id, provider, amount) values ('00000000-0000-0000-0000-00000000c001', 'manual', 100)$$,
  '42501', null, 'admin: nesmí zapisovat platby');
select throws_ok(
  $$delete from public.reservations$$,
  '42501', null, 'admin: rezervace se nemažou, jen ruší stavem');
select is(
  (public.set_reservation_status('00000000-0000-0000-0000-00000000c001', 'confirmed') ->> 'ok')::boolean,
  true, 'admin: potvrdí rezervaci přes set_reservation_status');
select is(
  (select blocked_spots from public.admin_event_occupancy where event_id = '00000000-0000-0000-0000-00000000e001'),
  2, 'admin: vidí obsazenost akce');
select lives_ok(
  $$update public.events set title = 'Veřejná – upraveno' where slug = 'verejna-akce'$$,
  'admin: smí upravit akci');
reset role;

select * from finish();
rollback;
