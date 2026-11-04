# DVĚ – příprava na integraci Supabase

Tento dokument popisuje, jak je web DVĚ připravený na přechod z demonstračního režimu na skutečný backend (Supabase + Resend + platební brána). **Dnes běží pouze demo režim – žádná databáze ani externí služba není připojená.**

---

## 1. Současná architektura

- **Frontend:** React 19 + TypeScript, TanStack Start/Router, Vite, Tailwind CSS v4.
- **Hosting:** GitHub Pages (statický SPA build `npm run build:pages` → `dist/client`), Lovable náhled (SSR build `npm run build`).
- **Data:** demo režim – ukázková data v `src/data/demo.ts`, změny jen v `localStorage` prohlížeče (klíč `dve-demo-v2`).
- **Načítání dat v UI:** React Query hooky (`src/hooks/data/*`) → repozitáře (`src/data/repositories/*`).
- **Administrace:** `/admin`, výrazně označená jako **nezabezpečené demo**. Žádné heslo ani skrytá URL se nepoužívá jako ochrana.

```
UI (routes, components)
   │  jen hooky, žádný přístup k úložišti
   ▼
src/hooks/data/use-events | use-reservations | use-gallery   (React Query, cache, invalidace)
   │
   ▼
src/services/reservation-service.ts   (vstupní bod pro rezervace)
   │
   ▼
getRepositories()  ← src/data/repositories/index.ts (výběr podle VITE_DATA_SOURCE)
   ├── mock/*       (dnes: localStorage, src/data/repositories/mock/mock-db.ts)
   └── supabase/*   (budoucí implementace)
```

## 2. Struktura datové vrstvy

| Soubor | Účel |
|---|---|
| `src/lib/types.ts` | Doménové modely a české popisky stavů |
| `src/lib/event-schedule.ts` | `startAt`/`endAt` ↔ datum a čas v `Europe/Prague`, formátování termínu, validace času |
| `src/lib/capacity.ts` | Pravidla obsazenosti (`blocksCapacity`, `blockedSpots`) |
| `src/lib/reservation-validation.ts` | Validace rezervačního formuláře (UX + repozitář) |
| `src/data/repositories/types.ts` | Rozhraní `EventRepository`, `ReservationRepository`, `GalleryRepository`, `AuthRepository` |
| `src/data/repositories/index.ts` | `getRepositories()` – jediné místo výběru implementace |
| `src/data/repositories/mock/*` | Demo implementace + `mock-db.ts` (localStorage, migrace v1→v2, simulace expirace) |
| `src/services/reservation-service.ts` | `reservationService.createReservation(input)` |
| `src/services/payments/types.ts` | Kontrakt budoucí platební integrace |
| `src/services/notifications/types.ts` | Kontrakt budoucích e-mailových notifikací |
| `src/config/data-source.ts` | `VITE_DATA_SOURCE` (`mock` / `supabase`) |

Všechny metody repozitářů jsou asynchronní, takže výměna implementace nevyžaduje změny komponent.

## 3. Datové modely

| Model | Klíčová pole |
|---|---|
| `DveEvent` | `id, slug, title, category, shortDescription, description, startAt, endAt, timezone, timeLabel, location, price, currency, capacity, instructor?, bring[], image?, status (draft/published/cancelled/archived), isDemo, createdAt, updatedAt` |
| `PublicEvent` | `DveEvent` + `availableSpots` (agregát, bez osobních údajů) |
| `AdminEvent` | `PublicEvent` + `blockedSpots` |
| `Reservation` | `id, eventId, customerName, customerEmail, customerPhone, numberOfSpots, note?, reservationStatus, paymentStatus, expiresAt?, createdAt, updatedAt` |
| `GalleryItem` | `id, caption, src?, storagePath?, ratio, sortOrder` |
| `AdminProfile` | `id (= auth.users.id), email, displayName, role` |
| `Payment` | `id, reservationId, method (qr/gopay/comgate/manual), amount, currency, status, providerReference?, createdAt, updatedAt` |
| `SiteSettings` *(zatím jen návrh)* | kontakty a odkazy, dnes v `src/config/site.ts` |

