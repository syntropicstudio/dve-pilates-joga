-- =============================================================================
-- DVĚ – lokální seed (POUZE pro lokální vývoj: `supabase db reset`).
-- Obsahuje ukázkové akce shodné s src/data/demo.ts. Žádné osobní údaje,
-- žádné účty ani hesla. Do vzdáleného projektu se seed automaticky nenahrává.
-- =============================================================================

insert into public.events (
  slug, title, category, short_description, description,
  start_at, end_at, timezone, time_label, location, price, capacity, bring, status, is_demo
) values
  ('ranni-joga-v-parku', 'Ranní jóga v parku', 'joga',
   'Klidné probuzení těla i mysli pod širým nebem.',
   'Hodinová lekce plynulé jógy vhodná pro všechny úrovně. Začneme dechem, protáhneme celé tělo a zakončíme krátkou relaxací.',
   '2026-12-05T07:30:00Z', '2026-12-05T08:45:00Z', 'Europe/Prague', '8:30–9:45',
   'Ukázkové místo – bude doplněno', 290, 14, array['Podložku', 'Pohodlné oblečení', 'Láhev s vodou'], 'published', true),
  ('pilates-stred-tela', 'Pilates: síla středu těla', 'pilates',
   'Stabilita, držení těla a vědomá práce s hlubokými svaly.',
   'Lekce zaměřená na střed těla, stabilitu pánve a správné držení. Pomalé tempo, důraz na techniku a dech.',
   '2026-12-10T17:00:00Z', '2026-12-10T18:00:00Z', 'Europe/Prague', '18:00–19:00',
   'Ukázkové studio – bude doplněno', 260, 3, array['Podložku', 'Ručník'], 'published', true),
  ('workshop-dech-a-uvolneni', 'Workshop: dech a uvolnění', 'workshop',
   'Tříhodinové setkání o dechu, protažení a odpočinku.',
   'Tematický workshop, kde propojíme dechová cvičení, jemnou jógu a relaxační techniky. Odneseš si sestavu, kterou zvládneš i doma.',
   '2027-01-17T09:00:00Z', '2027-01-17T12:00:00Z', 'Europe/Prague', '10:00–13:00',
   'Ukázkové místo – bude doplněno', 890, 12, array['Podložku', 'Deku', 'Zápisník'], 'published', true),
  ('jarni-vikend-v-prirode', 'Jarní víkend v přírodě', 'pobyt',
   'Dva dny jógy, pilates, procházek a dobrého jídla.',
   'Víkendový pobyt plný pohybu, odpočinku a společných chvil. Program, ubytování a strava budou upřesněny.',
   '2027-04-17T15:00:00Z', '2027-04-19T12:00:00Z', 'Europe/Prague', 'pátek 17:00 – neděle 14:00',
   'Ukázková lokalita – bude doplněno', 5900, 16, array['Podložku', 'Oblečení do přírody', 'Dobrou náladu'], 'published', true),
  ('den-pohybu', 'Den pohybu a radosti', 'event',
   'Jednodenní event: jóga, pilates a společný piknik.',
   'Celý den pohybu – dopoledne jóga, odpoledne pilates a mezi tím společný piknik. Ideální pro začátečníky i pokročilé.',
   '2027-05-22T07:00:00Z', '2027-05-22T14:00:00Z', 'Europe/Prague', '9:00–16:00',
   'Ukázkové místo – bude doplněno', 1490, 20, array['Podložku', 'Něco na piknik', 'Opalovací krém'], 'published', true)
on conflict (slug) do nothing;
