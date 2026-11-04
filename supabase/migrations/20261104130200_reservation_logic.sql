-- =============================================================================
-- DVĚ – migrace 3/3: obsazenost, atomické rezervace, změna stavu, expirace,
--                    veřejné čtení akcí
--
-- Pravidlo obsazenosti (shodné se src/lib/capacity.ts):
--   confirmed        blokuje kapacitu vždy,
--   pending_payment  blokuje kapacitu jen do expires_at,
--   cancelled/expired kapacitu neblokují.
--
-- Lhůta na zaplacení (expires_at) nikdy nepřesáhne začátek akce:
--   expires_at = least(now() + hold, start_at − payment_cutoff)
-- hold a payment_cutoff volí backend podle platební metody (např. QR převod
-- delší lhůta i odstup od začátku, platební brána kratší). Když zbývá méně než
-- 15 minut na zaplacení, rezervace se nevytvoří (event_not_bookable).
--
-- Stav rezervace a stav platby jsou nezávislé: žádná funkce v této migraci
-- nemění payment_status. Ověřenou platbu vyjadřuje jen payment_status = 'paid',
-- který smí nastavit výhradně backend (service_role).
--
-- Souběh: každá operace, která může zvýšit obsazenost akce, nejdřív zamkne řádek
-- akce (SELECT … FOR UPDATE). Operace nad stejnou akcí se tím seřadí za sebe.
-- Invariant „obsazenost ≤ kapacita“ navíc hlídá trigger na reservations, takže
-- platí i pro přímé zápisy (service_role, budoucí funkce).
-- Předpoklad: izolace READ COMMITTED (výchozí v Supabase) nebo SERIALIZABLE.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Pravidlo blokování a výpočet obsazenosti
-- -----------------------------------------------------------------------------
create function private.reservation_blocks_capacity(
  p_status public.reservation_status,
  p_expires_at timestamptz,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status = 'confirmed'
      or (p_status = 'pending_payment' and coalesce(p_expires_at > p_at, true));
$$;

-- Počet blokovaných míst akce (volitelně bez jedné rezervace – při její změně).
-- SECURITY DEFINER: musí sečíst všechny rezervace bez ohledu na RLS volajícího;
-- vrací jen agregované číslo, žádné osobní údaje. Není dostupná pro anon.
create function private.blocked_spots(p_event_id uuid, p_exclude_reservation_id uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(r.number_of_spots), 0)::integer
  from public.reservations r
  where r.event_id = p_event_id
    and (p_exclude_reservation_id is null or r.id <> p_exclude_reservation_id)
    and private.reservation_blocks_capacity(r.reservation_status, r.expires_at);
$$;

-- Lhůta na zaplacení: nikdy po začátku akce. NULL = na zaplacení nezbývá dost času.
create function private.payment_deadline(
  p_event_start timestamptz,
  p_hold interval,
  p_payment_cutoff interval
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
           when least(now() + p_hold, p_event_start - p_payment_cutoff) >= now() + interval '15 minutes'
           then least(now() + p_hold, p_event_start - p_payment_cutoff)
         end;
$$;

-- -----------------------------------------------------------------------------
-- Invariant kapacity – trigger na reservations
-- -----------------------------------------------------------------------------
create function private.enforce_reservation_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
  v_status   public.event_status;
  v_start    timestamptz;
  v_blocked  integer;
begin
  -- Lhůta na zaplacení nesmí přesáhnout začátek akce.
  if new.reservation_status = 'pending_payment'
     and (tg_op = 'INSERT'
          or new.expires_at is distinct from old.expires_at
          or new.event_id is distinct from old.event_id
          or old.reservation_status is distinct from new.reservation_status) then
    select e.start_at into v_start from public.events e where e.id = new.event_id;
    if new.expires_at > v_start then
      raise exception using
        errcode = 'P0001',
        message = 'expiry_after_event_start',
        detail  = format('expires_at=%s start_at=%s', new.expires_at, v_start);
    end if;
  end if;

  -- Neblokující rezervace (zrušená, vypršelá, prošlá) kapacitu nespotřebuje.
  if not private.reservation_blocks_capacity(new.reservation_status, new.expires_at) then
    return new;
  end if;

  -- Už blokovala, zůstává u stejné akce, ve stejném stavu a nezvětšuje se
  -- (např. zkrácení lhůty, oprava údajů) → obsazenost ani podmínky se nemění.
  if tg_op = 'UPDATE'
     and private.reservation_blocks_capacity(old.reservation_status, old.expires_at)
     and new.event_id = old.event_id
     and new.reservation_status = old.reservation_status
     and new.number_of_spots <= old.number_of_spots then
    return new;
  end if;

  -- V REPEATABLE READ by součet neviděl souběžně potvrzené rezervace.
  if current_setting('transaction_isolation') = 'repeatable read' then
    raise exception using
      errcode = 'P0001',
      message = 'unsupported_isolation_level',
      hint = 'Rezervace vyžadují izolaci READ COMMITTED nebo SERIALIZABLE.';
  end if;

  select e.capacity, e.status
    into v_capacity, v_status
    from public.events e
   where e.id = new.event_id
     for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'event_not_found';
  end if;

  -- Na zrušené/archivované akci nesmí žádná rezervace začít blokovat ani se potvrdit.
  if v_status in ('cancelled', 'archived') then
    raise exception using errcode = 'P0001', message = 'event_not_bookable';
  end if;

  v_blocked := private.blocked_spots(new.event_id, new.id);

  if v_blocked + new.number_of_spots > v_capacity then
    raise exception using
      errcode = 'P0001',
      message = 'not_enough_spots',
      detail  = format('available_spots=%s', greatest(v_capacity - v_blocked, 0));
  end if;

  return new;
end;
$$;

create trigger reservations_enforce_capacity
  before insert or update of reservation_status, expires_at, number_of_spots, event_id
  on public.reservations
  for each row execute function private.enforce_reservation_capacity();

-- -----------------------------------------------------------------------------
-- Ochrana akcí: kapacitu nelze snížit pod obsazenost, časové pásmo musí existovat
-- -----------------------------------------------------------------------------
create function private.validate_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocked integer;
begin
  if tg_op = 'INSERT' or new.timezone is distinct from old.timezone then
    if not exists (select 1 from pg_catalog.pg_timezone_names tz where tz.name = new.timezone) then
      raise exception using errcode = '22023', message = 'invalid_timezone', detail = new.timezone;
    end if;
  end if;

  -- Řádek akce je při UPDATE už zamčený → souběžné rezervace téže akce čekají.
  if tg_op = 'UPDATE' and new.capacity < old.capacity then
    v_blocked := private.blocked_spots(new.id);
    if v_blocked > new.capacity then
      raise exception using
        errcode = 'P0001',
        message = 'capacity_below_reserved',
        detail  = format('blocked_spots=%s', v_blocked);
    end if;
  end if;

  return new;
end;
$$;

create trigger events_validate
  before insert or update on public.events
  for each row execute function private.validate_event();

-- Posunutí začátku akce dříve zkrátí lhůty nezaplacených rezervací na nový začátek,
-- aby čekající rezervace neblokovaly místo po začátku akce.
create function private.clamp_pending_expiry_to_event_start()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reservations r
     set expires_at = new.start_at
   where r.event_id = new.id
     and r.reservation_status = 'pending_payment'
     and r.expires_at > new.start_at;
  return null;
end;
$$;

create trigger events_clamp_pending_expiry
  after update of start_at on public.events
  for each row
  when (new.start_at < old.start_at)
  execute function private.clamp_pending_expiry_to_event_start();

-- -----------------------------------------------------------------------------
-- create_reservation – atomické vytvoření rezervace
--
-- Volá ji výhradně backend (Edge Function `create-reservation` se service_role),
-- který předtím ověří captchu a rate limit a podle platební metody zvolí
-- p_hold a p_payment_cutoff. EXECUTE nemá anon ani authenticated.
-- Obchodní chyby vrací jako { ok: false, code } (shodně s CreateReservationResult
-- ve frontendu), neočekávané chyby jako výjimku.
-- -----------------------------------------------------------------------------
create function public.create_reservation(
  p_event_id        uuid,
  p_customer_name   text,
  p_customer_email  text,
  p_customer_phone  text,
  p_number_of_spots integer,
  p_note            text default null,
  p_hold            interval default interval '48 hours',
  p_payment_cutoff  interval default interval '0 minutes'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name      text := btrim(coalesce(p_customer_name, ''));
  v_email     text := lower(btrim(coalesce(p_customer_email, '')));
  v_phone     text := regexp_replace(btrim(coalesce(p_customer_phone, '')), '[[:space:]]+', ' ', 'g');
  v_note      text := nullif(btrim(coalesce(p_note, '')), '');
  v_event     record;
  v_available integer;
  v_expires   timestamptz;
  v_res       public.reservations;
begin
  -- 1) Kontrola vstupů (stejná pravidla jako src/lib/reservation-validation.ts)
  if char_length(v_name) not between 3 and 200 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input', 'field', 'customer_name');
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_input', 'field', 'customer_email');
  end if;
  if v_phone !~ '^\+?[0-9 ]{9,16}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_input', 'field', 'customer_phone');
  end if;
  if p_number_of_spots is null or p_number_of_spots not between 1 and 20 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input', 'field', 'number_of_spots');
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input', 'field', 'note');
  end if;
  if p_hold is null or p_hold < interval '15 minutes' or p_hold > interval '7 days' then
    return jsonb_build_object('ok', false, 'code', 'invalid_input', 'field', 'hold');
  end if;
  if p_payment_cutoff is null or p_payment_cutoff < interval '0 minutes' or p_payment_cutoff > interval '14 days' then
    return jsonb_build_object('ok', false, 'code', 'invalid_input', 'field', 'payment_cutoff');
  end if;

  -- 2) + 4) Existence a publikace akce, zámek řádku akce
  select e.id, e.capacity, e.status, e.start_at
    into v_event
    from public.events e
   where e.id = p_event_id
     for update;

  if not found or v_event.status <> 'published' then
    return jsonb_build_object('ok', false, 'code', 'event_not_found');
  end if;
  if v_event.start_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'event_not_bookable', 'reason', 'event_started');
  end if;

  -- Lhůta na zaplacení nesmí přesáhnout začátek akce (minus odstup pro danou platební metodu).
  v_expires := private.payment_deadline(v_event.start_at, p_hold, p_payment_cutoff);
  if v_expires is null then
    return jsonb_build_object('ok', false, 'code', 'event_not_bookable', 'reason', 'payment_window_closed');
  end if;

  -- 3) Dostupná kapacita (pod zámkem – souběžné požadavky čekají)
  v_available := greatest(v_event.capacity - private.blocked_spots(p_event_id), 0);
  if p_number_of_spots > v_available then
    return jsonb_build_object(
      'ok', false,
      'code', case when v_available = 0 then 'sold_out' else 'not_enough_spots' end,
      'available_spots', v_available
    );
  end if;

  -- 5) Atomické vytvoření (trigger znovu ověří invariant kapacity)
  for attempt in 1..5 loop
    begin
      insert into public.reservations (
        public_code, event_id, customer_name, customer_email, customer_phone,
        number_of_spots, note, reservation_status, payment_status, expires_at
      ) values (
        private.generate_reservation_code(), p_event_id, v_name, v_email, v_phone,
        p_number_of_spots, v_note, 'pending_payment', 'unpaid', v_expires
      )
      returning * into v_res;
      exit;
    exception when unique_violation then
      -- kolize public_code (velmi nepravděpodobná) → nový pokus
      if attempt = 5 then
        raise;
      end if;
    end;
  end loop;

  -- 7) Výsledek pro API (bez interních polí)
  return jsonb_build_object(
    'ok', true,
    'reservation', jsonb_build_object(
      'id', v_res.id,
      'public_code', v_res.public_code,
      'event_id', v_res.event_id,
      'number_of_spots', v_res.number_of_spots,
      'reservation_status', v_res.reservation_status,
      'payment_status', v_res.payment_status,
      'expires_at', v_res.expires_at,
      'created_at', v_res.created_at
    ),
    'available_spots', v_available - p_number_of_spots
  );