**Stavy rezervace:** `pending_payment` (Čeká na platbu), `confirmed` (Potvrzená), `cancelled` (Zrušená), `expired` (Vypršela).
**Stavy platby:** `unpaid`, `pending`, `paid`, `refunded`, `failed`.

**Pravidlo obsazenosti** (`src/lib/capacity.ts`):
- `confirmed` blokuje kapacitu vždy,
- `pending_payment` blokuje kapacitu jen do `expiresAt` (demo: 48 h),
- `cancelled` a `expired` kapacitu neblokují.

`timeLabel` je text zobrazovaný na webu („8:30–9:45“). Při ukládání akce se z něj odvodí `startAt`/`endAt`; pokud čas nelze určit jednoznačně (musí obsahovat právě dva časy H:MM), formulář uložení odmítne – žádné automatické 00:00.

Zákazníci **nemají účty**. Přihlášení je jen pro administrátorky.

## 4. Návrh databázových tabulek

```sql
create type event_status as enum ('draft','published','cancelled','archived');
create type reservation_status as enum ('pending_payment','confirmed','cancelled','expired');
create type payment_status as enum ('unpaid','pending','paid','refunded','failed');
create type payment_method as enum ('qr','gopay','comgate','manual');

create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null check (category in ('joga','pilates','workshop','event','pobyt')),
  short_description text not null default '',
  description text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  timezone text not null default 'Europe/Prague',
  time_label text not null,
  location text not null default '',
  price integer not null check (price >= 0),          -- v Kč
  currency text not null default 'CZK',
  capacity integer not null check (capacity > 0),
  instructor text,
  bring text[] not null default '{}',
  image_path text,                                      -- Supabase Storage
  status event_status not null default 'draft',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,                     -- např. R-8F3K2Q (zobrazuje se zákazníkovi)
  event_id uuid not null references events(id) on delete restrict,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  number_of_spots integer not null check (number_of_spots between 1 and 20),
  note text check (char_length(note) <= 1000),
  reservation_status reservation_status not null default 'pending_payment',
  payment_status payment_status not null default 'unpaid',
  expires_at timestamptz,
  cancel_token_hash text,                               -- pro budoucí zrušení odkazem z e-mailu
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on reservations (event_id, reservation_status);

create table payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete restrict,
  method payment_method not null,
  amount integer not null,
  currency text not null default 'CZK',
  status payment_status not null default 'pending',
  provider_reference text,
  variable_symbol text,
  raw_webhook jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (method, provider_reference)                   -- idempotence webhooků
);

create table gallery_items (
  id uuid primary key default gen_random_uuid(),
  caption text not null,
  storage_path text,
  ratio text not null check (ratio in ('square','tall','wide')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null default 'admin' check (role = 'admin')
);

create table notification_log (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  reservation_id uuid references reservations(id),
  event_id uuid references events(id),
  recipient text not null,
  status text not null default 'queued',
  provider_message_id text,
  created_at timestamptz not null default now(),
  unique (type, reservation_id)                         -- stejný e-mail se nepošle dvakrát
);

create table site_settings (
  key text primary key,
  value jsonb not null
);
```

Veřejný pohled s obsazeností (bez osobních údajů):

```sql
create view public_events with (security_invoker = false) as
select e.id, e.slug, e.title, e.category, e.short_description, e.description,
       e.start_at, e.end_at, e.timezone, e.time_label, e.location, e.price, e.currency,
       e.capacity, e.instructor, e.bring, e.image_path, e.is_demo,
       greatest(0, e.capacity - coalesce((
         select sum(r.number_of_spots) from reservations r
         where r.event_id = e.id
           and (r.reservation_status = 'confirmed'
                or (r.reservation_status = 'pending_payment' and (r.expires_at is null or r.expires_at > now())))
       ), 0))::int as available_spots
from events e
where e.status = 'published';
```

## 5. Vztahy mezi tabulkami

- `events 1 : N reservations` (`on delete restrict` – akce s rezervacemi se nemaže, ruší se stavem `cancelled`).
- `reservations 1 : N payments` (opakované pokusy o platbu).
- `reservations 1 : N notification_log`.
- `auth.users 1 : 1 admin_profiles`.
- `gallery_items` a `site_settings` jsou samostatné.

## 6. Autentizace

