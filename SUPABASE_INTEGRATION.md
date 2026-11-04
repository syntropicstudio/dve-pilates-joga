# DVĚ – příprava na integraci Supabase

Tento dokument popisuje, jak je web DVĚ připravený na přechod z demonstračního režimu na skutečný backend (Supabase + Resend + platební brána). **Dnes běží pouze demo režim – frontend není připojený k žádné databázi ani externí službě.** Databázové schéma Supabase je připravené jako verzované migrace a otestované lokálně (kapitoly 4–9), do vzdáleného projektu zatím nasazené není.

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
| `SiteSettings` *(zatím jen návrh, v DB zatím není)* | kontakty a odkazy, dnes v `src/config/site.ts` |

**Stavy rezervace:** `pending_payment` (Čeká na platbu), `confirmed` (Potvrzená), `cancelled` (Zrušená), `expired` (Vypršela).
**Stavy platby:** `unpaid`, `pending`, `paid`, `refunded`, `failed`.

**Pravidlo obsazenosti** (`src/lib/capacity.ts`):
- `confirmed` blokuje kapacitu vždy,
- `pending_payment` blokuje kapacitu jen do `expiresAt` (demo: 48 h),
- `cancelled` a `expired` kapacitu neblokují.

`timeLabel` je text zobrazovaný na webu („8:30–9:45“). Při ukládání akce se z něj odvodí `startAt`/`endAt`; pokud čas nelze určit jednoznačně (musí obsahovat právě dva časy H:MM), formulář uložení odmítne – žádné automatické 00:00.

Zákazníci **nemají účty**. Přihlášení je jen pro administrátorky.

## 4. Databáze Supabase – implementované schéma

> **Stav:** SQL migrace jsou připravené a otestované **pouze lokálně** (Docker). Do vzdáleného projektu `DVE_PRODUCTION` **nebyly nasazeny** a frontend na ně není napojený (`VITE_DATA_SOURCE=mock`).

### 4.1 Migrace (`supabase/migrations/`)

| Soubor | Obsah |
|---|---|
| `20261104130000_core_schema.sql` | schéma `private`, výčtové typy, tabulky, CHECK omezení, cizí klíče, indexy, triggery `updated_at` |
| `20261104130100_auth_rls_grants.sql` | `private.is_admin()`, `private.is_service_role()`, odebrání výchozích GRANTů, minimální GRANTy, RLS politiky |
| `20261104130200_reservation_logic.sql` | pravidlo obsazenosti, trigger invariantu kapacity, ochrana akcí, `create_reservation`, `set_reservation_status`, expirace, veřejné čtecí funkce, pohled `admin_event_occupancy` |

Další soubory:

| Soubor | Účel |
|---|---|
| `supabase/seed.sql` | 5 ukázkových akcí (shodné s `src/data/demo.ts`) – **jen lokálně** při `db reset`, bez osobních údajů a účtů |
| `supabase/tests/database/01_schema_constraints.test.sql` | pgTAP: struktura, typy, FK, CHECK omezení (35 testů) |
| `supabase/tests/database/02_permissions_rls.test.sql` | pgTAP: GRANT, RLS, role anon / uživatel / admin, SECURITY DEFINER (46 testů) |
| `supabase/tests/database/03_reservation_logic.test.sql` | pgTAP: rezervace, kapacita, expirace, změny stavu (30 testů) |
| `supabase/tests/database/04_pre_deploy_regressions.test.sql` | pgTAP: regrese z kontroly před nasazením – lhůta vs. začátek akce, stav rezervace × platba, allowlist oprávnění funkcí, zrušená akce (30 testů) |
| `supabase/tests/concurrency/last_spot.sh` | skutečný souběh paralelních transakcí, scénáře A–C (lokální Docker) |

Migrace jsou čistě aditivní (žádné `drop`, `truncate` ani mazání dat).

### 4.2 Výčtové typy

