-- DVĚ – pgTAP: bezpečnostní audit SECURITY DEFINER funkcí po nasazení
--   A) veřejné funkce list_public_events / get_public_event
--   B) set_reservation_status – autorizace, podvržené vstupy a claims
--   C) eskalace oprávnění
--   D) platformní rls_auto_enable – omezení EXECUTE (migrace 20261104150000)
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(38);

-- ---------------------------------------------------------------- data
delete from public.events where is_demo;  -- lokální seed (vrátí se ROLLBACKem)

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'uzivatel@example.com');
insert into public.admin_profiles (id, email, display_name)
values ('00000000-0000-0000-0000-0000000000a1', 'admin@example.com', 'Admin');

insert into public.events (id, slug, title, category, start_at, end_at, time_label, price, capacity, status) values
  ('00000000-0000-0000-0000-00000000e101', 'publikovana', 'Publikovaná', 'joga',
   now() + interval '10 days', now() + interval '10 days 1 hour', '9:00–10:00', 100, 4, 'published'),
  ('00000000-0000-0000-0000-00000000e102', 'koncept', 'Koncept', 'joga',
   now() + interval '10 days', now() + interval '10 days 1 hour', '9:00–10:00', 100, 4, 'draft'),
  ('00000000-0000-0000-0000-00000000e103', 'zrusena', 'Zrušená', 'joga',
   now() + interval '10 days', now() + interval '10 days 1 hour', '9:00–10:00', 100, 4, 'cancelled'),
  ('00000000-0000-0000-0000-00000000e104', 'archiv', 'Archiv', 'joga',
   now() - interval '10 days', now() - interval '10 days' + interval '1 hour', '9:00–10:00', 100, 4, 'archived');

insert into public.reservations (id, event_id, customer_name, customer_email, customer_phone, number_of_spots, expires_at)
values ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000e101',
        'Tajná Zákaznice', 'tajna@example.com', '123456789', 3, now() + interval '1 day');

-- ============================================================ A) veřejné funkce
select is(
  (select p.provolatile::text from pg_proc p where p.oid = 'public.list_public_events()'::regprocedure),
  's', 'list_public_events je STABLE – Postgres v ní nedovolí žádný zápis');
select is(
  (select p.provolatile::text from pg_proc p where p.oid = 'public.get_public_event(text)'::regprocedure),
  's', 'get_public_event je STABLE – Postgres v ní nedovolí žádný zápis');
select is(
  (select array_agg(n order by n) from pg_proc p, unnest(p.proargnames) with ordinality as a(n, i)
    where p.oid = 'public.list_public_events()'::regprocedure),
  array['available_spots', 'bring', 'capacity', 'category', 'currency', 'description', 'end_at', 'id', 'image_path',
        'instructor', 'is_demo', 'location', 'price', 'short_description', 'slug', 'start_at', 'time_label', 'timezone', 'title']::text[],
  'list_public_events vrací jen schválené veřejné sloupce (allowlist)');
select is(
  (select array_agg(n order by n) from pg_proc p, unnest(p.proargnames) with ordinality as a(n, i)
    where p.oid = 'public.get_public_event(text)'::regprocedure and n <> 'p_slug'),
  (select array_agg(n order by n) from pg_proc p, unnest(p.proargnames) with ordinality as a(n, i)
    where p.oid = 'public.list_public_events()'::regprocedure),
  'get_public_event vrací stejné veřejné sloupce');

set local role anon;
select results_eq(
  $$select slug from public.list_public_events()$$,
  $$values ('publikovana'::text)$$,
  'anon: seznam obsahuje jen publikované akce (ne koncept, zrušenou, archivovanou)');
select is((select available_spots from public.get_public_event('publikovana')), 1, 'anon: vidí jen agregovanou obsazenost');
select is_empty($$select * from public.get_public_event('koncept')$$, 'anon: koncept nevidí ani podle slugu');
select is_empty($$select * from public.get_public_event('zrusena')$$, 'anon: zrušenou akci nevidí ani podle slugu');
select is_empty($$select * from public.get_public_event('archiv')$$, 'anon: archivovanou akci nevidí ani podle slugu');
select is_empty($$select * from public.get_public_event(null)$$, 'anon: NULL slug → prázdný výsledek, žádná chyba');
select is_empty($$select * from public.get_public_event($x$' or 1=1 --$x$)$$, 'anon: SQL injection ve slugu nic nevrátí');
select is_empty($$select * from public.get_public_event(repeat('a', 100000))$$, 'anon: extrémně dlouhý slug nic nevrátí');
select is_empty($$select * from public.get_public_event('%')$$, 'anon: zástupné znaky se neinterpretují');
select throws_ok('select * from public.reservations', '42501', null, 'anon: rezervace nečte');
select throws_ok('select * from public.events', '42501', null, 'anon: tabulku events přímo nečte');
reset role;

-- ============================================================ B) set_reservation_status
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.set_reservation_status('00000000-0000-0000-0000-00000000c101', 'cancelled')$$,
  '42501', 'forbidden', 'běžný uživatel: změna existující rezervace → forbidden');
select throws_ok(
  $$select public.set_reservation_status('00000000-0000-0000-0000-0000deadbeef', 'cancelled')$$,
  '42501', 'forbidden', 'běžný uživatel: neexistující ID → také forbidden (funkce neprozradí, zda rezervace existuje)');
