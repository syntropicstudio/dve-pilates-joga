-- =============================================================================
-- DVĚ – migrace 2/3: ověření administrátorek, oprávnění (GRANT) a Row Level Security
--
-- Princip minimálních oprávnění:
--   anon          – žádný přímý přístup k tabulkám kromě publikované galerie;
--                   akce čte jen přes veřejné funkce (migrace 3).
--   authenticated – přihlášený uživatel. Data vidí a mění jen administrátorka
--                   (řádek v admin_profiles). Bez profilu nevidí nic.
--   service_role  – backend (Edge Functions). Obchází RLS, nikdy není v prohlížeči.
--
-- Supabase při vytvoření tabulky automaticky uděluje ALL rolím anon/authenticated
-- (default privileges). Proto se zde nejdřív vše odebere a pak se přidá jen nutné.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ověření administrátorky
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER: funkce musí přečíst admin_profiles bez ohledu na RLS volajícího.
-- Vrací jen boolean pro aktuálního uživatele (auth.uid()), nic jiného neprozrazuje.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    where ap.id = (select auth.uid())
  );
$$;

comment on function private.is_admin() is
  'True, pokud je přihlášený uživatel administrátorka (řádek v admin_profiles).';

-- Je volajícím backend (service_role)? Používají privilegované funkce.
-- Rozhoduje skutečná databázová role nastavená přes SET ROLE (PostgREST ji nastaví
-- podle ověřeného JWT). Nečte se request.jwt.claims – ty lze v SQL přepsat přes
-- set_config, kdežto SET ROLE na service_role vyžaduje členství v této roli.
-- Uvnitř SECURITY DEFINER funkce zůstává current_setting('role') roli volajícího.
create function private.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_setting('role', true) = 'service_role';
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.is_service_role() from public;
revoke all on function private.set_updated_at() from public;
revoke all on function private.generate_reservation_code() from public;

-- authenticated potřebuje is_admin() pro vyhodnocení RLS politik.
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.is_service_role() to authenticated, service_role;
grant execute on function private.generate_reservation_code() to service_role;

-- -----------------------------------------------------------------------------
-- GRANT – nejdřív odebrat výchozí oprávnění, pak přidat minimum
-- -----------------------------------------------------------------------------
revoke all on table
  public.events,
  public.reservations,
  public.payments,
  public.admin_profiles,
  public.gallery_items,
  public.notification_log
from anon, authenticated, public;

-- service_role (backend) má plný přístup; RLS obchází atributem BYPASSRLS.
grant select, insert, update, delete on table
  public.events,
  public.reservations,
  public.payments,
  public.admin_profiles,
  public.gallery_items,
  public.notification_log
to service_role;

-- events: správa jen administrátorkami (RLS). Veřejnost přes funkce, ne přímo.
grant select, insert, update, delete on public.events to authenticated;

-- reservations: administrátorka čte vše a smí opravit kontaktní údaje a poznámku.
-- Stav rezervace mění jen přes set_reservation_status(), stav platby jen backend.
-- INSERT/DELETE nejsou povolené (rezervace vznikají přes create_reservation, ruší se stavem).
grant select on public.reservations to authenticated;
grant update (customer_name, customer_email, customer_phone, note) on public.reservations to authenticated;

-- payments, notification_log: administrátorka jen čte, zapisuje backend.
grant select on public.payments to authenticated;
grant select on public.notification_log to authenticated;

-- admin_profiles: uživatel vidí jen svůj profil; zápis nemá nikdo kromě service_role.
grant select on public.admin_profiles to authenticated;

-- gallery_items: publikované položky jsou veřejné, správa jen administrátorkami.
grant select on public.gallery_items to anon;
grant select, insert, update, delete on public.gallery_items to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.reservations enable row level security;
alter table public.payments enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.gallery_items enable row level security;
alter table public.notification_log enable row level security;

-- events
create policy "events: admin select" on public.events
  for select to authenticated using ((select private.is_admin()));
create policy "events: admin insert" on public.events
  for insert to authenticated with check ((select private.is_admin()));
create policy "events: admin update" on public.events
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "events: admin delete" on public.events
  for delete to authenticated using ((select private.is_admin()));

-- reservations
create policy "reservations: admin select" on public.reservations
  for select to authenticated using ((select private.is_admin()));
create policy "reservations: admin update contact" on public.reservations
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- payments
create policy "payments: admin select" on public.payments
  for select to authenticated using ((select private.is_admin()));

-- notification_log
create policy "notification_log: admin select" on public.notification_log
  for select to authenticated using ((select private.is_admin()));

-- admin_profiles: jen vlastní řádek (frontend tak zjistí, zda je uživatel admin)
create policy "admin_profiles: own row" on public.admin_profiles
  for select to authenticated using (id = (select auth.uid()));

-- gallery_items
create policy "gallery_items: anon read published" on public.gallery_items
  for select to anon using (is_published);
-- Jedna politika pro authenticated (víc permisivních politik zpomaluje dotazy).
create policy "gallery_items: authenticated read" on public.gallery_items
  for select to authenticated using (is_published or (select private.is_admin()));
create policy "gallery_items: admin insert" on public.gallery_items
  for insert to authenticated with check ((select private.is_admin()));
create policy "gallery_items: admin update" on public.gallery_items
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "gallery_items: admin delete" on public.gallery_items
  for delete to authenticated using ((select private.is_admin()));