| Typ | Hodnoty |
|---|---|
| `event_status` | `draft`, `published`, `cancelled`, `archived` |
| `reservation_status` | `pending_payment`, `confirmed`, `cancelled`, `expired` |
| `payment_status` | `unpaid`, `pending`, `paid`, `refunded`, `failed` |
| `payment_provider` | `qr`, `gopay`, `comgate`, `manual` |
| `notification_type` | `reservation_created`, `payment_instructions`, `payment_confirmed`, `reservation_cancelled`, `event_cancelled`, `event_reminder`, `admin_new_reservation` |
| `notification_status` | `queued`, `sending`, `sent`, `failed` |

### 4.3 Tabulky

**`events`** – akce.
`id uuid PK`, `slug` (unikátní, `^[a-z0-9]+(-[a-z0-9]+)*$`), `title`, `category` (`joga|pilates|workshop|event|pobyt`), `short_description`, `description`, `start_at`/`end_at timestamptz` (`end_at > start_at`), `timezone` (ověřeno proti `pg_timezone_names`), `time_label` (text pro web), `location`, `price numeric(10,2) ≥ 0`, `currency = 'CZK'`, `capacity 1–1000`, `instructor`, `bring text[]`, `image_path`, `status event_status`, `is_demo`, `created_at`, `updated_at`.

**`reservations`** – rezervace zákazníků bez účtu.
`id uuid PK`, `public_code` (unikátní `R-XXXXXXXX`, zobrazuje se zákazníkovi), `event_id → events` (`on delete restrict`), `customer_name` (3–200), `customer_email` (formát, ≤ 254), `customer_phone` (`^\+?[0-9 ]{9,16}$`), `number_of_spots 1–20`, `note ≤ 1000`, `reservation_status`, `payment_status`, `expires_at`, `status_changed_at`, `status_changed_by → auth.users` (`on delete set null`; kdo naposledy změnil stav, `NULL` = backend), `created_at`, `updated_at`.
Omezení:
- `reservations_pending_requires_expiry` – **`pending_payment` musí mít `expires_at`**,
- `reservations_paid_not_pending` – **zaplacená rezervace nesmí zůstat `pending_payment`** (po expiraci by přestala blokovat zaplacené místo); backend při potvrzení platby mění oba stavy najednou,
- `expires_at` čekající rezervace **nesmí být po začátku akce** (hlídá trigger, `P0001 expiry_after_event_start`).

**`payments`** – platby (zatím bez brány).
`id`, `reservation_id → reservations` (`restrict`), `provider`, `amount numeric(10,2) ≥ 0`, `currency = 'CZK'`, `status`, `provider_reference`, `variable_symbol`, časová razítka. **Unikátní `(provider, provider_reference)`** = idempotence webhooků.

**`admin_profiles`** – administrátorky.
`id uuid PK → auth.users(id)` (`on delete cascade`), `email`, `display_name`, `role` (`= 'admin'`), časová razítka. Řádky zakládá jen správce (SQL / service_role).

**`gallery_items`** – galerie.
`id`, `storage_path` nebo `image_url` (alespoň jedno, URL jen `https://`), `alt_text` (povinný), `caption`, `ratio` (`square|tall|wide`), `sort_order`, `is_published`, časová razítka.

**`notification_log`** – evidence e-mailů.
`id`, `type`, `reservation_id`/`event_id` (alespoň jedno), `recipient`, `status`, `attempts ≥ 0`, `provider_message_id`, **`dedupe_key` (unikátní)** – ochrana proti duplicitnímu odeslání (např. `reservation_created:<reservation_id>`), `last_error`, `created_at`, `last_attempt_at`, `sent_at` (povinné u `sent`).

### 4.4 Vazby a indexy

- `events 1:N reservations` (restrict – akce s rezervacemi se nemaže, ruší se stavem `cancelled`).
- `reservations 1:N payments`, `reservations 1:N notification_log`, `events 1:N notification_log` (vše restrict).
- `auth.users 1:1 admin_profiles` (cascade – smazání účtu odebere i admin profil).

| Index | Účel |
|---|---|
| `events_status_start_at_idx (status, start_at)` | veřejný seznam publikovaných akcí |
| `reservations_event_status_idx (event_id, reservation_status) include (number_of_spots, expires_at)` | výpočet obsazenosti |
| `reservations_pending_expires_idx (expires_at) where pending_payment` | plánovaná expirace |
| `reservations_customer_email_idx (lower(customer_email))`, `reservations_created_at_idx` | administrace |
| `reservations_status_changed_by_idx (status_changed_by) where not null` | cizí klíč na `auth.users` |
| `payments_reservation_id_idx`, `notification_log_*_idx`, `gallery_items_sort_order_idx` | vazby a řazení |

