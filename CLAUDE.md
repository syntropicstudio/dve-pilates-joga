# DVĚ – Projektová pravidla pro Claude Code

## 1. Základní informace o projektu

**Název:** DVĚ – jóga a pilates

Projekt představuje moderní webovou aplikaci pro prezentaci značky DVĚ, která pořádá online i offline lekce jógy a pilates, workshopy a víkendové eventy.

Web byl původně vytvořen pomocí Lovable a následně je vyvíjen prostřednictvím Claude Code.

### Hlavní funkce

- Prezentační web značky DVĚ.
- Sekce online lekcí s odkazem na Forendors.
- Ukázková YouTube lekce zdarma.
- Přehled offline akcí a eventů.
- Rezervace akcí bez registrace zákazníků.
- Administrace pro správu eventů a rezervací.
- Galerie minulých akcí.
- Kontaktní informace.

## 2. Jazyk komunikace

**Veškerou komunikaci s uživatelem veď výhradně v češtině.**

To zahrnuje:

- Odpovědi na dotazy.
- Vysvětlování technických řešení.
- Popisy implementovaných změn.
- Implementační plány.
- Shrnutí výsledků.
- Chybová hlášení určená uživateli.
- Dokumentaci projektu.

Zdrojový kód však vytvářej podle běžných vývojářských standardů.

Názvy proměnných, funkcí, tříd, komponent, databázových tabulek a souborů používej v angličtině.

Komentáře v kódu mohou být v češtině, pokud to odpovídá stávajícím konvencím projektu.

## 3. Technologický stack

Preferované technologie projektu:

- React
- TypeScript
- Vite
- Tailwind CSS
- GitHub Pages

Před jakoukoliv změnou ověř skutečně použitý technologický stack v projektu.

Nepřidávej nové technologie nebo knihovny bez konkrétního přínosu.

## 4. Kritické pravidlo – zachování designu

**Současný vzhled webu je schválený a nesmí být svévolně měněn.**

Bez výslovného požadavku uživatele neměň:

- Barevnou paletu.
- Logo a firemní identitu.
- Fotografie.
- Typografii.
- Rozložení stránek.
- Navigaci.
- Velikosti a styly tlačítek.
- Animace.
- Responzivní chování.
- Textový obsah.
- Vzhled formulářů.
- Vzhled administračního rozhraní.

Technické úpravy prováděj tak, aby výsledná vizuální podoba zůstala zachovaná.

### Firemní barvy

Hlavní barvy:

- `#F4E886`
- `#CE84A8`
- `#472E2D`

Doplňkové barvy:

- `#FFFADD`
- `#F9E1ED`
- `#D3C9C9`

## 5. Architektura aplikace

Dodržuj zásady čistého, modulárního a udržovatelného kódu.

Preferuj:

- Oddělení uživatelského rozhraní od datové logiky.
- Opakovaně použitelné React komponenty.
- Jednoznačné TypeScript typy.
- Přehlednou strukturu adresářů.
- Jednoduché a srozumitelné implementace.
- Minimální množství duplicitního kódu.

Nevytvářej zbytečné abstrakce ani komplikované návrhové vzory.

Respektuj stávající strukturu projektu.

Před významnějšími změnami nejprve analyzuj existující implementaci.

## 6. Budoucí integrace Supabase

Projekt musí být připraven na budoucí připojení:

- Supabase PostgreSQL.
- Supabase Auth.
- Supabase Edge Functions.
- Supabase Storage.

Dokud uživatel výslovně nepožádá o integraci, nepřipojuj žádnou databázi ani externí backend.

Datovou vrstvu navrhuj tak, aby bylo možné demonstrační implementaci později nahradit skutečným backendem bez zásadního přepisování UI.

## 7. Rezervační systém

Zákazníci si budou rezervovat lekce a eventy **bez registrace a bez přihlašování**.

Rezervační formulář může obsahovat:

- Jméno a příjmení.
- E-mail.
- Telefon.
- Počet míst.
- Poznámku.

Rezervační systém musí být do budoucna připraven na:

- Kontrolu volné kapacity.
- Bezpečné vytváření rezervací.
- Zrušení rezervace.
- Správu stavu rezervace.
- Propojení s platební bránou.
- Automatické e-mailové notifikace.

V produkční verzi musí být kontrola kapacity a vytvoření rezervace provedena atomicky na straně databáze.

Frontend nesmí být autoritou pro potvrzení platby ani konečné rozhodnutí o dostupnosti míst.

## 8. Administrace