- **Supabase Auth** pouze pro administrátorky (e-mail + heslo nebo magic link, doporučeno MFA).
- Registrace veřejně vypnutá; účty zakládá správce v Supabase dashboardu a přidá řádek do `admin_profiles`.
- Funkce `is_admin()`:
  ```sql
  create function is_admin() returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from admin_profiles where id = auth.uid());
  $$;
  ```
- Ve frontendu nahradí `MockAuthRepository` implementace `SupabaseAuthRepository` (`supabase.auth.getSession()`), `/admin` při chybějící relaci zobrazí přihlášení. **Skutečnou ochranu dat zajišťuje RLS, ne frontend.**

## 7. Doporučené RLS politiky

```sql
alter table events enable row level security;
alter table reservations enable row level security;
alter table payments enable row level security;
alter table gallery_items enable row level security;
alter table admin_profiles enable row level security;
alter table notification_log enable row level security;
alter table site_settings enable row level security;

-- Veřejnost: jen publikované akce (přes view public_events), galerie a nastavení ke čtení
create policy "public read published events" on events for select to anon, authenticated using (status = 'published');
create policy "public read gallery" on gallery_items for select to anon, authenticated using (true);
create policy "public read settings" on site_settings for select to anon, authenticated using (true);

-- Administrátorky: plný přístup
create policy "admin all events" on events for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin all reservations" on reservations for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin read payments" on payments for select to authenticated using (is_admin());
create policy "admin all gallery" on gallery_items for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin read notifications" on notification_log for select to authenticated using (is_admin());
create policy "admin read own profile" on admin_profiles for select to authenticated using (id = auth.uid());
```

- Role `anon` **nemá žádnou politiku pro `reservations` ani `payments`** → rezervace vznikají jen přes RPC/Edge Function, osobní údaje nejsou veřejně čitelné.
- `payments` zapisuje pouze `service_role` (Edge Functions / webhooky).
- Storage bucket `gallery` / `events`: veřejné čtení, zápis jen `is_admin()`.

## 8. Bezpečné vytváření rezervací

Postup v produkci:

1. Formulář → `reservationService.createReservation(input)` → `SupabaseReservationRepository.create()` → `supabase.functions.invoke('create-reservation')`.
2. Edge Function `create-reservation`:
   - ověří captcha token (Cloudflare Turnstile / hCaptcha) a rate-limit (IP + e-mail),
   - znovu zvaliduje vstup (stejná pravidla jako `src/lib/reservation-validation.ts`),
   - zavolá RPC `create_reservation` (service role),
   - zařadí notifikace (`reservation_created`, `payment_instructions`, `admin_new_reservation`).
3. RPC provede kontrolu kapacity **atomicky**:

```sql
create function create_reservation(
  p_event_id uuid, p_name text, p_email text, p_phone text, p_spots int, p_note text, p_hold interval default '48 hours'
) returns reservations language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_blocked int;
  v_res reservations;
begin
  -- zamkne řádek akce → souběžné rezervace stejné akce se seřadí za sebe
  select * into v_event from events where id = p_event_id and status = 'published' for update;
  if not found then raise exception 'event_not_found'; end if;

  select coalesce(sum(number_of_spots), 0) into v_blocked from reservations
   where event_id = p_event_id
     and (reservation_status = 'confirmed'
          or (reservation_status = 'pending_payment' and (expires_at is null or expires_at > now())));

  if v_blocked + p_spots > v_event.capacity then
    raise exception 'not_enough_spots' using detail = (v_event.capacity - v_blocked)::text;
  end if;

  insert into reservations (public_code, event_id, customer_name, customer_email, customer_phone,
                            number_of_spots, note, expires_at)
  values ('R-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)), p_event_id, p_name, p_email, p_phone,
          p_spots, p_note, now() + p_hold)
  returning * into v_res;
  return v_res;
end $$;
revoke all on function create_reservation from public, anon, authenticated;
```

