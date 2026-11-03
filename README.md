# DVĚ – jóga a pilates

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

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