Administrace je určena pouze oprávněným správcům projektu DVĚ.

Do budoucna bude využívat Supabase Auth.

Administrace musí umožňovat:

- Vytváření a úpravu akcí.
- Nastavování kapacity a ceny.
- Správu rezervací.
- Zobrazování obsazenosti.
- Správu galerie.
- Případnou správu obsahu webu.

V demonstrační verzi jasně rozlišuj mezi simulovaným a skutečným zabezpečením.

Nespoléhej na skrytou URL ani frontendové heslo jako na ochranu produkčních dat.

## 9. Budoucí e-mailové notifikace

Pro automatické e-maily je plánována služba Resend.

Komunikace bude probíhat prostřednictvím bezpečných serverových funkcí Supabase.

Připravuj architekturu na:

- Potvrzení rezervace.
- Platební instrukce.
- Potvrzení platby.
- Zrušení rezervace.
- Připomenutí nadcházející akce.
- Upozornění administrátorům.

Nikdy neumisťuj soukromé API klíče do frontendového kódu.

## 10. Budoucí platby

Projekt bude podporovat platby předem.

Konkrétní platební metoda zatím není vybraná.

Možné varianty:

- QR platby.
- GoPay.
- Comgate.

Platební logiku navrhuj odděleně od uživatelského rozhraní.

Skutečný stav platby musí být ověřován na backendu.

## 11. GitHub Pages

Web musí zůstat kompatibilní se statickým hostingem GitHub Pages.

Zachovej:

- Statický produkční build.
- Funkční routování.
- Správné cesty k souborům.
- Kompatibilitu s nasazením pod adresářem repozitáře.
- Možnost pozdějšího použití vlastní domény.

Nezaváděj závislost na vlastním běžícím Node.js serveru.

Backend bude v budoucnu řešen externě prostřednictvím Supabase.

## 12. Bezpečnost

Při vývoji dodržuj následující pravidla:

- Nikdy nezveřejňuj API klíče, hesla ani jiné tajné údaje.
- Nepoužívej `localStorage` pro ukládání skutečných zákaznických rezervací.
- Důsledně rozlišuj veřejné a administrátorské operace.
- Pro budoucí Supabase integraci počítej s Row Level Security.
- Respektuj zásady ochrany osobních údajů.
- Nevytvářej falešné zabezpečení.
- Nevystavuj citlivé informace ve veřejně přístupných souborech.

## 13. Pravidla pro úpravy kódu

Při každém vývojovém úkolu:

1. Nejprve si prostuduj relevantní existující soubory.
2. Zkontroluj návaznosti na ostatní části aplikace.
3. Zvol nejjednodušší vhodné řešení.
4. Měň pouze soubory související se zadáním.
5. Zachovej stávající funkčnost a design.
6. Po úpravách proveď dostupné relevantní testy.
7. Ověř TypeScript a produkční build, pokud je to vhodné.
8. Stručně vysvětli provedené změny v češtině.

Při větších refaktoringových úkolech nejprve předlož implementační plán.

Při běžných drobných úpravách není nutné žádat o schválení každého kroku.

Nikdy nemaž důležité soubory ani neprováděj destruktivní změny bez výslovného souhlasu.

## 14. Testování

Při změnách ověřuj zejména:

- Funkčnost navigace.
- Zobrazení akcí.
- Rezervační proces.
- Správu rezervací.
- Funkčnost administrace.
- Responzivitu.
- Správné zobrazení obrázků.
- Kompatibilitu s GitHub Pages.
- Úspěšné sestavení aplikace.

Neuváděj, že testy úspěšně proběhly, pokud nebyly skutečně spuštěny.

## 15. Komunikace po dokončení úkolu

Po dokončení významnějšího úkolu stručně uveď:

- Co bylo změněno.
- Které soubory byly upraveny.
- Zda byly provedeny testy.
- Jaká omezení nebo problémy zůstávají.
- Jaké jsou případné doporučené další kroky.

Odpovědi piš česky, srozumitelně a věcně.

Nevysvětluj zbytečně základní programátorské pojmy, pokud o to uživatel nepožádá.

---

## Hlavní dlouhodobý cíl

Vyvíjet projekt DVĚ jako moderní, bezpečnou a rozšiřitelnou webovou aplikaci.

Zachovat kvalitní vizuální identitu značky.

Umožnit budoucí integraci Supabase, automatických e-mailů a online plateb bez nutnosti kompletního přepisování aplikace.

**Prioritou je stabilita, jednoduchost, bezpečnost, udržovatelnost a zachování stávajícího designu.**