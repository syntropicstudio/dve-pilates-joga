-- =============================================================================
-- DVĚ – migrace 1/3: základní schéma (typy, tabulky, omezení, indexy)
--
-- Odpovídá TypeScript modelům v src/lib/types.ts (camelCase ↔ snake_case).
-- Oprávnění a RLS řeší migrace 2, rezervační logiku migrace 3.
-- Migrace je čistě aditivní – nic nemaže ani nepřepisuje.
-- =============================================================================

-- Interní schéma pro pomocné a privilegované funkce. Není vystavené přes Data API
-- (config.toml → [api].schemas obsahuje jen public a graphql_public).
create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Výčtové typy (stavové hodnoty shodné s frontendem)
-- -----------------------------------------------------------------------------
create type public.event_status as enum ('draft', 'published', 'cancelled', 'archived');

create type public.reservation_status as enum ('pending_payment', 'confirmed', 'cancelled', 'expired');

create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'refunded', 'failed');

create type public.payment_provider as enum ('qr', 'gopay', 'comgate', 'manual');

create type public.notification_type as enum (
  'reservation_created',
  'payment_instructions',
  'payment_confirmed',
  'reservation_cancelled',
  'event_cancelled',
  'event_reminder',
  'admin_new_reservation'
);

create type public.notification_status as enum ('queued', 'sending', 'sent', 'failed');

-- -----------------------------------------------------------------------------
-- Pomocné funkce
-- -----------------------------------------------------------------------------

-- Automatické updated_at.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Veřejné číslo rezervace ve tvaru R-XXXXXXXX (zobrazuje se zákazníkovi místo UUID).
create function private.generate_reservation_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'R-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

-- -----------------------------------------------------------------------------
-- events – akce, lekce, workshopy, pobyty
-- -----------------------------------------------------------------------------
create table public.events (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null,
  title             text not null,
  category          text not null,
  short_description text not null default '',
  description       text not null default '',
  start_at          timestamptz not null,
  end_at            timestamptz not null,
  timezone          text not null default 'Europe/Prague',
  time_label        text not null,
  location          text not null default '',
  price             numeric(10, 2) not null,
  currency          text not null default 'CZK',
  capacity          integer not null,
  instructor        text,
  bring             text[] not null default '{}',
  image_path        text,
  status            public.event_status not null default 'draft',
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint events_slug_key unique (slug),
  constraint events_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  constraint events_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint events_category_valid check (category in ('joga', 'pilates', 'workshop', 'event', 'pobyt')),
  constraint events_short_description_length check (char_length(short_description) <= 500),
  constraint events_description_length check (char_length(description) <= 10000),
  constraint events_valid_interval check (end_at > start_at),
  constraint events_timezone_not_empty check (char_length(timezone) between 1 and 64),
  constraint events_time_label_length check (char_length(time_label) between 1 and 100),
  constraint events_location_length check (char_length(location) <= 300),
  constraint events_price_non_negative check (price >= 0),
  constraint events_currency_czk check (currency = 'CZK'),
  constraint events_capacity_positive check (capacity > 0 and capacity <= 1000),
  constraint events_instructor_length check (instructor is null or char_length(instructor) <= 200),
  constraint events_image_path_length check (image_path is null or char_length(image_path) <= 1000)
);

comment on table public.events is 'Akce DVĚ. Veřejnost čte jen přes funkce list_public_events/get_public_event.';
comment on column public.events.time_label is 'Čas pro zobrazení na webu (např. „8:30–9:45“); skutečný termín je start_at/end_at.';
comment on column public.events.price is 'Cena za osobu v Kč (numeric, nikdy float).';
comment on column public.events.image_path is 'Cesta v Supabase Storage nebo absolutní URL obrázku.';

