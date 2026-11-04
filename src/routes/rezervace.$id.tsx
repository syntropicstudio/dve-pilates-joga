import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Info } from "lucide-react";
import { formatEventDate, formatPrice } from "@/lib/format";
import type { Reservation } from "@/lib/types";
import { reservationStatusLabels } from "@/lib/types";
import { usePublishedEvent } from "@/hooks/data/use-events";
import { useCreateReservation } from "@/hooks/data/use-reservations";
import { reservationService } from "@/services/reservation-service";
import { spotsErrorMessage, type ReservationField } from "@/lib/reservation-validation";
import { PageSkeleton } from "@/components/site/Skeletons";
import { PageLoadError } from "@/components/site/LoadError";

export const Route = createFileRoute("/rezervace/$id")({
  head: () => ({
    meta: [
      { title: "Rezervace místa | DVĚ – jóga a pilates" },
      { name: "description", content: "Rezervuj si místo na akci DVĚ – jóga a pilates." },
      { property: "og:title", content: "Rezervace místa | DVĚ – jóga a pilates" },
      { property: "og:description", content: "Rezervuj si místo na akci DVĚ – jóga a pilates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Booking,
});

type Errors = Partial<Record<"name" | "email" | "phone" | "seats" | "consent" | "form", string>>;

/** Pole modelu → id pole ve formuláři (id zůstávají kvůli zachování markupu). */
const fieldIds: Record<ReservationField, keyof Errors> = {
  customerName: "name",
  customerEmail: "email",
  customerPhone: "phone",
  numberOfSpots: "seats",
};

function Booking() {
  const { id } = Route.useParams();
  const { data: ev, isPending, isError, refetch } = usePublishedEvent(id);
  const createReservation = useCreateReservation();
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState<Reservation | null>(null);

  if (isPending) return <PageSkeleton variant="booking" />;
  if (isError && !ev) return <PageLoadError onRetry={() => void refetch()} />;
  if (!ev)
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="text-4xl">Akce nebyla nalezena</h1>
        <Link to="/" hash="akce" className="btn btn-primary mt-8">Zpět na akce</Link>
      </div>
    );
  const free = ev.availableSpots;

  if (done)
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-rose" />
        <h1 className="mt-4 text-4xl">Ukázková rezervace byla vytvořena</h1>
        <p className="mt-4 text-muted-foreground">
          V této demonstrační verzi se zatím neodesílají e-maily ani neprovádějí platby.
        </p>
        <dl className="mt-8 grid grid-cols-2 gap-3 rounded-3xl bg-card p-6 text-left shadow-[var(--shadow-soft)]">
          <dt className="text-muted-foreground">Číslo</dt><dd className="font-semibold">{done.id}</dd>
          <dt className="text-muted-foreground">Akce</dt><dd className="font-semibold">{ev.title}</dd>
          <dt className="text-muted-foreground">Míst</dt><dd className="font-semibold">{done.numberOfSpots}</dd>
          <dt className="text-muted-foreground">Stav</dt><dd className="font-semibold">{reservationStatusLabels[done.reservationStatus]} (simulace)</dd>
        </dl>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/akce/$id" params={{ id: ev.slug }} className="btn btn-ghost">Zpět na detail akce</Link>
          <Link to="/" hash="akce" className="btn btn-primary">Další akce</Link>
        </div>
      </div>
    );

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ev || createReservation.isPending) return;
    const f = new FormData(e.currentTarget);
    const note = String(f.get("note") ?? "").trim();
    const input = {
      eventId: ev.id,
      customerName: String(f.get("name") ?? "").trim(),
      customerEmail: String(f.get("email") ?? "").trim(),
      customerPhone: String(f.get("phone") ?? "").trim(),
      numberOfSpots: Number(f.get("seats")),
      note: note || undefined,
    };
    // Klientská validace slouží jen pro pohodlí; o dostupnosti rozhoduje repozitář (v produkci databáze).
    const err: Errors = {};
    for (const [field, message] of Object.entries(reservationService.validate(input)))
      err[fieldIds[field as ReservationField]] = message;
    if (!err.seats && input.numberOfSpots > free) err.seats = spotsErrorMessage(free);
    if (!f.get("consent")) err.consent = "Pro pokračování potvrď souhlas.";
    setErrors(err);
    if (Object.keys(err).length) return;
    const res = await createReservation.mutateAsync(input);
    if (!res.ok) setErrors({ form: res.message });
    else setDone(res.reservation);
  }

  const fieldErr = (k: keyof Errors) =>
    errors[k] ? <p id={`${k}-err`} className="mt-1.5 text-sm text-destructive">{errors[k]}</p> : null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 lg:py-16">
      <Link to="/akce/$id" params={{ id: ev.slug }} className="inline-flex items-center gap-2 text-sm font-medium hover:text-rose">
        <ArrowLeft className="h-4 w-4" /> Zpět na detail akce
      </Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <aside className="h-fit rounded-3xl bg-blush p-7">
          <p className="eyebrow">Rezervace</p>
          <h1 className="mt-2 text-3xl">{ev.title}</h1>
          <p className="mt-4 text-muted-foreground">{formatEventDate(ev)} · {ev.timeLabel}</p>
          <p className="text-muted-foreground">{ev.location}</p>
          <p className="mt-4 font-display text-3xl">{formatPrice(ev.price)} <span className="font-sans text-base text-muted-foreground">/ osoba</span></p>
          <p className="mt-1 text-sm">Volná místa: {free}</p>
        </aside>
        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="flex gap-3 rounded-2xl border border-rose/40 bg-card p-4 text-sm">
            <Info className="h-5 w-5 shrink-0 text-rose" />
            <p>Jde o <strong>demonstrační verzi</strong>. Údaje se ukládají pouze v tomto prohlížeči – nezadávej prosím skutečné osobní údaje.</p>
          </div>
          {free === 0 && <p className="rounded-2xl bg-mist/50 p-4 font-semibold">Akce je obsazená, rezervace už není možná.</p>}
          <fieldset disabled={free === 0} className="space-y-5">
            <div>
              <label htmlFor="name" className="mb-1.5 block font-medium">Jméno a příjmení</label>
              <input id="name" name="name" autoComplete="name" className="field" aria-invalid={!!errors.name} aria-describedby="name-err" />
              {fieldErr("name")}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="mb-1.5 block font-medium">E-mail</label>
                <input id="email" name="email" type="email" autoComplete="email" className="field" aria-invalid={!!errors.email} aria-describedby="email-err" />
                {fieldErr("email")}
              </div>
              <div>
                <label htmlFor="phone" className="mb-1.5 block font-medium">Telefon</label>
                <input id="phone" name="phone" type="tel" autoComplete="tel" className="field" aria-invalid={!!errors.phone} aria-describedby="phone-err" />
                {fieldErr("phone")}
              </div>
            </div>
            <div>
              <label htmlFor="seats" className="mb-1.5 block font-medium">Počet míst</label>
              <input id="seats" name="seats" type="number" min={1} max={Math.max(1, free)} defaultValue={1} className="field max-w-32" aria-invalid={!!errors.seats} aria-describedby="seats-err" />
              {fieldErr("seats")}
            </div>
            <div>
              <label htmlFor="note" className="mb-1.5 block font-medium">Poznámka <span className="font-normal text-muted-foreground">(nepovinné)</span></label>
              <textarea id="note" name="note" rows={3} className="field" />
            </div>
            <div>
              <label className="flex items-start gap-3">
                <input type="checkbox" name="consent" className="mt-1 h-5 w-5 accent-[var(--cocoa)]" aria-describedby="consent-err" />
                <span className="text-sm">Beru na vědomí, že jde o ukázkovou rezervaci. Podmínky a zásady zpracování údajů připravujeme.</span>
              </label>
              {fieldErr("consent")}
            </div>
            {errors.form && <p role="alert" className="rounded-2xl bg-destructive/10 p-4 text-destructive">{errors.form}</p>}
            <button type="submit" className="btn btn-primary w-full sm:w-auto">Potvrdit ukázkovou rezervaci</button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