4. Plánovaná úloha (`pg_cron`, např. každých 5 min) přepne prošlé `pending_payment` na `expired` a zařadí e-mail. V demu tuto úlohu simuluje `expireStale()` v `mock-db.ts`.
5. Frontend **nikdy** nerozhoduje o dostupnosti – zobrazené `availableSpots` jsou jen informativní.
6. **Změna stavu administrátorkou** (`ReservationRepository.updateStatus`) musí jít přes RPC `set_reservation_status` se stejným zámkem `FOR UPDATE` na akci: přechod z neblokujícího stavu (`cancelled`, `expired`, prošlé `pending_payment`) do blokujícího (`confirmed`, `pending_payment`) znovu ověří kapacitu a při nedostatku skončí chybou. Mock (`MockReservationRepository.updateStatus`) se chová stejně a vyhazuje `RepositoryError`, kterou administrace zobrazí.

**Zrušení rezervace zákazníkem:** odkaz v e-mailu s jednorázovým tokenem (`cancel_token_hash`), Edge Function `cancel-reservation` ověří token a změní stav.

## 9. Integrace Resend

- E-maily odesílají výhradně Edge Functions (`send-notification`) s `RESEND_API_KEY` uloženým v **Supabase secrets**.
- Spouštění: z `create-reservation`, z platebního webhooku, z `pg_cron` (připomenutí 24 h před akcí) a z admin akcí (zrušení akce).
- Typy notifikací: viz `src/services/notifications/types.ts` (`reservation_created`, `payment_instructions`, `payment_confirmed`, `reservation_cancelled`, `event_cancelled`, `event_reminder`, `admin_new_reservation`).
- Každé odeslání se zapíše do `notification_log` (unikátní `type + reservation_id` = idempotence).
- Doména odesílatele musí mít nastavené SPF, DKIM a DMARC.
- Frontend nikdy nezobrazuje „e-mail byl odeslán“, pokud to nepotvrdil backend.

## 10. Integrace plateb

- Kontrakt: `src/services/payments/types.ts` (`PaymentGateway`, `PaymentInstructions`).
- **QR platba (převod):** Edge Function vygeneruje SPAYD řetězec s variabilním symbolem; párování přes bankovní API / ruční potvrzení adminem (`method = 'manual'`).
- **GoPay / Comgate:** Edge Function `start-payment` založí platbu u brány (tajné klíče jen v secrets) a vrátí `redirectUrl`. Brána volá webhook `payment-webhook`, který:
  - ověří podpis / dotáže se brány na skutečný stav,
  - idempotentně zapíše `payments` (unikátní `provider_reference`),
  - při `paid` nastaví `reservation.payment_status = 'paid'` a `reservation_status = 'confirmed'`,
  - zařadí e-mail `payment_confirmed`.
- Návratová URL z brány do prohlížeče **nic nepotvrzuje** – jen zobrazí stav načtený z backendu.
- Pozdní platba po `expires_at`: webhook ověří volnou kapacitu; když už není, vrácení peněz (`refunded`) a upozornění adminů.

## 11. Postup přechodu z mock dat na Supabase

1. Založit Supabase projekt (region EU), spustit SQL z kapitol 4, 7 a 8 jako migrace (`supabase/migrations`).
2. Vytvořit Storage buckety, nahrát fotky a naplnit `events`/`gallery_items` (bez `is_demo`).
3. `npm i @supabase/supabase-js` a vytvořit `src/lib/supabase-client.ts` (jen `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`).
4. Implementovat `src/data/repositories/supabase/`:
   - `SupabaseEventRepository` – `listPublished` / `getPublishedBySlug` z view `public_events`, admin metody z `events`,
   - `SupabaseReservationRepository` – `create` přes Edge Function, admin metody přes tabulku (RLS),
   - `SupabaseGalleryRepository`, `SupabaseAuthRepository`.
   - Mapování `snake_case` ↔ `camelCase` v repozitářích, ne v UI.
5. V `getRepositories()` doplnit větev `supabase` a nastavit `VITE_DATA_SOURCE=supabase` (GitHub Actions → Variables).
6. Do `/admin` doplnit přihlašovací obrazovku (vzhled schválit) a skrýt demo banner a tlačítko „Resetovat demo data“ (už dnes se zobrazuje jen při `resetDemo` v mock režimu).
7. Upravit texty „ukázková akce / demo“ podle skutečné nabídky (po schválení).
8. Přidat Edge Functions `create-reservation`, `cancel-reservation`, `start-payment`, `payment-webhook`, `send-notification` a `pg_cron` úlohy.
9. GitHub Pages zůstává beze změny – backend běží v Supabase, žádný vlastní Node server.
10. Pokud je potřeba, rozšířit `scripts/github-pages.mjs` (dnes předgeneruje stránky jen pro demo slugy; ostatní cesty obslouží `404.html` SPA fallback).

