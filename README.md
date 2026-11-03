# DVĚ – jóga a pilates

Prezentační web pro projekt **DVĚ** – komunitu jógy a pilates vedenou dvěma ženami. Web je celý v češtině, postavený jako jednostránkový web s doplňkovými podstránkami pro akce a rezervace a s ukázkovou administrací.

> **Upozornění:** Jde o ukázku bez skutečného backendu. Rezervace i změny v administraci se ukládají jen v prohlížeči daného návštěvníka (localStorage). Neodesílají se žádné e-maily ani platby a administrace není chráněná heslem – kdo zná adresu `/admin`, otevře si ji. Nezadávejte skutečné osobní údaje.

## Obsah webu

Jednostránkový web (`/`) obsahuje tyto sekce:

- **Úvod** – hlavní fotografie, slogan a úvodní text
- **O nás** – představení dvou lektorek
- **Online lekce na Forendors** – karty online lekcí s odkazem na Forendors
- **Zdarma na YouTube** – vložené video s tlačítkem „Otevřít na YouTube"
- **Akce a rezervace** – přehled akcí s filtrem podle typu; každá akce má vlastní podstránku (`/akce/...`) a rezervační formulář (`/rezervace/...`)
- **Galerie** – mřížka fotografií s náhledem po kliknutí
- **Časté otázky** – rozbalovací odpovědi
- **Kontakt** – e-mail, Instagram, odkaz na Forendors

Dále web obsahuje:

- **Detail akce** (`/akce/:id`) – popis akce, fotografie, cena a počet volných míst
- **Rezervace** (`/rezervace/:id`) – formulář s ověřením údajů, obrazovka potvrzení a upozornění, že jde o ukázku
- **Administrace** (`/admin`) – ukázková správa: statistiky, správa akcí, přehled rezervací s vyhledáváním, změnou stavu a exportem do CSV, správa titulků galerie

## Použité technologie

| Technologie | K čemu slouží |
| --- | --- |
| [TanStack Start](https://tanstack.com/start) v1 | fullstack framework – routing, SSR/prerender, serverové funkce |
| [React](https://react.dev) 19 | uživatelské rozhraní |
| [TanStack Router](https://tanstack.com/router) | směrování (hlavní stránka, akce, rezervace, admin) |
| [TypeScript](https://www.typescriptlang.org) | typovaný JavaScript v celém projektu |
| [Vite](https://vite.dev) 8 | vývojový server a sestavení |
| [Tailwind CSS](https://tailwindcss.com) 4 | stylování přes `@theme` proměnné v `src/styles.css` |
| shadcn/ui (Radix UI) | hotové přístupné komponenty (akordeon, dialog, formulářová pole…) |
| [Vitest](https://vitest.dev) + Testing Library | testy |
| GitHub Actions | automatické nasazení na GitHub Pages |

## Vzhled a značka

- **Barvy:** sluneční žlutá `#F4E886`, růžová `#CE84A8`, kakaová hnědá `#472E2D`, krémová `#FFFADD`, jemně růžová `#F9E1ED`, šedobéžová `#D3C9C9`
- **Písma:** Fraunces (nadpisy) + DM Sans (text)
- Logo a symbol značky jsou součástí webu, včetně favicony

## Jak fungují data (ukázkový režim)

- Ukázkové akce a galerie jsou definované v `src/data/demo.ts`
- Datová vrstva je v `src/services/store.ts`: ukládá do localStorage prohlížeče a vystavuje jednoduché funkce (přidání rezervace, změna stavu, export CSV, reset ukázky)
- Rozhraní webu používá jen funkce této vrstvy – až bude skutečný backend, vystřídá ji bez zásahu do stránek
- Fotografie akcí a galerie jsou vygenerované ilustrace; každý návštěvník vidí své vlastní rezervace

## Struktura projektu

```
src/
├── routes/            # stránky: index, akce/$id, rezervace/$id, admin, __root
├── components/site/   # hlavička, patička, karty akcí, video, vizuál akce
├── components/ui/     # shadcn/ui komponenty
├── config/site.ts     # název, navigace, externí odkazy (Forendors, YouTube, e-mail, Instagram)
├── data/demo.ts       # ukázkové akce a galerie
├── services/store.ts  # datová vrstva (localStorage)
├── lib/types.ts       # typy (akce, rezervace, galerie)
├── styles.css         # barvy, písma, vlastní utility
└── test/              # testy
```

## Spuštění na GitHub Pages

Vzhled webu zůstává stejný. Tato verze nemá společné rezervace ani chráněnou administraci: změny se ukládají pouze v prohlížeči návštěvníka. Nezadávejte skutečné osobní údaje. E-maily ani platby se neodesílají.

1. V Lovable propojte projekt s GitHubem přes **Settings → Git**.
2. Na GitHubu otevřete **Settings → Pages → Build and deployment → Source** a vyberte **GitHub Actions**. Dostupnost Pages u soukromého repozitáře závisí na vašem GitHub tarifu.
3. V záložce **Actions** vyberte **Nasazení DVĚ na GitHub Pages** a klikněte na **Run workflow**. Automatické nasazení běží při změnách větve `main`; používáte-li jinou větev, upravte ji v `.github/workflows/github-pages.yml`.
4. Po dokončení najdete adresu webu v **Settings → Pages**. Administraci otevřete přidáním `/admin` k adrese webu (za případný název repozitáře).

Cesty se přizpůsobí repozitáři automaticky. Logo i fotografie se přibalí do webu. Pokud zdroj původních fotografií přestane být dostupný, nové sestavení se zastaví; již nasazený web fotografie dál obsahuje.

Přímé odkazy a obnovení fungují u pěti původních ukázkových akcí, jejich rezervací a administrace. Nová akce vytvořená ve vašem prohlížeči se otevře také přes záložní stránku, ale GitHub u neznámé adresy vrací stav 404. Ostatní lidé tuto lokálně vytvořenou akci neuvidí.

### Místní příprava

```sh
bun install
VITE_BASE_PATH=/nazev-repozitare/ bun run build:pages
```

Na GitHub Pages se nahrává pouze obsah `dist/client`, nikoli zdrojové soubory ani server. Pro vlastní doménu nebo repozitář `uzivatel.github.io` je základní cesta `/`.

## Vývoj a testy

```sh
bun install      # nebo npm install
bun run dev      # vývojový server
bun run test     # spuštění testů
bun run build    # běžné sestavení
```

## Co by přinesl skutečný backend

Současná verze je záměrně jen ukázka. Napojením Lovable Cloud by vzniklo:

- společné rezervace viditelné pro všechny návštěvníky a skutečné odečítání volných míst
- potvrzovací e-maily návštěvníkům
- zabezpečená administrace s přihlášením
- případně platby a správa osobních údajů dle GDPR

---

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.