## 5. Oprávnění a Row Level Security

### 5.1 Role

| Role | Kdo | Přístup |
|---|---|---|
| `anon` | veřejný návštěvník | **žádná přímá tabulka** kromě publikované galerie; akce jen přes `list_public_events()` / `get_public_event(slug)` |
| `authenticated` bez profilu | přihlášený uživatel, který není admin | nevidí nic (RLS vrací prázdné výsledky) |
| `authenticated` + `admin_profiles` | administrátorka | správa akcí a galerie, čtení rezervací/plateb/notifikací, oprava kontaktů a poznámky, změna stavu přes `set_reservation_status` |
| `service_role` | backend (Edge Functions) | plný přístup, obchází RLS; **nikdy ne v prohlížeči** |

Supabase při vytvoření tabulky/funkce ve schématu `public` automaticky uděluje práva rolím `anon` a `authenticated`. Migrace proto **nejdřív vše odebírají (`revoke all`) a pak udělují jen nutné minimum**. Totéž musí dodržet každá další migrace.

### 5.2 GRANT (tabulková / sloupcová oprávnění)

| Objekt | anon | authenticated | service_role |
|---|---|---|---|
| `events` | – | select, insert, update, delete (RLS: jen admin) | vše |
| `reservations` | – | select; **update jen** `customer_name, customer_email, customer_phone, note` (RLS: jen admin) | vše |
| `payments` | – | select (RLS: jen admin) | vše |
| `admin_profiles` | – | select (RLS: jen vlastní řádek) | vše |
| `gallery_items` | select (RLS: publikované) | select, insert, update, delete (RLS: admin; čtení publikovaných všem) | vše |
| `notification_log` | – | select (RLS: jen admin) | vše |
| `admin_event_occupancy` (pohled) | – | select (security_invoker → RLS) | select |

Důsledky:
- Administrátorka **nemůže** přímo měnit `reservation_status` (jen funkcí s kontrolou kapacity) ani `payment_status` (jen backend po ověření platby), `expires_at`, `number_of_spots` a audit `status_changed_*`.
- Nikdo kromě service_role nemůže zapsat `admin_profiles` → **roli admina si nelze přidělit z frontendu**.
- Rezervace nelze mazat (jen rušit stavem); vytvářejí se výhradně funkcí `create_reservation`.

### 5.3 RLS politiky

RLS je zapnuté na všech tabulkách `public` (ověřuje test). Admin oprávnění se ověřuje funkcí `private.is_admin()` (`exists` v `admin_profiles` pro `auth.uid()`), volanou jako `(select private.is_admin())` kvůli výkonu.

| Tabulka | Politiky |
|---|---|
| `events` | admin: select / insert / update / delete |
| `reservations` | admin: select, update (sloupce omezuje GRANT) |
| `payments`, `notification_log` | admin: select |
| `admin_profiles` | authenticated: select vlastního řádku (`id = auth.uid()`) |
| `gallery_items` | anon: select `is_published`; authenticated: select `is_published or is_admin()`; admin: insert / update / delete |

### 5.4 SQL funkce

