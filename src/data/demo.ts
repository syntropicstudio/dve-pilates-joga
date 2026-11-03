import type { DveEvent, GalleryItem } from "@/lib/types";
import yoga from "@/assets/joga-v-parku.jpg";
import pilates from "@/assets/pilates-studio.jpg";
import workshop from "@/assets/workshop-dech.jpg";
import retreat from "@/assets/jogovy-pobyt.jpg";
import picnic from "@/assets/piknik-po-joze.jpg";
import mats from "@/assets/podlozky-detail.jpg";

/** Ukázková data – NEJDE o skutečnou nabídku. */
export const demoEvents: DveEvent[] = [
  {
    id: "ranni-joga-v-parku",
    title: "Ranní jóga v parku",
    category: "joga",
    image: yoga,
    shortDescription: "Klidné probuzení těla i mysli pod širým nebem.",
    description:
      "Hodinová lekce plynulé jógy vhodná pro všechny úrovně. Začneme dechem, protáhneme celé tělo a zakončíme krátkou relaxací.",
    date: "2026-12-05",
    time: "8:30–9:45",
    location: "Ukázkové místo – bude doplněno",
    price: 290,
    capacity: 14,
    bring: ["Podložku", "Pohodlné oblečení", "Láhev s vodou"],
    published: true,
    demo: true,
  },
  {
    id: "pilates-stred-tela",
    title: "Pilates: síla středu těla",
    category: "pilates",
    image: pilates,
    shortDescription: "Stabilita, držení těla a vědomá práce s hlubokými svaly.",
    description:
      "Lekce zaměřená na střed těla, stabilitu pánve a správné držení. Pomalé tempo, důraz na techniku a dech.",
    date: "2026-12-10",
    time: "18:00–19:00",
    location: "Ukázkové studio – bude doplněno",
    price: 260,
    capacity: 3,
    bring: ["Podložku", "Ručník"],
    published: true,
    demo: true,
  },
  {
    id: "workshop-dech-a-uvolneni",
    title: "Workshop: dech a uvolnění",
    category: "workshop",
    image: workshop,
    shortDescription: "Tříhodinové setkání o dechu, protažení a odpočinku.",
    description:
      "Tematický workshop, kde propojíme dechová cvičení, jemnou jógu a relaxační techniky. Odneseš si sestavu, kterou zvládneš i doma.",
    date: "2027-01-17",
    time: "10:00–13:00",
    location: "Ukázkové místo – bude doplněno",
    price: 890,
    capacity: 12,
    bring: ["Podložku", "Deku", "Zápisník"],
    published: true,
    demo: true,
  },
  {
    id: "jarni-vikend-v-prirode",
    title: "Jarní víkend v přírodě",
    category: "pobyt",
    image: retreat,
    shortDescription: "Dva dny jógy, pilates, procházek a dobrého jídla.",
    description:
      "Víkendový pobyt plný pohybu, odpočinku a společných chvil. Program, ubytování a strava budou upřesněny.",
    date: "2027-04-17",
    endDate: "2027-04-19",
    time: "pátek 17:00 – neděle 14:00",
    location: "Ukázková lokalita – bude doplněno",
    price: 5900,
    capacity: 16,
    bring: ["Podložku", "Oblečení do přírody", "Dobrou náladu"],
    published: true,
    demo: true,
  },
  {
    id: "den-pohybu",
    title: "Den pohybu a radosti",
    category: "event",
    image: picnic,
    shortDescription: "Jednodenní event: jóga, pilates a společný piknik.",
    description:
      "Celý den pohybu – dopoledne jóga, odpoledne pilates a mezi tím společný piknik. Ideální pro začátečníky i pokročilé.",
    date: "2027-05-22",
    time: "9:00–16:00",
    location: "Ukázkové místo – bude doplněno",
    price: 1490,
    capacity: 20,
    bring: ["Podložku", "Něco na piknik", "Opalovací krém"],
    published: true,
    demo: true,
  },
];

export const demoGallery: GalleryItem[] = [
  { id: "g1", caption: "Jóga pod širým nebem – AI ilustrace", src: yoga, ratio: "tall" },
  { id: "g2", caption: "Chvíle pro dech a zklidnění – AI ilustrace", src: workshop, ratio: "square" },
  { id: "g3", caption: "Víkendový pohyb v přírodě – AI ilustrace", src: retreat, ratio: "wide" },
  { id: "g4", caption: "Společný piknik po cvičení – AI ilustrace", src: picnic, ratio: "square" },
  { id: "g5", caption: "Podložka a čas pro sebe – AI ilustrace", src: mats, ratio: "tall" },
  { id: "g6", caption: "Pilates ve studiu – AI ilustrace", src: pilates, ratio: "square" },
];
