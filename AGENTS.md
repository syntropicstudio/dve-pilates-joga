<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Data layer: UI uses only React Query hooks in `src/hooks/data/*`, which call repository interfaces (`src/data/repositories/types.ts`) chosen in `getRepositories()`. Demo implementation is `src/data/repositories/mock/*` (localStorage in `mock-db.ts`); Supabase plan is in `SUPABASE_INTEGRATION.md`. Capacity rules live in `src/lib/capacity.ts`.
- Unknown external links/contacts live as `null` in `src/config/site.ts`; UI shows a "brzy doplníme" fallback instead of invented URLs.
- Demo image updates belong in `mock-db.ts` load normalization, filling only untouched original placeholders, so existing reservations and user-provided images survive.
- GitHub Pages uses an opt-in TanStack Start SPA-shell build and publishes only `dist/client`; preserve the normal Lovable SSR build so preview remains supported.
- GitHub Pages downloads asset pointers into ignored `.output/pages-public` build inputs and prefixes media URLs with the hosting base path; deployment must not depend on the Lovable proxy at runtime.