## 12. Proměnné prostředí

| Proměnná | Kde | Veřejná? |
|---|---|---|
| `VITE_DATA_SOURCE` | frontend (`.env`, GitHub Actions Variables) | ano – `mock` / `supabase` |
| `VITE_SUPABASE_URL` | frontend | ano |
| `VITE_SUPABASE_ANON_KEY` | frontend | ano (publishable klíč; ochranu zajišťuje RLS) |
| `VITE_TURNSTILE_SITE_KEY` | frontend | ano |
| `SUPABASE_SERVICE_ROLE_KEY` | jen Supabase Edge Functions | **NE** |
| `RESEND_API_KEY` | Supabase secrets | **NE** |
| `RESEND_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAILS` | Supabase secrets | ne |
| `TURNSTILE_SECRET_KEY` | Supabase secrets | **NE** |
| `GOPAY_CLIENT_ID`, `GOPAY_CLIENT_SECRET`, `GOPAY_GOID` | Supabase secrets | **NE** |
| `COMGATE_MERCHANT_ID`, `COMGATE_SECRET` | Supabase secrets | **NE** |
| `PAYMENT_BANK_ACCOUNT` (QR) | Supabase secrets / `site_settings` | ne |

Vše s prefixem `VITE_` se dostane do veřejného JavaScriptu – **nikdy tam nedávat tajné klíče**. Vzor je v `.env.example`; `.env` je v `.gitignore`.

## 13. Bezpečnostní kroky před produkčním spuštěním

- [ ] RLS zapnuté na všech tabulkách, ověřené testy jako `anon` (nesmí číst `reservations`, `payments`, `admin_profiles`).
- [ ] `create_reservation` dostupná jen přes Edge Function (revoke pro `anon`/`authenticated`).
- [ ] Souběžný test přeplnění (např. 20 paralelních rezervací na poslední místo).
- [ ] Captcha + rate-limit na rezervačním endpointu, limit `number_of_spots`, délky polí.
- [ ] Platební webhooky ověřují podpis a jsou idempotentní; stav platby nikdy z prohlížeče.
- [ ] Tajné klíče jen v Supabase secrets; kontrola, že build neobsahuje `service_role` ani `RESEND_API_KEY`.
- [ ] Admin účty s MFA, veřejná registrace vypnutá.
- [ ] GDPR: zásady zpracování osobních údajů, souhlas ve formuláři (nahradit demo text), doba uchování rezervací a jejich anonymizace, smlouvy o zpracování (Supabase, Resend, platební brána), region EU.
- [ ] Odstranit demo data, demo banner, „Resetovat demo data“ a `localStorage` úložiště z produkčního buildu.
- [ ] Zálohy databáze (PITR) a monitoring chyb Edge Functions.
- [ ] CORS Edge Functions omezit na produkční doménu.
- [ ] Ověřit build GitHub Pages pod podadresářem i vlastní doménou.

## Poznámka: migrace demo dat v prohlížeči (v1 → v2)

- Klíč `dve-demo-v1` se při migraci jen čte, nikdy se nemaže. Slouží jako záloha. Jakmile existuje `dve-demo-v2`, v1 se ignoruje.
- Neplatný záznam se přeskočí a zbytek dat zůstane (varování v konzoli). Nečitelná data v2 se před návratem k výchozím odloží do `dve-demo-v2-backup`.
- Akce z v1, u kterých nelze z textu času jednoznačně určit začátek a konec, **nedostanou vymyšlený termín**. Zůstanou v `unscheduledEvents`, administrace je zobrazí se stavem „Doplň čas akce“ a po doplnění času se z nich stane běžná akce se stejným id i navázanými rezervacemi. Na veřejném webu se do té doby nezobrazují.
- Rezervace z v1 ve stavu „nova“ / „čeká na platbu“ dostanou `pending_payment` **bez** `expiresAt`. Blokují místo, dokud admin nezmění stav, stejně jako dřív.
- Pro Supabase je tato migrace irelevantní: produkční data se do databáze z `localStorage` nepřenášejí.
