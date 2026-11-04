# DVĚ – jóga a pilates

Prezentační a rezervační web projektu **DVĚ** – komunity jógy a pilates vedené dvěma lektorkami. Web je celý v češtině: jednostránková prezentace, podstránky akcí a rezervací a administrace pro správu akcí, rezervací a galerie.

Projekt vznikl v [Lovable](https://lovable.dev) a dál se vyvíjí v Claude Code.

> **Aktuální stav – DEMO režim.** Web běží bez backendu: rezervace i změny v administraci se ukládají jen v prohlížeči daného návštěvníka (localStorage). Neodesílají se žádné e-maily ani platby a administrace **není zabezpečená** – kdo zná adresu `/admin`, otevře ji. Nezadávejte skutečné osobní údaje.
>
> Produkční databáze v Supabase je **připravená** (SQL migrace, RLS, atomické rezervace, testy – viz [Databáze Supabase](#databáze-supabase)), frontend k ní ale zatím **připojený není**.

---

## Obsah

- [Obsah webu](#obsah-webu)
- [Použité technologie](#použité-technologie)
- [Architektura](#architektura)
- [Struktura projektu](#struktura-projektu)
- [Konfigurace](#konfigurace)
- [Vývoj a testy](#vývoj-a-testy)
- [Nasazení na GitHub Pages](#nasazení-na-github-pages)
- [Bezpečnost a omezení demo režimu](#bezpečnost-a-omezení-demo-režimu)
- [Další dokumentace](#další-dokumentace)

---

## Obsah webu

Jednostránkový web (`/`) obsahuje tyto sekce:

- **Úvod** – hlavní fotografie, slogan a úvodní text
- **O nás** – představení dvou lektorek
- **Online lekce na Forendors** – karty online lekcí s odkazem na Forendors
- **Zdarma na YouTube** – vložené video s tlačítkem „Otevřít na YouTube“
- **Akce a rezervace** – přehled akcí s filtrem podle typu; každá akce má vlastní podstránku a rezervační formulář
- **Galerie** – mřížka fotografií s náhledem po kliknutí
- **Časté otázky** – rozbalovací odpovědi
- **Kontakt** – e-mail, Instagram, odkaz na Forendors

Další stránky:

| Adresa | Obsah |
| --- | --- |
| `/akce/:slug` | detail akce – popis, fotografie, termín, cena, počet volných míst |
| `/rezervace/:slug` | rezervační formulář (jméno, e-mail, telefon, počet míst, poznámka) s ověřením údajů a potvrzením |
| `/admin` | demo administrace – přehled a statistiky, správa akcí, rezervace (vyhledávání, změna stavu, detail, export CSV), galerie, reset ukázkových dat |

### Vzhled a značka

- **Barvy:** sluneční žlutá `#F4E886`, růžová `#CE84A8`, kakaová hnědá `#472E2D`, krémová `#FFFADD`, jemně růžová `#F9E1ED`, šedobéžová `#D3C9C9`
- **Písma:** Fraunces (nadpisy) + DM Sans (text)
- Barvy, písma a vlastní utility (`btn`, `field`, `eyebrow`…) jsou v `src/styles.css`; logo a symbol značky v `src/assets/`

Design je schválený – pravidla pro jeho zachování jsou v [`CLAUDE.md`](CLAUDE.md).

## Použité technologie

| Technologie | K čemu slouží |
| --- | --- |
| [TanStack Start](https://tanstack.com/start) v1 | aplikační framework – SSR/prerender, sestavení pro Lovable i GitHub Pages |
| [TanStack Router](https://tanstack.com/router) | souborové směrování (`src/routes/`), podpora nasazení pod podadresářem |
| [React](https://react.dev) 19 + [TypeScript](https://www.typescriptlang.org) | uživatelské rozhraní, přísné typování (`strict`, `exactOptionalPropertyTypes`) |
| [TanStack Query](https://tanstack.com/query) (React Query) | načítání a cache dat, mutace a jejich invalidace |
| [Vite](https://vite.dev) 8 | vývojový server a sestavení |
| [Tailwind CSS](https://tailwindcss.com) 4 | stylování (`@theme` proměnné v `src/styles.css`) |
| shadcn/ui (Radix UI) | přístupné UI komponenty (akordeon, dialog…) |
| [Vitest](https://vitest.dev) + Testing Library | testy frontendu |
| [Supabase](https://supabase.com) (PostgreSQL, Auth, Edge Functions, Storage) | **připravený** produkční backend – zatím nepřipojený |
| Supabase CLI + Docker + pgTAP | lokální databáze, verzované migrace, databázové testy |
| GitHub Actions | testy a automatické nasazení na GitHub Pages |

---

## Architektura

### Přehled vrstev

Uživatelské rozhraní nikdy nepracuje přímo s úložištěm. Mezi stránkami a daty jsou tři vrstvy, takže demo úložiště (localStorage) půjde nahradit Supabase **bez změn komponent**:

```
┌──────────────────────────────────────────────────────────────────────┐
│ UI: src/routes/*, src/components/site/*                              │
│   stránky a komponenty – jen zobrazení, formuláře, skeletony, chyby  │
└───────────────┬──────────────────────────────────────────────────────┘
                │ hooky
┌───────────────▼──────────────────────────────────────────────────────┐
│ src/hooks/data/*  (React Query)                                      │
│   usePublishedEvents, usePublishedEvent, useAdminEvents,             │
│   useCreateReservation, useUpdateReservationStatus, useGallery …     │
│   cache, stav načítání/chyby, invalidace po mutacích                 │
└───────────────┬──────────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────────┐
│ src/services/reservation-service.ts                                  │
│   jediný vstupní bod pro vytvoření rezervace (validace + repozitář)  │
└───────────────┬──────────────────────────────────────────────────────┘
                │ rozhraní (async)
┌───────────────▼──────────────────────────────────────────────────────┐
│ src/data/repositories/types.ts                                       │
│   EventRepository, ReservationRepository, GalleryRepository,         │
│   AuthRepository                                                     │
│ getRepositories()  ← výběr implementace podle VITE_DATA_SOURCE       │
└───────┬───────────────────────────────────────────────┬──────────────┘
        │ VITE_DATA_SOURCE=mock (dnes)                  │ =supabase (budoucí)
┌───────▼──────────────────────────────┐   ┌────────────▼──────────────────────┐
│ mock/* + mock-db.ts                  │   │ supabase/* (zatím neimplementováno)│
│ localStorage, ukázková data,         │   │ RPC funkce, Edge Functions, RLS    │
│ simulace expirace a kapacity         │   │ → supabase/migrations/*.sql        │
└──────────────────────────────────────┘   └───────────────────────────────────┘
```

Zásady:

- **Komponenty znají jen hooky.** Neimportují localStorage, mock ani Supabase.
- **Repozitáře jsou asynchronní** (`Promise`), takže výměna za síťové volání nic nemění na UI.
- **Doménová pravidla jsou v `src/lib/`** a mají SQL protějšek v databázi:
  - `capacity.ts` – obsazenost: `confirmed` blokuje místo vždy, `pending_payment` jen do `expiresAt`, `cancelled`/`expired` neblokují,
  - `event-schedule.ts` – termíny `startAt`/`endAt` v UTC, zobrazení v `Europe/Prague`, validace pole „Čas“ (žádné automatické 00:00),
  - `reservation-validation.ts` – validace rezervačního formuláře.
- **Frontend není autoritou.** Počet volných míst je jen informativní; o dostupnosti a stavu platby v produkci rozhoduje databáze a backend.
- **Veřejné stránky nedostávají cizí rezervace** – jen agregované `availableSpots` (`PublicEvent`).

### Datové modely

Definované v `src/lib/types.ts` (camelCase; v databázi stejné názvy v snake_case):

| Model | Klíčová pole |
| --- | --- |
| `DveEvent` / `PublicEvent` / `AdminEvent` | `slug`, `startAt`, `endAt`, `timezone`, `timeLabel`, `price`, `capacity`, `status` (`draft`, `published`, `cancelled`, `archived`), `isDemo`; veřejná varianta + `availableSpots`, adminská + `blockedSpots` |
| `Reservation` | `customerName`, `customerEmail`, `customerPhone`, `numberOfSpots`, `reservationStatus` (`pending_payment`, `confirmed`, `cancelled`, `expired`), `paymentStatus` (`unpaid`, `pending`, `paid`, `refunded`, `failed`), `expiresAt` |
| `GalleryItem`, `AdminProfile`, `Payment` | galerie, profil administrátorky, platba k rezervaci |

Zákazníci **nemají účty** – rezervují bez registrace. Přihlášení bude jen pro administrátorky.

### Tok rezervace

**Dnes (demo):**

1. `/rezervace/:slug` načte akci přes `usePublishedEvent` (včetně `availableSpots`).
2. Formulář provede klientskou validaci (jen kvůli pohodlí uživatele).
3. `useCreateReservation` → `reservationService.createReservation` → `MockReservationRepository.create`.
4. Mock znovu zvaliduje vstup, ověří kapacitu a uloží rezervaci jako `pending_payment` / `unpaid` s lhůtou 48 h.
5. React Query znovu načte akce, aby se projevila nová obsazenost.

**V produkci (připraveno v databázi):** repozitář zavolá Supabase Edge Function `create-reservation` (captcha, rate limit), ta zavolá databázovou funkci `create_reservation`, která **zamkne řádek akce** a atomicky ověří kapacitu i lhůtu na zaplacení. Souběžné rezervace posledního místa tak nemohou akci přeplnit.

### Načítání a chybové stavy

- Během načítání se zobrazují **skeletony** ve stejném rozvržení jako obsah (`components/site/Skeletons.tsx`).
- Při chybě se zobrazí hláška s tlačítkem „Zkusit znovu“ (`components/site/LoadError.tsx`) – chyba se nikdy netváří jako prázdný seznam. Skeleton nezůstává natrvalo: React Query po několika pokusech přejde do chybového stavu.
- Chyby datové vrstvy nesou českou zprávu (`RepositoryError` v `src/data/repositories/types.ts`, převod na text pro UI v `src/lib/errors.ts`).

### Administrace

- `/admin` používá stejné hooky jako veřejný web (`useAdminEvents`, `useAdminReservations`, `useGallery` …) plus mutace.
- V demo režimu `MockAuthRepository` vrací „demo relaci“ – **nejde o zabezpečení** a stránka je tak výrazně označená. Frontendové heslo ani skrytá URL se jako ochrana nepoužívají.
- Admin nemůže změnou stavu přeplnit akci a ruční potvrzení rezervace **nemění stav platby**.
- V produkci: přihlášení přes Supabase Auth, oprávnění podle tabulky `admin_profiles` a Row Level Security v databázi.

### Ukázková data

- Výchozí akce a galerie: `src/data/demo.ts` (5 ukázkových akcí, 6 fotografií – AI ilustrace).
- Úložiště: `src/data/repositories/mock/mock-db.ts`, klíč `dve-demo-v2` v localStorage.
- Starší data z verze `dve-demo-v1` se při prvním načtení převedou; původní klíč se nemaže (slouží jako záloha) a nejednoznačné časy se nevymýšlejí – akce pak čeká v administraci na doplnění času.
- Prošlé nezaplacené rezervace se při čtení přepnou na `expired` (simulace plánované úlohy).

### Routování a dva režimy sestavení

Aplikace je postavená na TanStack Start a sestavuje se dvěma způsoby:

| Režim | Příkaz | Výstup | Použití |
| --- | --- | --- | --- |
| Lovable / SSR | `npm run build` | `.output/` (Nitro, Cloudflare target) | náhled v Lovable |
| GitHub Pages | `npm run build:pages` | `dist/client/` (statický SPA shell) | veřejný hosting |

Režim GitHub Pages (`GITHUB_PAGES=true`, viz `vite.config.ts`):

- nastaví základní cestu podle `VITE_BASE_PATH` (nasazení pod `/nazev-repozitare/` i na vlastní doméně `/`),
- vypne server (Nitro) a zapne SPA režim s prerenderem shellu,
- `scripts/github-pages.mjs` připraví veřejné soubory a zkopíruje shell na cesty `/admin`, `/akce/<slug>`, `/rezervace/<slug>` pěti ukázkových akcí a do `404.html` (záložní stránka pro ostatní adresy),
- obrázky z `src/assets` se přibalí do sestavení a dostanou správnou základní cestu.

Na hostingu není žádný vlastní server – budoucí backend poběží v Supabase.

### Databáze Supabase

Produkční schéma je ve verzovaných migracích v `supabase/migrations/`:

| Migrace | Obsah |
| --- | --- |
| `20261104130000_core_schema.sql` | tabulky `events`, `reservations`, `payments`, `admin_profiles`, `gallery_items`, `notification_log`; omezení, indexy |
| `20261104130100_auth_rls_grants.sql` | ověření administrátorky (`private.is_admin()`), minimální oprávnění rolí, Row Level Security |
| `20261104130200_reservation_logic.sql` | `create_reservation`, `set_reservation_status`, invariant kapacity (trigger), expirace, veřejné funkce `list_public_events` / `get_public_event` |
| `20261104150000_restrict_rls_auto_enable_execute.sql` | odebrání zbytečného EXECUTE z platformní funkce `rls_auto_enable` |

Hlavní bezpečnostní vlastnosti:

- veřejnost (`anon`) nečte žádnou tabulku s osobními údaji; akce dostává jen přes funkce bez osobních údajů,
- rezervace vytváří jen backend (`service_role` přes Edge Function), stav platby mění jen backend,
- kapacitu hlídá zámek řádku akce i trigger – platí i pro souběžné transakce a přímé zápisy,
- lhůta na zaplacení nikdy nepřesáhne začátek akce,
- roli administrátorky si nelze přidělit z frontendu.

Podrobný popis tabulek, RLS, funkcí, testů, nasazení a stavu v projektu DVE_PRODUCTION je v [`SUPABASE_INTEGRATION.md`](SUPABASE_INTEGRATION.md).

### Připravené budoucí integrace

| Oblast | Kde je připravená | Stav |
| --- | --- | --- |
| Supabase repozitáře | `src/data/repositories/types.ts`, `getRepositories()` | rozhraní hotová, implementace chybí |
| Přihlášení adminek | `AuthRepository`, tabulka `admin_profiles` | DB hotová, UI přihlášení chybí |
| E-maily (Resend) | `src/services/notifications/types.ts`, tabulka `notification_log` | jen kontrakt – nic se neodesílá |
| Platby (QR, GoPay, Comgate) | `src/services/payments/types.ts`, tabulka `payments` | jen kontrakt – nic se neplatí |

Tajné klíče (service role, Resend, platební brány) patří jen do Supabase secrets, nikdy do frontendu ani do repozitáře.

---

## Struktura projektu

```
├── .github/workflows/github-pages.yml   # testy + nasazení na GitHub Pages
├── scripts/github-pages.mjs             # příprava a dokončení statického sestavení
├── public/                              # favicon, robots.txt
├── src/
│   ├── routes/                          # stránky: __root, index, akce.$id, rezervace.$id, admin
│   ├── components/
│   │   ├── site/                        # hlavička, patička, karty akcí, video, skeletony, chybové stavy
│   │   └── ui/                          # shadcn/ui komponenty
│   ├── hooks/data/                      # React Query hooky (jediný přístup UI k datům)
│   ├── services/
│   │   ├── reservation-service.ts       # vstupní bod rezervací
│   │   ├── payments/types.ts            # kontrakt budoucích plateb
│   │   └── notifications/types.ts       # kontrakt budoucích e-mailů
│   ├── data/
│   │   ├── demo.ts                      # ukázkové akce a galerie
│   │   └── repositories/
│   │       ├── types.ts                 # rozhraní repozitářů, RepositoryError
│   │       ├── index.ts                 # getRepositories()
│   │       └── mock/                    # demo implementace + mock-db.ts (localStorage)
│   ├── lib/                             # typy a doménová pravidla (kapacita, termíny, validace, formátování, CSV)
│   ├── config/
│   │   ├── site.ts                      # texty, odkazy (Forendors, YouTube, e-mail, Instagram), navigace
│   │   └── data-source.ts               # VITE_DATA_SOURCE (mock | supabase)
│   ├── assets/                          # logo, symbol, fotografie
│   ├── styles.css                       # barvy, písma, vlastní utility
│   ├── router.tsx, start.ts, server.ts  # konfigurace routeru, middleware, SSR vstup
│   └── test/                            # testy frontendu (Vitest)
├── supabase/
│   ├── config.toml                      # lokální Supabase (CLI)
│   ├── migrations/                      # verzované SQL migrace
│   ├── seed.sql                         # ukázkové akce – jen pro lokální vývoj
│   └── tests/
│       ├── database/                    # pgTAP testy (schéma, oprávnění, rezervace, audit)
│       └── concurrency/last_spot.sh     # test souběžných rezervací
├── SUPABASE_INTEGRATION.md              # podrobná dokumentace backendu
├── CLAUDE.md, AGENTS.md                 # pravidla projektu pro vývoj s AI
└── roadmap.md                           # stav úkolů
```

## Konfigurace

**Obsah webu** – texty, odkazy a navigace jsou v `src/config/site.ts`. Neznámé hodnoty zůstávají `null` a web zobrazí náhradní text („Brzy doplníme“) místo vymyšlené adresy.

**Proměnné prostředí** – vzor je v `.env.example` (soubor `.env` je v `.gitignore`):

| Proměnná | Význam |
| --- | --- |
| `VITE_DATA_SOURCE` | `mock` (výchozí, demo) nebo `supabase` (zatím neimplementováno – web zobrazí chybový stav) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | budoucí připojení k Supabase (veřejné hodnoty, ochranu dat zajišťuje RLS) |
| `VITE_BASE_PATH` | základní cesta pro GitHub Pages (nastavuje workflow automaticky) |

Vše s prefixem `VITE_` je veřejné – skončí v JavaScriptu v prohlížeči.

## Vývoj a testy

Projekt funguje s **npm** i **bun** (GitHub Actions používá bun).

```sh
npm install           # nebo: bun install
npm run dev           # vývojový server
npm test              # testy frontendu (Vitest)
npx tsc --noEmit      # kontrola typů
npm run lint          # ESLint
npm run build         # sestavení pro Lovable (SSR)
bun run build:pages   # sestavení pro GitHub Pages (viz níže)
```

`build:pages` používá unixový zápis proměnné (`GITHUB_PAGES=true …`). Na Windows ho spusťte přes **bun** nebo **Git Bash**, ne přes `cmd`/PowerShell.

### Databázové testy (lokálně)

Vyžadují Docker Desktop. Všechny příkazy cílí na **lokální** databázi – vzdálený projekt by cílil jen přepínač `--remote`.

```sh
npx supabase db start                          # lokální Postgres s migracemi
npx supabase db reset                          # znovu vytvořit: migrace + seed.sql
npx supabase test db                           # pgTAP testy
npx supabase db advisors                       # bezpečnostní a výkonnostní kontrola
bash supabase/tests/concurrency/last_spot.sh   # souběžné rezervace (Git Bash: MSYS_NO_PATHCONV=1)
npx supabase stop                              # zastavit kontejnery
```

Pokrytí testy:

- **Frontend** – směrování a cesty pro GitHub Pages, datová vrstva, pravidla kapacity, termíny, migrace demo dat, chybové stavy repozitářů.
- **Databáze** – struktura a omezení, oprávnění a RLS (včetně negativních testů pro `anon` a běžného uživatele), atomické rezervace, expirace, změny stavů, audit SECURITY DEFINER funkcí a skutečně paralelní rezervace posledního místa.

Nasazení migrací do vzdáleného projektu se provádí jen po schválení – postup je v [`SUPABASE_INTEGRATION.md`](SUPABASE_INTEGRATION.md), kapitola 9.

## Nasazení na GitHub Pages

Workflow `.github/workflows/github-pages.yml` při změně větve `main` (nebo ručně) nainstaluje závislosti, **spustí testy**, sestaví statický web a nahraje `dist/client`. Zdrojové soubory ani server se nenahrávají.

1. V Lovable propojte projekt s GitHubem přes **Settings → Git**.
2. Na GitHubu otevřete **Settings → Pages → Build and deployment → Source** a vyberte **GitHub Actions**. Dostupnost Pages u soukromého repozitáře závisí na vašem GitHub tarifu.
3. V záložce **Actions** vyberte **Nasazení DVĚ na GitHub Pages** a klikněte na **Run workflow**. Používáte-li jinou větev než `main`, upravte ji ve workflow.
4. Po dokončení najdete adresu webu v **Settings → Pages**. Administraci otevřete přidáním `/admin` k adrese webu (za případný název repozitáře).

Místní příprava stejného sestavení:

```sh
bun install
VITE_BASE_PATH=/nazev-repozitare/ bun run build:pages
```

Pro vlastní doménu nebo repozitář `uzivatel.github.io` je základní cesta `/`.

Přímé odkazy a obnovení stránky fungují u pěti původních ukázkových akcí, jejich rezervací a administrace. Ostatní adresy (např. akce nově vytvořená v prohlížeči) se otevřou přes záložní stránku `404.html` – web funguje, ale GitHub vrací stav 404.

## Bezpečnost a omezení demo režimu

- Data jsou jen v prohlížeči návštěvníka – nesdílí se mezi zařízeními ani návštěvníky a po vymazání dat prohlížeče zmizí.
- Kapacitu demo hlídá jen v rámci jednoho prohlížeče.
- Administrace není chráněná a je tak označená.
- E-maily ani platby se neodesílají; potvrzovací obrazovka to výslovně uvádí.
- Demo lhůta na zaplacení se zatím nezkracuje podle začátku akce (databáze už ano – sjednotí se při napojení Supabase).

Ostrý provoz vyžaduje napojení Supabase repozitářů, přihlášení adminek, Edge Functions pro rezervace, e-maily a platby a projití bezpečnostního kontrolního seznamu v [`SUPABASE_INTEGRATION.md`](SUPABASE_INTEGRATION.md), kapitola 14.

## Další dokumentace

| Soubor | Obsah |
| --- | --- |
| [`SUPABASE_INTEGRATION.md`](SUPABASE_INTEGRATION.md) | databáze, RLS, SQL funkce, testy, nasazení, integrace frontendu, e-mailů a plateb |
| [`CLAUDE.md`](CLAUDE.md) | pravidla projektu (jazyk, zachování designu, bezpečnost, postup úprav) |
| [`AGENTS.md`](AGENTS.md) | technické poznámky pro vývoj s AI nástroji |
| [`roadmap.md`](roadmap.md) | hotové a otevřené úkoly |

---

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.