| Funkce | Typ | EXECUTE | Popis |
|---|---|---|---|
| `public.list_public_events()` | SECURITY DEFINER, stable | anon, authenticated, service_role | publikované akce + `available_spots`; **žádné osobní ani interní údaje** |
| `public.get_public_event(slug)` | SECURITY DEFINER, stable | anon, authenticated, service_role | jedna publikovaná akce podle slugu |
| `public.create_reservation(..., p_hold, p_payment_cutoff)` | SECURITY INVOKER | **jen service_role** | atomické vytvoření rezervace (kap. 6) |
| `public.set_reservation_status(id, status, hold, payment_cutoff)` | SECURITY DEFINER | authenticated, service_role | uvnitř kontroluje `is_admin()` nebo service_role, jinak `42501 forbidden`; **nemění stav platby** |
| `private.is_admin()` | SECURITY DEFINER | authenticated, service_role | je přihlášený uživatel admin? |
| `private.is_service_role()` | invoker | authenticated, service_role | skutečná DB role (`current_setting('role')`), **ne** JWT claims, které jdou v SQL přepsat |
| `private.reservation_blocks_capacity(...)` | invoker | authenticated, service_role | pravidlo obsazenosti |
| `private.payment_deadline(start, hold, cutoff)` | invoker | service_role | lhůta na zaplacení, nejpozději začátek akce |
| `private.blocked_spots(event_id, exclude)` | SECURITY DEFINER | service_role | součet blokovaných míst (jen číslo) |
| `private.expire_pending_reservations()` | SECURITY DEFINER | service_role | přepne prošlé `pending_payment` → `expired` |
| `private.enforce_reservation_capacity()`, `private.validate_event()`, `private.clamp_pending_expiry_to_event_start()`, `private.set_updated_at()` | triggery | – | invariant kapacity a lhůty, kontrola akcí, zkrácení lhůt při posunu akce, `updated_at` |

Všechny funkce mají `set search_path = ''` a plně kvalifikované názvy objektů; SECURITY DEFINER funkce vlastní `postgres`. Test `04_pre_deploy_regressions` hlídá **allowlist**: `anon` smí spustit jen `list_public_events` a `get_public_event`, `authenticated` navíc jen `set_reservation_status`, `is_admin`, `is_service_role` a `reservation_blocks_capacity`; seznam SECURITY DEFINER funkcí odpovídá tabulce výše. Schéma `private` není vystavené přes Data API (`config.toml` → `[api].schemas = public, graphql_public`) a `anon` k němu nemá `USAGE`.

## 6. Atomické rezervace a obsazenost

### 6.1 Pravidlo obsazenosti

Shodné s `src/lib/capacity.ts` (`private.reservation_blocks_capacity`):
- `confirmed` blokuje kapacitu vždy,
- `pending_payment` blokuje jen do `expires_at`,
- `cancelled` a `expired` neblokují.

### 6.2 `create_reservation`

```
public.create_reservation(
  p_event_id uuid, p_customer_name text, p_customer_email text, p_customer_phone text,
  p_number_of_spots integer, p_note text default null,
  p_hold interval default '48 hours', p_payment_cutoff interval default '0 minutes'
) returns jsonb
```

1. **Kontrola a normalizace vstupů:** trim, e-mail malými písmeny, sjednocení mezer v telefonu, místa 1–20, poznámka ≤ 1000, lhůta 15 min – 7 dní, odstup 0 – 14 dní.
2. **Zamčení řádku akce** `SELECT … FOR UPDATE` – souběžné požadavky na stejnou akci čekají ve frontě.
3. Ověření, že akce je `published` a ještě nezačala.
4. **Lhůta na zaplacení** `expires_at = least(now() + p_hold, start_at − p_payment_cutoff)` – nikdy po začátku akce. Zbývá-li méně než 15 minut, rezervace se nevytvoří (`event_not_bookable`, `reason: payment_window_closed`).
5. Výpočet volných míst **pod zámkem**.
6. Vložení rezervace (`pending_payment`, `unpaid`). Případná kolize `public_code` se zkusí znovu.

**Konfigurace podle platební metody** (volí Edge Function, DB jen hlídá meze):

| Metoda | Příklad `p_hold` | Příklad `p_payment_cutoff` | Důvod |
|---|---|---|---|
| QR / bankovní převod | 48 h | 24 h | převod trvá; platba musí dorazit před akcí |
| platební brána (GoPay, Comgate) | 30 min | 0 | platba je okamžitá |
| výchozí | 48 h | 0 | lhůta nejpozději do začátku akce |
6. Výsledek ve tvaru vhodném pro API:

```json
{ "ok": true, "reservation": { "id": "…", "public_code": "R-…", "reservation_status": "pending_payment", "payment_status": "unpaid", "expires_at": "…" }, "available_spots": 1 }
{ "ok": false, "code": "invalid_input", "field": "customer_email" }
{ "ok": false, "code": "not_enough_spots", "available_spots": 1 }
{ "ok": false, "code": "sold_out", "available_spots": 0 }
{ "ok": false, "code": "event_not_found" }      // neexistuje / není publikovaná / zrušená
{ "ok": false, "code": "event_not_bookable", "reason": "event_started" }
{ "ok": false, "code": "event_not_bookable", "reason": "payment_window_closed" }
```

