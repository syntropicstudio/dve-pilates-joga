import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Clock } from "lucide-react";
import type { DveEvent } from "@/lib/types";
import { categoryLabels } from "@/lib/types";
import { formatEventDate, formatPrice } from "@/lib/format";
import { EventVisual } from "./EventVisual";

export function EventCard({ ev, free }: { ev: DveEvent; free: number }) {
  const full = free === 0;
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-soft)] transition-transform duration-300 hover:-translate-y-1">
      <div className="relative aspect-[4/3]">
        <EventVisual ev={ev} />
        <span className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold">
          {categoryLabels[ev.category]}
        </span>
        {ev.isDemo && (
          <span className="absolute right-4 top-4 rounded-full bg-cocoa px-3 py-1 text-xs font-semibold text-cream">Ukázka</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl">{ev.title}</h3>
        <p className="mt-2 text-muted-foreground">{ev.shortDescription}</p>
        <ul className="mt-4 space-y-1.5 text-sm">
          <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-rose" />{formatEventDate(ev)}</li>
          <li className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0 text-rose" />{ev.timeLabel}</li>
          <li className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-rose" />{ev.location}</li>
        </ul>
        <div className="mt-5 flex items-end justify-between gap-3 border-t border-border pt-4">
          <div>
            <p className="font-display text-2xl">{formatPrice(ev.price)}</p>
            <p className={`text-sm ${full ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
              {full ? "Obsazeno" : `Volná místa: ${free} z ${ev.capacity}`}
            </p>
          </div>
          <Link to="/akce/$id" params={{ id: ev.slug }} className="btn btn-sun min-h-11 px-5">
            {full ? "Detail" : "Zobrazit detail"}
          </Link>
        </div>
      </div>
    </article>
  );
}
