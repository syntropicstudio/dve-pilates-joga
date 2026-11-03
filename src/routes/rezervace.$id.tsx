import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Info } from "lucide-react";
import { useStore, freeSeats, createReservation, formatDate, formatPrice } from "@/services/store";
import type { Reservation } from "@/lib/types";
import { statusLabels } from "@/lib/types";

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

function Booking() {
  const { id } = Route.useParams();
  const s = useStore();
  const ev = s.events.find((e) => e.id === id && e.published);
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState<Reservation | null>(null);

  if (!ev)
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="text-4xl">Akce nebyla nalezena</h1>
        <Link to="/" hash="akce" className="btn btn-primary mt-8">Zpět na akce</Link>
      </div>
    );
  const free = freeSeats(s, ev);

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
          <dt className="text-muted-foreground">Míst</dt><dd className="font-semibold">{done.seats}</dd>
          <dt className="text-muted-foreground">Stav</dt><dd className="font-semibold">{statusLabels[done.status]} (simulace)</dd>
        </dl>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/akce/$id" params={{ id: ev.id }} className="btn btn-ghost">Zpět na detail akce</Link>
          <Link to="/" hash="akce" className="btn btn-primary">Další akce</Link>
        </div>
      </div>
    );

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const email = String(f.get("email") ?? "").trim();
    const phone = String(f.get("phone") ?? "").trim();
    const seats = Number(f.get("seats"));
    const note = String(f.get("note") ?? "").trim();
    const err: Errors = {};
    if (name.length < 3) err.name = "Vyplň prosím jméno a příjmení.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err.email = "Zadej platný e-mail.";
    if (!/^\+?[\d\s]{9,16}$/.test(phone)) err.phone = "Zadej platné telefonní číslo.";
    if (!Number.isInteger(seats) || seats < 1) err.seats = "Počet míst musí být alespoň 1.";
    else if (seats > free) err.seats = `Volných míst je už jen ${free}.`;
    if (!f.get("consent")) err.consent = "Pro pokračování potvrď souhlas.";
    setErrors(err);
    if (Object.keys(err).length) return;
    const res = createReservation({ eventId: ev!.id, name, email, phone, seats, note: note || undefined });
    if (!res.ok) setErrors({ form: res.error });
    else setDone(res.reservation);
  }

  const fieldErr = (k: keyof Errors) =>
    errors[k] ? <p id={`${k}-err`} className="mt-1.5 text-sm text-destructive">{errors[k]}</p> : null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 lg:py-16">
      <Link to="/akce/$id" params={{ id: ev.id }} className="inline-flex items-center gap-2 text-sm font-medium hover:text-rose">
        <ArrowLeft className="h-4 w-4" /> Zpět na detail akce
      </Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <aside className="h-fit rounded-3xl bg-blush p-7">
          <p className="eyebrow">Rezervace</p>
          <h1 className="mt-2 text-3xl">{ev.title}</h1>
          <p className="mt-4 text-muted-foreground">{formatDate(ev)} · {ev.time}</p>
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