create index events_status_start_at_idx on public.events (status, start_at);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- reservations – rezervace zákazníků bez účtu
-- -----------------------------------------------------------------------------
create table public.reservations (
  id                 uuid primary key default gen_random_uuid(),
  public_code        text not null default private.generate_reservation_code(),
  event_id           uuid not null references public.events (id) on delete restrict,
  customer_name      text not null,
  customer_email     text not null,
  customer_phone     text not null,
  number_of_spots    integer not null,
  note               text,
  reservation_status public.reservation_status not null default 'pending_payment',
  payment_status     public.payment_status not null default 'unpaid',
  expires_at         timestamptz,
  -- Audit poslední změny stavu rezervace (kdo a kdy). NULL u změn provedených backendem.
  -- Ruční potvrzení administrátorkou se tak dá odlišit od potvrzení po platbě;
  -- ověřenou platbu vyjadřuje výhradně payment_status = 'paid'.
  status_changed_at  timestamptz,
  status_changed_by  uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint reservations_public_code_key unique (public_code),
  constraint reservations_public_code_format check (public_code ~ '^R-[A-Z0-9]{8}$'),
  constraint reservations_customer_name_length check (char_length(btrim(customer_name)) between 3 and 200),
  constraint reservations_customer_email_format check (
    char_length(customer_email) <= 254 and customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint reservations_customer_phone_format check (customer_phone ~ '^\+?[0-9 ]{9,16}$'),
  constraint reservations_spots_range check (number_of_spots between 1 and 20),
  constraint reservations_note_length check (note is null or char_length(note) <= 1000),
  -- Rezervace čekající na platbu musí mít explicitní expiraci.
  constraint reservations_pending_requires_expiry check (
    reservation_status <> 'pending_payment' or expires_at is not null
  ),
  -- Zaplacená rezervace nesmí zůstat „čekající na platbu“ – jinak by po expires_at
  -- přestala blokovat místo, za které už zákazník zaplatil. Backend musí při
  -- potvrzení platby změnit oba stavy najednou (pozdní platba po expiraci → expired + paid → refundace).
  constraint reservations_paid_not_pending check (
    not (reservation_status = 'pending_payment' and payment_status = 'paid')
  )
);

comment on table public.reservations is 'Rezervace. Obsahuje osobní údaje – čtení jen pro administrátorky (RLS).';
comment on column public.reservations.expires_at is 'Do kdy blokuje rezervace ve stavu pending_payment kapacitu.';

-- Výpočet obsazenosti akce (blokující rezervace).
create index reservations_event_status_idx
  on public.reservations (event_id, reservation_status)
  include (number_of_spots, expires_at);

-- Plánovaná expirace nezaplacených rezervací.
create index reservations_pending_expires_idx
  on public.reservations (expires_at)
  where reservation_status = 'pending_payment';

-- Vyhledávání v administraci.
create index reservations_customer_email_idx on public.reservations (lower(customer_email));
create index reservations_created_at_idx on public.reservations (created_at desc);
-- Cizí klíč na auth.users (on delete set null) – index pro mazání účtu.
create index reservations_status_changed_by_idx
  on public.reservations (status_changed_by)
  where status_changed_by is not null;

create trigger reservations_set_updated_at
  before update on public.reservations
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- payments – platby k rezervacím (zatím bez napojení na bránu)
-- -----------------------------------------------------------------------------
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  reservation_id     uuid not null references public.reservations (id) on delete restrict,
  provider           public.payment_provider not null,
  amount             numeric(10, 2) not null,
  currency           text not null default 'CZK',
  status             public.payment_status not null default 'pending',
  provider_reference text,
  variable_symbol    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint payments_amount_non_negative check (amount >= 0),
  constraint payments_currency_czk check (currency = 'CZK'),
  constraint payments_variable_symbol_format check (variable_symbol is null or variable_symbol ~ '^[0-9]{1,10}$'),
  -- Idempotence webhooků: stejná platba od stejné brány se zapíše jen jednou.
  constraint payments_provider_reference_key unique (provider, provider_reference)
);

comment on table public.payments is 'Platby. Zapisuje výhradně backend (service_role) – nikdy prohlížeč.';

create index payments_reservation_id_idx on public.payments (reservation_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- admin_profiles – administrátorky propojené se Supabase Auth
-- -----------------------------------------------------------------------------
create table public.admin_profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null,
  role         text not null default 'admin',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint admin_profiles_role_valid check (role = 'admin'),
  constraint admin_profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 100)
);

comment on table public.admin_profiles is
  'Seznam administrátorek. Řádky zakládá jen správce (service_role / SQL), nikdy uživatel sám.';

create trigger admin_profiles_set_updated_at
  before update on public.admin_profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- gallery_items – galerie
-- -----------------------------------------------------------------------------
create table public.gallery_items (
  id           uuid primary key default gen_random_uuid(),
  storage_path text,
  image_url    text,
  alt_text     text not null,
  caption      text not null default '',
  ratio        text not null default 'square',
  sort_order   integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint gallery_items_has_image check (storage_path is not null or image_url is not null),
  constraint gallery_items_alt_text_length check (char_length(btrim(alt_text)) between 1 and 300),
  constraint gallery_items_caption_length check (char_length(caption) <= 300),
  constraint gallery_items_ratio_valid check (ratio in ('square', 'tall', 'wide')),
  constraint gallery_items_image_url_https check (image_url is null or image_url ~ '^https://')
);

create index gallery_items_sort_order_idx on public.gallery_items (sort_order) where is_published;

create trigger gallery_items_set_updated_at
  before update on public.gallery_items
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- notification_log – evidence e-mailů (Resend přes Edge Functions)
-- -----------------------------------------------------------------------------
create table public.notification_log (
  id                  uuid primary key default gen_random_uuid(),
  type                public.notification_type not null,
  reservation_id      uuid references public.reservations (id) on delete restrict,
  event_id            uuid references public.events (id) on delete restrict,
  recipient           text not null,
  status              public.notification_status not null default 'queued',
  attempts            integer not null default 0,
  provider_message_id text,
  -- Ochrana proti duplicitnímu odeslání, např. 'reservation_created:<reservation_id>'.
  dedupe_key          text not null,
  last_error          text,
  created_at          timestamptz not null default now(),
  last_attempt_at     timestamptz,
  sent_at             timestamptz,

  constraint notification_log_dedupe_key_key unique (dedupe_key),
  constraint notification_log_has_target check (reservation_id is not null or event_id is not null),
  constraint notification_log_attempts_non_negative check (attempts >= 0),
  constraint notification_log_sent_has_timestamp check (status <> 'sent' or sent_at is not null)
);

create index notification_log_status_idx on public.notification_log (status, last_attempt_at);
create index notification_log_reservation_id_idx on public.notification_log (reservation_id);
create index notification_log_event_id_idx on public.notification_log (event_id);
