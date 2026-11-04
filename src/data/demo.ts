import type { DveEvent, GalleryItem } from "@/lib/types";
import yoga from "@/assets/joga-v-parku.jpg";
import pilates from "@/assets/pilates-studio.jpg";
import workshop from "@/assets/workshop-dech.jpg";
import retreat from "@/assets/jogovy-pobyt.jpg";
import picnic from "@/assets/piknik-po-joze.jpg";
import mats from "@/assets/podlozky-detail.jpg";
import { DEFAULT_TIMEZONE } from "@/lib/event-schedule";

const DEMO_CREATED_AT = "2026-01-01T00:00:00.000Z";

/** Ukázková data – NEJDE o skutečnou nabídku. */
export const demoEvents: DveEvent[] = [
  {
    id: "ranni-joga-v-parku",
    slug: "ranni-joga-v-parku",
    title: "Ranní jóga v parku",
    category: "joga",
    image: yoga,
    shortDescription: "Klidné probuzení těla i mysli pod širým nebem.",
    description:
      "Hodinová lekce plynulé jógy vhodná pro všechny úrovně. Začneme dechem, protáhneme celé tělo a zakončíme krátkou relaxací.",
    startAt: "2026-12-05T07:30:00.000Z",
    endAt: "2026-12-05T08:45:00.000Z",
    timezone: DEFAULT_TIMEZONE,
    timeLabel: "8:30–9:45",
    location: "Ukázkové místo – bude doplněno",
    price: 290,
    currency: "CZK",
    capacity: 14,
    bring: ["Podložku", "Pohodlné oblečení", "Láhev s vodou"],
    status: "published",
    isDemo: true,
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_CREATED_AT,
  },
  {
    id: "pilates-stred-tela",
    slug: "pilates-stred-tela",
    title: "Pilates: síla středu těla",
    category: "pilates",
    image: pilates,
    shortDescription: "Stabilita, držení těla a vědomá práce s hlubokými svaly.",
    description:
      "Lekce zaměřená na střed těla, stabilitu pánve a správné držení. Pomalé tempo, důraz na techniku a dech.",
    startAt: "2026-12-10T17:00:00.000Z",
    endAt: "2026-12-10T18:00:00.000Z",
    timezone: DEFAULT_TIMEZONE,
    timeLabel: "18:00–19:00",
    location: "Ukázkové studio – bude doplněno",
    price: 260,
    currency: "CZK",
    capacity: 3,
    bring: ["Podložku", "Ručník"],
    status: "published",
    isDemo: true,
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_CREATED_AT,
  },
  {
    id: "workshop-dech-a-uvolneni",
    slug: "workshop-dech-a-uvolneni",
    title: "Workshop: dech a uvolnění",
    category: "workshop",
    image: workshop,
    shortDescription: "Tříhodinové setkání o dechu, protažení a odpočinku.",
    description:
      "Tematický workshop, kde propojíme dechová cvičení, jemnou jógu a relaxační techniky. Odneseš si sestavu, kterou zvládneš i doma.",
    startAt: "2027-01-17T09:00:00.000Z",
    endAt: "2027-01-17T12:00:00.000Z",
    timezone: DEFAULT_TIMEZONE,
    timeLabel: "10:00–13:00",
    location: "Ukázkové místo – bude doplněno",
    price: 890,
    currency: "CZK",
    capacity: 12,
    bring: ["Podložku", "Deku", "Zápisník"],
    status: "published",
    isDemo: true,
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_CREATED_AT,
  },
  {
    id: "jarni-vikend-v-prirode",
    slug: "jarni-vikend-v-prirode",
    title: "Jarní víkend v přírodě",
    category: "pobyt",
    image: retreat,
    shortDescription: "Dva dny jógy, pilates, procházek a dobrého jídla.",
    description:
      "Víkendový pobyt plný pohybu, odpočinku a společných chvil. Program, ubytování a strava budou upřesněny.",
    startAt: "2027-04-17T15:00:00.000Z",
    endAt: "2027-04-19T12:00:00.000Z",
    timezone: DEFAULT_TIMEZONE,
    timeLabel: "pátek 17:00 – neděle 14:00",
    location: "Ukázková lokalita – bude doplněno",
    price: 5900,
    currency: "CZK",
    capacity: 16,
    bring: ["Podložku", "Oblečení do přírody", "Dobrou náladu"],
    status: "published",
    isDemo: true,
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_CREATED_AT,
  },
  {
    id: "den-pohybu",
    slug: "den-pohybu",
    title: "Den pohybu a radosti",
    category: "event",
    image: picnic,
    shortDescription: "Jednodenní event: jóga, pilates a společný piknik.",
    description:
      "Celý den pohybu – dopoledne jóga, odpoledne pilates a mezi tím společný piknik. Ideální pro začátečníky i pokročilé.",
    startAt: "2027-05-22T07:00:00.000Z",
    endAt: "2027-05-22T14:00:00.000Z",
    timezone: DEFAULT_TIMEZONE,
    timeLabel: "9:00–16:00",
    location: "Ukázkové místo – bude doplněno",
    price: 1490,
    currency: "CZK",
    capacity: 20,
    bring: ["Podložku", "Něco na piknik", "Opalovací krém"],
    status: "published",
    isDemo: true,
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_CREATED_AT,
  },
];

export const demoGallery: GalleryItem[] = [
  { id: "g1", caption: "Jóga pod širým nebem – AI ilustrace", src: yoga, ratio: "tall", sortOrder: 1 },
  { id: "g2", caption: "Chvíle pro dech a zklidnění – AI ilustrace", src: workshop, ratio: "square", sortOrder: 2 },
  { id: "g3", caption: "Víkendový pohyb v přírodě – AI ilustrace", src: retreat, ratio: "wide", sortOrder: 3 },
  { id: "g4", caption: "Společný piknik po cvičení – AI ilustrace", src: picnic, ratio: "square", sortOrder: 4 },
  { id: "g5", caption: "Podložka a čas pro sebe – AI ilustrace", src: mats, ratio: "tall", sortOrder: 5 },
  { id: "g6", caption: "Pilates ve studiu – AI ilustrace", src: pilates, ratio: "square", sortOrder: 6 },
];