end;
$$;

comment on function public.create_reservation is
  'Atomické vytvoření rezervace. Jen pro backend (service_role) přes Edge Function.';

-- -----------------------------------------------------------------------------
-- set_reservation_status – změna stavu rezervace administrátorkou / backendem
--
-- Mění jen reservation_status (a lhůtu při návratu do pending_payment).
-- payment_status NIKDY nemění: ruční potvrzení administrátorkou neznamená
-- ověřenou platbu. Kdo a kdy stav změnil, se ukládá do status_changed_by/at.
-- -----------------------------------------------------------------------------
create function public.set_reservation_status(
  p_reservation_id uuid,
  p_status         public.reservation_status,
  p_hold           interval default interval '48 hours',
  p_payment_cutoff interval default interval '0 minutes'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id    uuid;
  v_event       record;
  v_res         public.reservations;
  v_new_expires timestamptz;
  v_available   integer;
begin
  -- SECURITY DEFINER → oprávnění se ověřuje explicitně.
  if not (private.is_admin() or private.is_service_role()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  if p_status is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_input', 'field', 'status');
  end if;
  if p_hold is null or p_hold < interval '15 minutes' or p_hold > interval '7 days' then
    return jsonb_build_object('ok', false, 'code', 'invalid_input', 'field', 'hold');
  end if;
  if p_payment_cutoff is null or p_payment_cutoff < interval '0 minutes' or p_payment_cutoff > interval '14 days' then
    return jsonb_build_object('ok', false, 'code', 'invalid_input', 'field', 'payment_cutoff');
  end if;

  -- Pořadí zámků: nejdřív akce, pak rezervace (stejně jako create_reservation) → bez deadlocků.
  select r.event_id into v_event_id from public.reservations r where r.id = p_reservation_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select e.id, e.capacity, e.status, e.start_at
    into v_event
    from public.events e
   where e.id = v_event_id
     for update;
  select * into v_res from public.reservations r where r.id = p_reservation_id for update;

  if v_res.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_res.event_id <> v_event_id then
    -- Rezervace byla mezi čtením a zámkem přesunuta na jinou akci – klient má zopakovat.
    raise exception using errcode = '40001', message = 'concurrent_modification';
  end if;

  -- Povolené přechody
  if p_status = 'pending_payment' and v_res.payment_status = 'paid' then
    return jsonb_build_object('ok', false, 'code', 'invalid_transition',
                              'reason', 'paid_reservation_cannot_wait_for_payment');
  end if;
  if p_status = 'expired' and v_res.reservation_status <> 'pending_payment' then
    return jsonb_build_object('ok', false, 'code', 'invalid_transition',
                              'reason', 'only_pending_payment_can_expire');
  end if;
  if p_status in ('confirmed', 'pending_payment') and v_event.status in ('cancelled', 'archived') then
    return jsonb_build_object('ok', false, 'code', 'event_not_bookable', 'reason', 'event_cancelled');
  end if;

  if p_status = 'pending_payment' then
    v_new_expires := private.payment_deadline(v_event.start_at, p_hold, p_payment_cutoff);
    if v_new_expires is null then
      return jsonb_build_object('ok', false, 'code', 'event_not_bookable', 'reason', 'payment_window_closed');
    end if;
  else
    v_new_expires := v_res.expires_at;
  end if;

  -- Přechod z neblokujícího do blokujícího stavu → znovu ověřit volná místa.
  if not private.reservation_blocks_capacity(v_res.reservation_status, v_res.expires_at)
     and private.reservation_blocks_capacity(p_status, v_new_expires) then
    v_available := greatest(v_event.capacity - private.blocked_spots(v_event.id, v_res.id), 0);
    if v_res.number_of_spots > v_available then
      return jsonb_build_object('ok', false, 'code', 'not_enough_spots', 'available_spots', v_available);
    end if;
  end if;

  -- payment_status se záměrně nemění.
  update public.reservations
     set reservation_status = p_status,
         expires_at = v_new_expires,
         status_changed_at = now(),
         status_changed_by = (select auth.uid())
   where id = p_reservation_id
  returning * into v_res;

  return jsonb_build_object(
    'ok', true,
    'reservation', jsonb_build_object(
      'id', v_res.id,
      'reservation_status', v_res.reservation_status,
      'payment_status', v_res.payment_status,
      'payment_verified', v_res.payment_status = 'paid',
      'expires_at', v_res.expires_at,
      'status_changed_at', v_res.status_changed_at,
      'updated_at', v_res.updated_at
    )
  );
end;
$$;

comment on function public.set_reservation_status is
  'Změna stavu rezervace. Jen administrátorka nebo backend; nikdy nepřekročí kapacitu a nemění stav platby.';

-- -----------------------------------------------------------------------------
-- Expirace nezaplacených rezervací (pro pg_cron, viz SUPABASE_INTEGRATION.md)
-- -----------------------------------------------------------------------------
create function private.expire_pending_reservations()
returns integer
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.reservations
       set reservation_status = 'expired',
           status_changed_at = now(),
           status_changed_by = null
     where reservation_status = 'pending_payment'
       and expires_at <= now()
    returning 1
  )
  select count(*)::integer from expired;
$$;

-- -----------------------------------------------------------------------------
-- Veřejné čtení akcí – jen publikované akce a agregovaná obsazenost
-- -----------------------------------------------------------------------------
create function public.list_public_events()
returns table (
  id                uuid,
  slug              text,
  title             text,
  category          text,
  short_description text,
  description       text,
  start_at          timestamptz,
  end_at            timestamptz,
  timezone          text,
  time_label        text,
  location          text,
  price             numeric,
  currency          text,
  capacity          integer,
  instructor        text,
  bring             text[],
  image_path        text,
  is_demo           boolean,
  available_spots   integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.slug, e.title, e.category, e.short_description, e.description,
         e.start_at, e.end_at, e.timezone, e.time_label, e.location, e.price, e.currency,
         e.capacity, e.instructor, e.bring, e.image_path, e.is_demo,
         greatest(e.capacity - private.blocked_spots(e.id), 0) as available_spots
    from public.events e
   where e.status = 'published'
   order by e.start_at;
$$;

create function public.get_public_event(p_slug text)
returns table (
  id                uuid,
  slug              text,
  title             text,
  category          text,
  short_description text,
  description       text,
  start_at          timestamptz,
  end_at            timestamptz,
  timezone          text,
  time_label        text,
  location          text,
  price             numeric,
  currency          text,
  capacity          integer,
  instructor        text,
  bring             text[],
  image_path        text,
  is_demo           boolean,
  available_spots   integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.slug, e.title, e.category, e.short_description, e.description,
         e.start_at, e.end_at, e.timezone, e.time_label, e.location, e.price, e.currency,
         e.capacity, e.instructor, e.bring, e.image_path, e.is_demo,
         greatest(e.capacity - private.blocked_spots(e.id), 0) as available_spots
    from public.events e
   where e.status = 'published'
     and e.slug = p_slug;
$$;

-- Obsazenost pro administraci. security_invoker → platí RLS volajícího
-- (neadmin uvidí prázdný výsledek, anon nemá oprávnění vůbec).
create view public.admin_event_occupancy
with (security_invoker = true)
as
select e.id as event_id,
       e.capacity,
       coalesce(sum(r.number_of_spots) filter (
         where private.reservation_blocks_capacity(r.reservation_status, r.expires_at)
       ), 0)::integer as blocked_spots
  from public.events e
  left join public.reservations r on r.event_id = e.id
 group by e.id, e.capacity;

-- -----------------------------------------------------------------------------
-- Oprávnění funkcí a pohledů
-- (Supabase ve schématu public uděluje EXECUTE rolím anon/authenticated
--  automaticky – proto vždy nejdřív REVOKE.)
-- -----------------------------------------------------------------------------
revoke all on function private.reservation_blocks_capacity(public.reservation_status, timestamptz, timestamptz) from public;
revoke all on function private.blocked_spots(uuid, uuid) from public;
revoke all on function private.payment_deadline(timestamptz, interval, interval) from public;
revoke all on function private.enforce_reservation_capacity() from public;
revoke all on function private.validate_event() from public;
revoke all on function private.clamp_pending_expiry_to_event_start() from public;
revoke all on function private.expire_pending_reservations() from public;

-- authenticated potřebuje pravidlo blokování pro pohled admin_event_occupancy.
grant execute on function private.reservation_blocks_capacity(public.reservation_status, timestamptz, timestamptz)
  to authenticated, service_role;
grant execute on function private.blocked_spots(uuid, uuid) to service_role;
grant execute on function private.payment_deadline(timestamptz, interval, interval) to service_role;
grant execute on function private.expire_pending_reservations() to service_role;

revoke all on function public.create_reservation(uuid, text, text, text, integer, text, interval, interval)
  from public, anon, authenticated;
grant execute on function public.create_reservation(uuid, text, text, text, integer, text, interval, interval)
  to service_role;

revoke all on function public.set_reservation_status(uuid, public.reservation_status, interval, interval)
  from public, anon;
grant execute on function public.set_reservation_status(uuid, public.reservation_status, interval, interval)
  to authenticated, service_role;

revoke all on function public.list_public_events() from public;
revoke all on function public.get_public_event(text) from public;
grant execute on function public.list_public_events() to anon, authenticated, service_role;
grant execute on function public.get_public_event(text) to anon, authenticated, service_role;

revoke all on public.admin_event_occupancy from anon, authenticated, public;
grant select on public.admin_event_occupancy to authenticated, service_role;