Kódy odpovídají `ReservationErrorCode` ve frontendu.

### 6.3 Invariant kapacity (trigger)

Trigger `reservations_enforce_capacity` (before insert / update stavu, expirace, počtu míst nebo akce) **znovu zamkne akci a ověří, že obsazenost nepřekročí kapacitu** – při každé změně stavu do blokujícího, zvětšení počtu míst nebo přesunu na jinou akci. Ochrana tak platí i pro přímé zápisy (service_role, budoucí funkce, ruční SQL). Chyby: `P0001 not_enough_spots`, `event_not_bookable` (zrušená/archivovaná akce – nelze ani potvrdit čekající rezervaci), `expiry_after_event_start`.

Trigger `events_validate` brání **snížení kapacity pod aktuální obsazenost** (`P0001 capacity_below_reserved`) a ukládání neexistujícího časového pásma. Trigger `events_clamp_pending_expiry` při **posunutí začátku akce dříve** zkrátí lhůty čekajících rezervací na nový začátek.

Souběh vyžaduje izolaci `READ COMMITTED` (výchozí v Supabase) nebo `SERIALIZABLE`; v `REPEATABLE READ` trigger operaci odmítne.

### 6.4 `set_reservation_status`

- Smí jen administrátorka nebo service_role (jinak `42501 forbidden`).
- Pořadí zámků **akce → rezervace** (stejné jako u `create_reservation`) → bez deadlocků.
- Přechod z neblokujícího stavu (`cancelled`, `expired`, prošlé `pending_payment`) do blokujícího **znovu ověří volná místa** (`not_enough_spots`).
- Na zrušené/archivované akci nelze nastavit `confirmed` ani `pending_payment` (`event_not_bookable`).
- Návrat do `pending_payment` nastaví lhůtu stejně jako `create_reservation` (nejpozději začátek akce).
- Mezi blokujícími stavy (např. `pending_payment → confirmed`) obsazenost neroste, takže projde i na plné akci.
- Zakázané přechody (`invalid_transition`): zaplacená rezervace → `pending_payment`; `expired` lze nastavit jen z `pending_payment`.
- **Stav platby se nikdy nemění.** Ruční potvrzení administrátorkou nastaví jen `reservation_status = confirmed`; odpověď obsahuje `payment_status` a `payment_verified` (`true` jen při `paid`) a do `status_changed_by/at` se zapíše, kdo potvrdil. Ověřenou platbu nastavuje výhradně backend (`service_role`) zápisem `payment_status`.

### 6.5 Expirace

`private.expire_pending_reservations()` přepne prošlé `pending_payment` na `expired` a vrátí jejich počet. Kapacitu ale uvolňuje už samotné pravidlo (prošlá rezervace neblokuje), takže úloha jen srovnává stav pro administraci a pro e-maily. Naplánování po nasazení (vyžaduje zapnuté rozšíření `pg_cron`):

```sql
select cron.schedule('dve-expire-reservations', '*/5 * * * *', $$select private.expire_pending_reservations()$$);
```

### 6.6 Ošetřené scénáře a omezení

