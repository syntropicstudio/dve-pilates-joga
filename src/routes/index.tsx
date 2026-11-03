import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Instagram, Mail, MapPin, X } from "lucide-react";
import hero from "@/assets/zakladatelky-trava.jpg.asset.json";
import about from "@/assets/zakladatelky-o-nas.jpg.asset.json";
import symbol from "@/assets/dve-symbol.png.asset.json";
import { site } from "@/config/site";
import { useStore, freeSeats } from "@/services/store";
import { categoryLabels, type EventCategory } from "@/lib/types";
import { EventCard } from "@/components/site/EventCard";
import { FreeLessonVideo } from "@/components/site/VideoSection";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DVĚ | jóga a pilates" },
      { name: "description", content: site.description },
      { property: "og:title", content: "DVĚ | jóga a pilates" },
      { property: "og:description", content: site.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      <Hero />
      <About />
      <Online />
      <FreeLesson />
      <Events />
      <Gallery />
      <Faq />
      <Contact />
    </>
  );
}

function Hero() {
  return (
    <section id="uvod" className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 blob bg-sun/50 drift" aria-hidden />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-64 w-64 blob bg-blush drift" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14 lg:pb-24 lg:pt-16">
        <div className="reveal order-2 lg:order-1">
          <p className="eyebrow">jóga a pilates · online i naživo</p>
          <h1 className="mt-4 text-5xl sm:text-6xl lg:text-7xl">
            Pohyb, který tě <em className="font-normal italic text-rose">vrátí</em> k sobě.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">{site.intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/" hash="akce" className="btn btn-primary">Objevit naše akce <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/" hash="online" className="btn btn-sun">Cvičit online</Link>
          </div>
        </div>
        <div className="reveal relative order-1 lg:order-2">
          <div className="overflow-hidden rounded-[2.5rem] shadow-[var(--shadow-lift)] lg:rounded-[3.5rem_1.5rem_3.5rem_1.5rem]">
            <img
              src={hero.url}
              alt="Dvě zakladatelky DVĚ se smějí, leží hlavami k sobě v trávě"
              className="aspect-[4/3] w-full object-cover"
              width={1920}
              height={1280}
              fetchPriority="high"
            />
          </div>
          <img src={symbol.url} alt="" aria-hidden className="absolute -bottom-8 -left-6 h-24 w-24 drift sm:h-28 sm:w-28" />
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="o-nas" className="bg-blush/60 py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2">
        <div className="relative">
          <div className="absolute -right-4 -top-4 h-full w-full rounded-[3rem] bg-sun/70" aria-hidden />
          <img
            src={about.url}
            alt="Zakladatelky DVĚ sedí spolu v trávě"
            loading="lazy"
            className="relative aspect-[3/2] w-full rounded-[3rem] object-cover"
            width={1400}
            height={933}
          />
        </div>
        <div>
          <p className="eyebrow">O nás</p>
          <h2 className="mt-3 text-4xl sm:text-5xl">Jsme DVĚ. A pohyb nás spojuje.</h2>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-muted-foreground">
            <p>
              DVĚ vzniklo z jednoduché myšlenky – sdílet radost z pohybu a vytvářet prostor, kde se každý může cítit dobře.
              Věříme, že jóga a pilates nejsou o dokonalosti, ale o hledání rovnováhy, síly a chvíle pro sebe.
            </p>
            <p>Chtěly jsme spojit to, co máme rády nejvíc – vědomý pohyb, přirozenost a setkávání s lidmi. A tak vzniklo DVĚ.</p>
            <p>
              Ať se potkáme na podložce doma, na společné lekci nebo během víkendového pobytu, důležité je pro nás jediné:
              abys odcházel/a s dobrým pocitem a chutí se vrátit.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const onlineCards = [
  { t: "Jóga pro každodenní pohodu", d: "Krátké i delší praxe, které se vejdou do běžného dne.", tone: "bg-sun/60" },
  { t: "Pilates pro sílu a stabilitu", d: "Posílení středu těla a lepší držení – v klidném tempu.", tone: "bg-blush" },
  { t: "Protažení, uvolnění a relaxace", d: "Chvíle pro tělo i hlavu, když potřebuješ zpomalit.", tone: "bg-mist/50" },
];

function Online() {
  return (
    <section id="online" className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5">
        <div className="max-w-2xl">
          <p className="eyebrow">Online lekce na Forendors</p>
          <h2 className="mt-3 text-4xl sm:text-5xl">Tvoje podložka. Tvůj čas. Tvoje tempo.</h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Cvič s námi z pohodlí domova. Na Forendors najdeš naše lekce jógy a pilates, ke kterým se můžeš vracet kdykoli.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {onlineCards.map((c, i) => (
            <div key={c.t} className={`rounded-3xl p-8 ${c.tone} ${i === 1 ? "md:translate-y-6" : ""}`}>
              <span className="font-display text-5xl text-cocoa/30">0{i + 1}</span>
              <h3 className="mt-6 text-2xl">{c.t}</h3>
              <p className="mt-3 text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          {site.forendorsUrl ? (
            <a href={site.forendorsUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
              Prozkoumat naše Forendors <ArrowRight className="h-4 w-4" />
            </a>
          ) : (
            <>
              <button type="button" disabled className="btn btn-primary">Prozkoumat naše Forendors</button>
              <span className="text-sm text-muted-foreground">Odkaz brzy doplníme.</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function FreeLesson() {
  return (
    <section className="bg-sun/30 py-20 lg:py-28">
      <div className="mx-auto max-w-5xl px-5 text-center">
        <p className="eyebrow">Zdarma</p>
        <h2 className="mt-3 text-4xl sm:text-5xl">Vyzkoušej si lekci zdarma</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Než se společně potkáme na podložce, pojď si s námi zacvičit z pohodlí domova.
        </p>
        <div className="mt-10"><FreeLessonVideo /></div>
      </div>
    </section>
  );
}

function Events() {
  const s = useStore();
  const [cat, setCat] = useState<EventCategory | "vse">("vse");
  const events = useMemo(
    () =>
      s.events
        .filter((e) => e.published && (cat === "vse" || e.category === cat))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [s.events, cat],
  );
  const cats: (EventCategory | "vse")[] = ["vse", "joga", "pilates", "workshop", "event", "pobyt"];
  return (
    <section id="akce" className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5">
        <div className="max-w-2xl">
          <p className="eyebrow">Akce a rezervace</p>
          <h2 className="mt-3 text-4xl sm:text-5xl">Pojďme se potkat naživo.</h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Objev naše společné lekce, workshopy a víkendové akce. Vyber si zážitek, který ti sedne, a rezervuj si své místo.
          </p>
        </div>
        <p className="mt-6 inline-block rounded-2xl bg-blush px-4 py-2 text-sm">
          Zobrazené akce jsou <strong>ukázkové</strong> – termíny ani ceny zatím nejsou skutečnou nabídkou.
        </p>
        <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filtr podle typu akce">
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
              className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${cat === c ? "bg-cocoa text-cream" : "bg-card hover:bg-blush"}`}
            >
              {c === "vse" ? "Vše" : categoryLabels[c]}
            </button>
          ))}
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => <EventCard key={ev.id} ev={ev} free={freeSeats(s, ev)} />)}
        </div>
        {events.length === 0 && <p className="mt-10 text-muted-foreground">V této kategorii teď nic nechystáme. Zkus jinou.</p>}
      </div>
    </section>
  );
}

function Gallery() {
  const { gallery } = useStore();
  const [open, setOpen] = useState<number | null>(null);
  const item = open !== null ? gallery[open] : null;
  const ratio = { tall: "row-span-2", square: "", wide: "sm:col-span-2" };
  const tones = ["bg-blush", "bg-sun/50", "bg-mist/50", "bg-rose/30"];
  return (
    <section id="galerie" className="bg-blush/50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5">
        <p className="eyebrow">Galerie</p>
        <h2 className="mt-3 max-w-2xl text-4xl sm:text-5xl">Momentky z našich společných chvil</h2>
        <p className="mt-4 text-muted-foreground">Fotografie z prvních akcí sem brzy přidáme.</p>
        <div className="mt-10 grid auto-rows-[180px] grid-cols-2 gap-4 lg:grid-cols-4">
          {gallery.map((g, i) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setOpen(i)}
              className={`group relative overflow-hidden rounded-3xl ${ratio[g.ratio]} ${tones[i % 4]}`}
              aria-label={`Otevřít: ${g.caption}`}
            >
              {g.src ? (
                <img src={g.src} alt={g.caption} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <span className="grid h-full place-items-center p-4 text-center text-sm text-cocoa/60">
                  <img src={symbol.url} alt="" className="mb-2 h-10 w-10 opacity-60" />
                  {g.caption}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {item && (
        <div role="dialog" aria-modal="true" aria-label={item.caption} className="fixed inset-0 z-50 grid place-items-center bg-cocoa/80 p-5" onClick={() => setOpen(null)}>
          <button type="button" className="absolute right-5 top-5 grid h-12 w-12 place-items-center rounded-full bg-cream text-cocoa" aria-label="Zavřít náhled" onClick={() => setOpen(null)} autoFocus>
            <X className="h-5 w-5" />
          </button>
          <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-blush" onClick={(e) => e.stopPropagation()}>
            {item.src ? (
              <img src={item.src} alt={item.caption} className="max-h-[85vh] w-full object-contain" />
            ) : (
              <div className="grid aspect-video place-items-center text-cocoa/60">{item.caption}</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

const faqs = [
  ["Jsou vaše lekce vhodné i pro začátečníky?", "Ano. Lekce vedeme tak, aby se v nich cítil dobře každý – nabízíme jednodušší i náročnější varianty cviků."],
  ["Musím mít vlastní podložku?", "Pracovní návrh: doporučujeme vlastní podložku. Zda bude možné podložku zapůjčit, upřesníme u konkrétní akce."],
  ["Jak si rezervuji místo na akci?", "Vyber si akci v sekci Akce a rezervace, otevři její detail a klikni na „Rezervovat místo“. Vyplníš krátký formulář."],
  ["Jak probíhá platba za lekci nebo event?", "Pracovní návrh: počítáme s platbou předem. Konkrétní způsob platby zatím připravujeme a doplníme ho sem."],
  ["Co když se nemohu zúčastnit?", "Pracovní návrh: storno podmínky teprve připravujeme. Do té doby nám prosím dej vědět co nejdřív."],
  ["Jak fungují online lekce na Forendors?", "Na Forendors najdeš naše nahrané lekce, ke kterým se můžeš vracet kdykoli. Přístup získáš přímo na platformě Forendors."],
  ["Mohou se účastnit i muži?", "Samozřejmě! Naše lekce jsou otevřené všem bez ohledu na pohlaví, věk nebo zkušenosti."],
];

function Faq() {
  return (
    <section id="faq" className="py-20 lg:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <p className="eyebrow">FAQ</p>
          <h2 className="mt-3 text-4xl sm:text-5xl">Časté dotazy</h2>
          <img src={symbol.url} alt="" aria-hidden className="mt-8 hidden h-32 w-32 drift lg:block" loading="lazy" />
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map(([q, a]) => (
            <AccordionItem key={q} value={q} className="border-border">
              <AccordionTrigger className="py-5 text-left font-display text-xl hover:no-underline">{q}</AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function Contact() {
  const rows = [
    { icon: Mail, label: "E-mail", value: site.email, href: site.email ? `mailto:${site.email}` : null },
    { icon: Instagram, label: "Instagram", value: site.instagramUrl ? "Sleduj nás" : null, href: site.instagramUrl },
    { icon: ArrowRight, label: "Forendors", value: site.forendorsUrl ? "Online lekce" : null, href: site.forendorsUrl },
    { icon: MapPin, label: "Kde působíme", value: site.location, href: null },
  ];
  return (
    <section id="kontakt" className="pb-24">
      <div className="mx-auto max-w-7xl px-5">
        <div className="relative overflow-hidden rounded-[3rem] bg-sun/60 px-6 py-14 sm:px-14">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 blob bg-rose/40" aria-hidden />
          <div className="relative grid gap-10 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Kontakt</p>
              <h2 className="mt-3 text-4xl sm:text-5xl">Zůstaňme v kontaktu</h2>
              <p className="mt-5 max-w-md text-lg text-muted-foreground">
                Máš otázku, nápad nebo se s námi chceš jen spojit? Napiš nám. Rády o tobě uslyšíme.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {rows.map((r) => (
                <li key={r.label} className="rounded-2xl bg-background/80 p-5">
                  <r.icon className="h-5 w-5 text-rose" />
                  <p className="mt-3 text-sm text-muted-foreground">{r.label}</p>
                  {r.value && r.href ? (
                    <a href={r.href} target={r.href.startsWith("mailto") ? undefined : "_blank"} rel="noreferrer" className="font-semibold underline-offset-4 hover:underline">{r.value}</a>
                  ) : (
                    <p className="font-semibold">{r.value ?? "Brzy doplníme"}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
