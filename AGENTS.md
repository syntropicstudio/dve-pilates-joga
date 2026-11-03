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

- Demo data layer lives in `src/services/store.ts` (localStorage + useSyncExternalStore); UI must only use its functions so a real backend can replace it later.
- Unknown external links/contacts live as `null` in `src/config/site.ts`; UI shows a "brzy doplníme" fallback instead of invented URLs.
- Demo image updates belong in the store's load normalization, filling only untouched original placeholders, so existing reservations and user-provided images survive.