| Scénář | Stav |
|---|---|
| souběžné rezervace posledního místa | ✅ zámek akce + trigger (ověřeno paralelním testem) |
| akce začíná dřív než 48 h lhůta | ✅ lhůta končí nejpozději začátkem akce (minus odstup platební metody); příliš krátká lhůta → rezervace se nevytvoří |
| posunutí začátku akce dříve | ✅ lhůty čekajících rezervací se zkrátí |
| souběžné snížení kapacity a nové rezervace | ✅ obě operace zamykají akci (paralelní test, scénář C) |
| opětovné potvrzení zrušené / vypršelé rezervace | ✅ kontrola kapacity |
| zvýšení `number_of_spots` / přesun na jinou akci | ✅ trigger; administrace ale tyto sloupce měnit nesmí (GRANT) – zatím jen backend |
| snížení kapacity akce | ✅ nelze pod obsazenost |
| zrušení akce (`status = cancelled`) | ✅ nové rezervace, obnova ani potvrzení nejsou možné; **existující rezervace se automaticky neruší** – hromadné zrušení, vrácení plateb a e-maily `event_cancelled` musí řešit budoucí Edge Function |
| smazání akce s rezervacemi | ✅ zakázáno (`restrict`) |
| ruční potvrzení bez platby | ✅ povoleno, ale `payment_status` zůstane `unpaid` a je zaznamenáno, kdo potvrdil |
| zrušení zaplacené rezervace | ⚠️ stav se změní, `payment_status` zůstane `paid` – refundaci řeší budoucí platební backend |
| pozdní platba po expiraci | ⚠️ řeší budoucí webhook: `set_reservation_status(..., 'confirmed')` ověří kapacitu; když není místo, refundace |
| zákaznické zrušení odkazem z e-mailu | ⚠️ zatím není (plán: token + Edge Function `cancel-reservation`) |
| platba se zpracovává (`payment_status = pending`) v okamžiku expirace | ⚠️ rezervace vyprší a místo se uvolní; pokud platba dorazí, webhook ji řeší jako pozdní platbu (potvrzení při volné kapacitě, jinak refundace). Platební brána proto má mít kratší vlastní lhůtu než `p_hold` |
| demo mock ve frontendu (`src/lib/capacity.ts`) | ⚠️ lhůtu podle začátku akce zatím nezkracuje – sjednotit při integraci Supabase repozitářů (UI v tomto kroku záměrně beze změn) |

## 7. Přístup z Edge Functions (budoucí)

- Edge Functions používají `SUPABASE_SERVICE_ROLE_KEY` z **Supabase secrets** (nikdy ve frontendu ani v repozitáři).
- `create-reservation`: ověří captchu (Turnstile) a rate limit, pak `supabase.rpc('create_reservation', {...})` klientem se service role; výsledek `jsonb` předá frontendu. Při `ok: true` zapíše `notification_log` (`dedupe_key`) a odešle e-maily přes Resend.
- `create-reservation` předává `p_hold` a `p_payment_cutoff` podle zvolené platební metody (kap. 6.2).
- `payment-webhook`: ověří podpis brány, idempotentně zapíše `payments` (unikátní `provider_reference`) a v **jedné transakci** zavolá `set_reservation_status(..., 'confirmed')` a nastaví `payment_status = 'paid'` (omezení `reservations_paid_not_pending` nedovolí zaplacenou čekající rezervaci). Když už není místo (pozdní platba), ponechá `expired` + `paid` a zahájí refundaci.
- Administrace (frontend s přihlášenou adminkou) volá přímo: tabulky přes RLS, `set_reservation_status` jako RPC, `admin_event_occupancy` pro obsazenost.
- Veřejný web volá jen `list_public_events` / `get_public_event` a čte `gallery_items` – anon klíčem.

## 8. Lokální spuštění a testy

Předpoklady: Docker Desktop, Supabase CLI (`npx supabase`, verze 3.x). **Všechny příkazy níže jsou lokální** – vzdálenou databázi cílí jen přepínač `--remote`, který se zde nepoužívá. CLI před spuštěním vypíše `Target: local stack (127.0.0.1:54322)`.

```bash
npx supabase db start          # lokální Postgres (aplikuje migrace)
npx supabase db reset          # znovu vytvoří lokální DB: migrace + seed.sql
npx supabase test db           # pgTAP testy (supabase/tests/database)
npx supabase db advisors       # bezpečnostní a výkonnostní linter (lokálně)
bash supabase/tests/concurrency/last_spot.sh   # paralelní rezervace (Git Bash: MSYS_NO_PATHCONV=1)
npx supabase stop              # zastavení kontejnerů
```

Výsledky ověření (4. 11. 2026, lokálně):
- `supabase db reset` – 3 migrace + seed bez chyb,
- `supabase test db` – **4 soubory, 141 testů, PASS** (po kontrole před nasazením),
- `last_spot.sh` – **PASS** (A: 30 paralelních požadavků na 3 místa → přesně 3 rezervace; B: souběžné potvrzování + nové rezervace nepřekročí kapacitu 2; C: souběžné snížení kapacity nepřekročí kapacitu a po zrušení akce rezervace nevznikne),
- kontrolní sabotáž: po odebrání zámku a triggeru test souběhu **selhal** (5/3 a 12/2 míst); po povolení SELECT pro anon selhal test oprávnění – testy tedy chyby skutečně odhalují,
- `supabase db advisors --level warn` – bez nálezů.

