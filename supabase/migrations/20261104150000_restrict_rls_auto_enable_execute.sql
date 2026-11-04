-- =============================================================================
-- DVĚ – migrace 4: odebrání zbytečného EXECUTE z platformní funkce rls_auto_enable
--
-- Kontext (bezpečnostní audit po nasazení, viz SUPABASE_INTEGRATION.md kap. 5.5):
--   public.rls_auto_enable() je platformní funkce Supabase, kterou při založení
--   projektu vytvořila role postgres (ještě před migracemi DVĚ). Volá ji výhradně
--   event trigger `ensure_rls` (ddl_command_end), který zapíná RLS na nových
--   tabulkách ve schématu public.
--   Kvůli výchozím právům Supabase (ALTER DEFAULT PRIVILEGES pro postgres v public)
--   a výchozímu EXECUTE pro PUBLIC ji mohou volat anon i authenticated přes
--   /rest/v1/rpc/rls_auto_enable → 2 varování advisoru
--   (anon/authenticated_security_definer_function_executable).
--
-- Ověřeno lokálně na přesné kopii funkce:
--   - přímé volání tělo funkce nespustí (nelze tím nic změnit),
--   - event trigger spouští funkci bez ohledu na EXECUTE volající role → po
--     odebrání EXECUTE se RLS na nových tabulkách zapíná dál, i pro role bez EXECUTE.
--
-- Migrace mění POUZE oprávnění. Funkci ani event trigger nemaže a nemění.
-- Je podmíněná: spustí se jen tehdy, když funkce existuje, vrací event_trigger
-- a vlastní ji postgres (lokální vývojové prostředí ji nemá → nic se nestane).
-- Vlastník (postgres) si EXECUTE ponechává.
-- =============================================================================

do $$
declare
  v_fn regprocedure := to_regprocedure('public.rls_auto_enable()');
begin
  if v_fn is null then
    raise notice 'public.rls_auto_enable() neexistuje – migrace nic nemění.';
    return;
  end if;

  if (select p.prorettype <> 'pg_catalog.event_trigger'::regtype
             or pg_get_userbyid(p.proowner) <> 'postgres'
        from pg_catalog.pg_proc p
       where p.oid = v_fn) then
    raise notice 'public.rls_auto_enable() nemá očekávaný tvar (event_trigger, vlastník postgres) – migrace nic nemění.';
    return;
  end if;

  revoke execute on function public.rls_auto_enable() from public, anon, authenticated, service_role;
  raise notice 'EXECUTE na public.rls_auto_enable() odebráno rolím PUBLIC, anon, authenticated, service_role.';
end;
$$;
