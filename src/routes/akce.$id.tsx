import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Clock, MapPin, Users, User } from "lucide-react";
import { formatEventDate, formatPrice } from "@/lib/format";
import { usePublishedEvent } from "@/hooks/data/use-events";
import { PageSkeleton } from "@/components/site/Skeletons";
import { PageLoadError } from "@/components/site/LoadError";
import { categoryLabels } from "@/lib/types";
import { EventVisual } from "@/components/site/EventVisual";

export const Route = createFileRoute("/akce/$id")({
  head: () => ({
    meta: [
      { title: "Detail akce | DVĚ – jóga a pilates" },
      { name: "description", content: "Podrobnosti o akci DVĚ – termín, místo, cena a volná místa." },
      { property: "og:title", content: "Detail akce | DVĚ – jóga a pilates" },
      { property: "og:description", content: "Podrobnosti o akci DVĚ – termín, místo, cena a volná místa." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventDetail,
});

function EventDetail() {
  const { id } = Route.useParams();
  const { data: ev, isPending, isError, refetch } = usePublishedEvent(id);
  if (isPending) return <PageSkeleton variant="detail" />;
  if (isError && !ev) return <PageLoadError onRetry={() => void refetch()} />;
  if (!ev)
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="text-4xl">Tuhle akci jsme nenašly</h1>
        <p className="mt-3 text-muted-foreground">Možná už proběhla nebo byla skryta.</p>
        <Link to="/" hash="akce" className="btn btn-primary mt-8">Zpět na akce</Link>
      </div>
    );
  const free = ev.availableSpots;
  const full = free === 0;
  return (
    <article className="mx-auto max-w-6xl px-5 py-10 lg:py-16">
      <Link to="/" hash="akce" className="inline-flex items-center gap-2 text-sm font-medium hover:text-rose">
        <ArrowLeft className="h-4 w-4" /> Všechny akce
      </Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="aspect-[4/3] overflow-hidden rounded-[2.5rem]"><EventVisual ev={ev} /></div>
        <div>
          <p className="eyebrow">{categoryLabels[ev.category]}{ev.isDemo && " · ukázková akce"}</p>
          <h1 className="mt-3 text-4xl sm:text-5xl">{ev.title}</h1>
          <p className="mt-5 text-lg text-muted-foreground">{ev.description}</p>
          <ul className="mt-6 space-y-3">
            <li className="flex gap-3"><CalendarDays className="h-5 w-5 shrink-0 text-rose" />{formatEventDate(ev)}</li>
            <li className="flex gap-3"><Clock className="h-5 w-5 shrink-0 text-rose" />{ev.timeLabel}</li>
            <li className="flex gap-3"><MapPin className="h-5 w-5 shrink-0 text-rose" />{ev.location}</li>
            <li className="flex gap-3"><Users className="h-5 w-5 shrink-0 text-rose" />Kapacita {ev.capacity} · volných {free}</li>
            {ev.instructor && <li className="flex gap-3"><User className="h-5 w-5 shrink-0 text-rose" />{ev.instructor}</li>}
          </ul>
          {ev.bring.length > 0 && (
            <div className="mt-6 rounded-2xl bg-blush p-5">
              <p className="font-semibold">Co si vzít s sebou</p>
              <ul className="mt-2 list-inside list-disc text-muted-foreground">{ev.bring.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <p className="font-display text-4xl">{formatPrice(ev.price)}</p>
            {full ? (
              <span className="btn bg-mist text-cocoa" aria-disabled>Obsazeno</span>
            ) : (
              <Link to="/rezervace/$id" params={{ id: ev.slug }} className="btn btn-primary">Rezervovat místo</Link>
            )}
          </div>
          {ev.isDemo && <p className="mt-4 text-sm text-muted-foreground">Termín, cena i místo jsou ukázkové údaje.</p>}
        </div>
      </div>
    </article>
  );
}