## 9. Nasazení do projektu DVE (až po schválení)

Lokální složka `supabase/` je propojená s projektem **`DVE_PRODUCTION`** (`supabase/.temp/project-ref`). Nasazení proto provádět vědomě a jen po schválení SQL:

1. **Zkontrolovat stav vzdálené DB** (jen čtení):
   `npx supabase db query --remote --read-only "<SELECT nad katalogem>"` a `npx supabase migration list --remote` – vzdálený projekt nesmí mít jiné, neznámé migrace ani kolidující objekty.
   **Výsledek kontroly 4. 11. 2026 (read-only):** ve schématech `public`/`private` nejsou žádné tabulky, typy ani pohledy, schéma `private` neexistuje, tabulka historie migrací neexistuje (žádné předchozí CLI migrace), Postgres 17.11, izolace `read committed`, rozšíření `pgcrypto`. Jediný objekt je platformní funkce Supabase `public.rls_auto_enable()` s event triggerem `ensure_rls` (automaticky zapíná RLS na nových tabulkách v `public`) – s migracemi nekoliduje (RLS zapínáme explicitně a operace je idempotentní); event-trigger funkci nelze volat přímo, proto její EXECUTE pro anon nepředstavuje riziko. **Kolize nenalezeny.**
2. Zálohu / PITR ověřit v dashboardu.
3. Náhled bez změn: `npx supabase db push --remote --dry-run`.
4. Nasazení migrací (bez seedu): `npx supabase db push --remote`.
5. Ověření: `npx supabase db advisors --remote`; testy proti vzdálené DB spouštět **jen na preview větvi**, ne na produkci.
6. V dashboardu: zapnout `pg_cron` a naplánovat expiraci (kap. 6.5), vypnout veřejnou registraci (Auth → Sign-ups), zapnout MFA pro adminy.
7. Admin účet: pozvat uživatele v Auth a vložit řádek do `admin_profiles` (SQL editor jako `postgres`):
   `insert into public.admin_profiles (id, email, display_name) values ('<auth.users.id>', '<email>', '<jméno>');`
8. Frontend přepnout až po implementaci Supabase repozitářů (kap. 12).

`seed.sql` se do vzdáleného projektu **nenasazuje**.

## 10. Integrace Resend

- E-maily odesílají výhradně Edge Functions (`send-notification`) s `RESEND_API_KEY` uloženým v **Supabase secrets**.
- Spouštění: z `create-reservation`, z platebního webhooku, z `pg_cron` (připomenutí 24 h před akcí) a z admin akcí (zrušení akce).
- Typy notifikací: viz `src/services/notifications/types.ts` (`reservation_created`, `payment_instructions`, `payment_confirmed`, `reservation_cancelled`, `event_cancelled`, `event_reminder`, `admin_new_reservation`).
- Každé odeslání se zapíše do `notification_log`; unikátní `dedupe_key` (např. `reservation_created:<id>`) brání duplicitám, `attempts` a `last_attempt_at` slouží pro opakování.
- Doména odesílatele musí mít nastavené SPF, DKIM a DMARC.
- Frontend nikdy nezobrazuje „e-mail byl odeslán“, pokud to nepotvrdil backend.

## 11. Integrace plateb

- Kontrakt: `src/services/payments/types.ts` (`PaymentGateway`, `PaymentInstructions`).
- **QR platba (převod):** Edge Function vygeneruje SPAYD řetězec s variabilním symbolem; párování přes bankovní API / ruční potvrzení adminem (`provider = 'manual'`).
- **GoPay / Comgate:** Edge Function `start-payment` založí platbu u brány (tajné klíče jen v secrets) a vrátí `redirectUrl`. Brána volá webhook `payment-webhook`, který:
  - ověří podpis / dotáže se brány na skutečný stav,
  - idempotentně zapíše `payments` (unikátní `provider_reference`),
  - při `paid` nastaví `reservations.payment_status = 'paid'` (jen service_role) a zavolá `set_reservation_status(..., 'confirmed')`,
  - zařadí e-mail `payment_confirmed`.