-- RLS přímý UPDATE neodmítne chybou, ale odfiltruje všechny řádky (0 změněných).
select lives_ok($$update public.reservations set note = 'podvrh'$$, 'běžný uživatel: UPDATE proběhne bez chyby…');
reset role;
select is(
  (select note from public.reservations where id = '00000000-0000-0000-0000-00000000c101'),
  null, '…ale RLS nezměnil žádný řádek (poznámka zůstala prázdná)');

-- Podvržené claims: role/is_admin/app_metadata v JWT nic neznamenají, rozhoduje admin_profiles a skutečná DB role.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"service_role","is_admin":true,"app_metadata":{"role":"admin"}}', true);
set local role authenticated;
select throws_ok(
  $$select public.set_reservation_status('00000000-0000-0000-0000-00000000c101', 'confirmed')$$,
  '42501', 'forbidden', 'podvržené claims (role, is_admin, app_metadata) nedají práva');
reset role;
select is(
  (select reservation_status::text from public.reservations where id = '00000000-0000-0000-0000-00000000c101'),
  'pending_payment', 'rezervace zůstala beze změny');

-- Administrátorka: povolené operace
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is(
  (public.set_reservation_status('00000000-0000-0000-0000-00000000c101', 'confirmed')) #>> '{reservation,reservation_status}',
  'confirmed', 'admin: potvrzení');
select is(
  (public.set_reservation_status('00000000-0000-0000-0000-00000000c101', 'confirmed')) #>> '{reservation,payment_status}',
  'unpaid', 'admin: potvrzení nemění stav platby');
select is(
  (public.set_reservation_status('00000000-0000-0000-0000-00000000c101', 'cancelled')) ->> 'ok',
  'true', 'admin: zrušení');
select lives_ok(
  $$update public.reservations set note = 'Poznámka adminky' where id = '00000000-0000-0000-0000-00000000c101'$$,
  'admin: úprava poznámky');
select throws_ok(
  $$update public.reservations set payment_status = 'paid' where id = '00000000-0000-0000-0000-00000000c101'$$,
  '42501', null, 'admin: stav platby měnit nemůže');
reset role;

-- ============================================================ C) eskalace oprávnění
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.admin_profiles (id, email, display_name) values ('00000000-0000-0000-0000-0000000000b1', 'u@example.com', 'Já')$$,
  '42501', null, 'běžný uživatel si nevloží admin profil');
select throws_ok(
  $$update public.admin_profiles set role = 'admin'$$, '42501', null, 'běžný uživatel nemění admin profily');
select throws_ok($$select private.blocked_spots('00000000-0000-0000-0000-00000000e102')$$, '42501', null,
  'běžný uživatel nevolá interní výpočet obsazenosti (ani pro koncept)');
select throws_ok($$select private.expire_pending_reservations()$$, '42501', null, 'běžný uživatel nespustí expiraci');
select throws_ok($$select public.create_reservation('00000000-0000-0000-0000-00000000e101', 'Jana Nováková', 'j@example.com', '123456789', 1)$$,
  '42501', null, 'běžný uživatel nevytvoří rezervaci mimo backend');
select is(private.is_admin(), false, 'běžný uživatel zůstává bez admin práv');
reset role;

-- ============================================================ D) rls_auto_enable
-- Lokální prostředí platformní funkci nemá → vytvoříme přesnou kopii z DVE_PRODUCTION
-- (stejný vlastník a výchozí ACL) i s event triggerem; vše se na konci vrátí ROLLBACKem.
CREATE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
DECLARE cmd record; tbl name;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
      EXCEPTION WHEN OTHERS THEN RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     END IF;
  END LOOP;
END;
$function$;
create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();

select ok(has_function_privilege('anon', 'public.rls_auto_enable()', 'execute'), 'výchozí stav (jako produkce): anon má EXECUTE');

-- Stejný blok jako migrace 20261104150000_restrict_rls_auto_enable_execute.sql
do $$
declare
  v_fn regprocedure := to_regprocedure('public.rls_auto_enable()');
begin
  if v_fn is null then return; end if;
  if (select p.prorettype <> 'pg_catalog.event_trigger'::regtype or pg_get_userbyid(p.proowner) <> 'postgres'
        from pg_catalog.pg_proc p where p.oid = v_fn) then return; end if;
  revoke execute on function public.rls_auto_enable() from public, anon, authenticated, service_role;
end;
$$;

select ok(not has_function_privilege('anon', 'public.rls_auto_enable()', 'execute'), 'po migraci: anon nemá EXECUTE');
select ok(not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute'), 'po migraci: authenticated nemá EXECUTE');
select ok(has_function_privilege('postgres', 'public.rls_auto_enable()', 'execute'), 'po migraci: vlastník postgres EXECUTE má');

create table public.audit_new_table (id int);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.audit_new_table'::regclass),
  'event trigger po omezení EXECUTE dál zapíná RLS na nových tabulkách');

set local role anon;
select throws_ok($$select public.rls_auto_enable()$$, '42501', null, 'anon: volání rls_auto_enable je odmítnuto');
reset role;

select * from finish();
rollback;