- Návratová URL z brány do prohlížeče **nic nepotvrzuje** – jen zobrazí stav načtený z backendu.
- Pozdní platba po `expires_at`: webhook ověří volnou kapacitu; když už není, vrácení peněz (`refunded`) a upozornění adminů.

## 12. Postup integrace frontendových repozitářů

1. Nasadit migrace (kap. 9) a založit admin účet.
2. `npm i @supabase/supabase-js`, vytvořit `src/lib/supabase-client.ts` (jen `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`).
3. Implementovat `src/data/repositories/supabase/`:
   - `SupabaseEventRepository` – `listPublished` → `rpc('list_public_events')`, `getPublishedBySlug` → `rpc('get_public_event', { p_slug })`; admin metody nad tabulkou `events` + `admin_event_occupancy` (`blockedSpots`),
   - `SupabaseReservationRepository` – `create` → Edge Function `create-reservation` (nikdy přímé RPC z prohlížeče), `listForAdmin` → `select` z `reservations`, `updateStatus` → `rpc('set_reservation_status')`; výsledek `{ ok: false, code }` převést na `RepositoryError`,
   - `SupabaseGalleryRepository` – `gallery_items` (+ Storage),
   - `SupabaseAuthRepository` – `supabase.auth.getSession()` + čtení vlastního řádku `admin_profiles`.
   - Mapování `snake_case` ↔ `camelCase` (`start_at` → `startAt`, `price` numeric → number, `public_code` → zobrazované číslo rezervace) jen v repozitářích.
4. V `getRepositories()` nahradit `createUnavailableRepositories()` skutečnou implementací a nastavit `VITE_DATA_SOURCE=supabase` (GitHub Actions → Variables).
5. Do `/admin` doplnit přihlášení (vzhled schválit); demo banner a „Resetovat demo data“ se v režimu supabase nezobrazí.
6. Upravit texty „ukázková akce / demo“ podle skutečné nabídky (po schválení).
7. GitHub Pages zůstává beze změny – backend běží v Supabase, žádný vlastní Node server.
8. Pokud je potřeba, rozšířit `scripts/github-pages.mjs` (dnes předgeneruje stránky jen pro demo slugy; ostatní cesty obslouží `404.html` SPA fallback).

## 13. Proměnné prostředí

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
| `PAYMENT_BANK_ACCOUNT` (QR) | Supabase secrets | ne |

Vše s prefixem `VITE_` se dostane do veřejného JavaScriptu – **nikdy tam nedávat tajné klíče**. Vzor je v `.env.example`; `.env` je v `.gitignore`.

Hesla k databázi a přístupové tokeny Supabase CLI se do repozitáře **neukládají** (`supabase/.temp` a `supabase/.env*` jsou v `supabase/.gitignore`).

## 14. Bezpečnostní kroky před produkčním spuštěním

Hotovo v databázových migracích (ověřeno lokálními testy):
- [x] RLS zapnuté na všech tabulkách; `anon` nečte `reservations`, `payments`, `admin_profiles`, `notification_log` ani přímo `events`.
- [x] `create_reservation` jen pro service_role (Edge Function); `set_reservation_status` jen admin / service_role.
- [x] Souběžný test přeplnění (30 paralelních požadavků) a invariant kapacity v triggeru.
- [x] Stav platby nemůže změnit anon, běžný uživatel ani administrátorka – jen backend.
- [x] Roli admina si nelze přidělit z frontendu.
- [x] SECURITY DEFINER funkce s prázdným `search_path` a omezeným EXECUTE.

Zbývá:
- [ ] Nasadit migrace po schválení (kap. 9) a zopakovat `db advisors --remote`.
- [ ] Captcha + rate limit v Edge Function `create-reservation`.
- [ ] Platební webhooky s ověřením podpisu; refundace při zrušení zaplacené rezervace / akce.
- [ ] Hromadné zrušení rezervací a e-maily při zrušení akce.
- [ ] `pg_cron` pro expiraci a připomínky.
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
