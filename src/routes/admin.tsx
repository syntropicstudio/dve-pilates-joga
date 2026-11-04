import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Download, Eye, EyeOff, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { formatEventDate, formatPrice } from "@/lib/format";
import { reservationsToCsv } from "@/lib/csv";
import { buildSchedule, DEFAULT_TIMEZONE, toZonedDate } from "@/lib/event-schedule";
import {
  categoryLabels, eventStatusLabels, paymentStatusLabels, reservationStatusLabels,
  type AdminEvent, type DveEvent, type EventCategory, type ReservationStatus,
} from "@/lib/types";
import type { EventInput, UnscheduledLegacyEvent } from "@/data/repositories";
import { useAdminEvents, useRemoveEvent, useResetDemo, useUnscheduledLegacyEvents, useUpsertEvent } from "@/hooks/data/use-events";
import { useAdminReservations, useUpdateReservationStatus } from "@/hooks/data/use-reservations";
import { useGallery, useSaveGallery } from "@/hooks/data/use-gallery";
import { SkeletonBlock, TableRowsSkeleton } from "@/components/site/Skeletons";
import { LoadError } from "@/components/site/LoadError";
import { errorMessage } from "@/lib/errors";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Demo administrace | DVĚ" },
      { name: "description", content: "Demonstrační administrace webu DVĚ." },
      { property: "og:title", content: "Demo administrace | DVĚ" },
      { property: "og:description", content: "Demonstrační administrace webu DVĚ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Admin,
});

type Tab = "prehled" | "akce" | "rezervace" | "obsah";

function Admin() {
  const [tab, setTab] = useState<Tab>("prehled");
  const resetDemo = useResetDemo();
  const tabs: [Tab, string][] = [["prehled", "Přehled"], ["akce", "Akce"], ["rezervace", "Rezervace"], ["obsah", "Galerie"]];
  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <div className="flex gap-3 rounded-2xl border-2 border-rose bg-blush p-5">
        <AlertTriangle className="h-6 w-6 shrink-0 text-rose" />
        <div className="text-sm">
          <p className="font-semibold">Demo administrace – není zabezpečená</p>
          <p className="mt-1 text-muted-foreground">
            Všechny změny se ukládají jen v tomto prohlížeči (localStorage). Neuvidí je ostatní návštěvníci, nesynchronizují se mezi
            zařízeními, nejsou bezpečným úložištěm osobních údajů, nehlídají kapacitu napříč návštěvníky a po vymazání dat prohlížeče
            zmizí. Pro ostrý provoz je potřeba backend se skutečným přihlášením.
          </p>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl">Demo administrace</h1>
        {resetDemo.available && (
          <button type="button" className="btn btn-ghost min-h-11" onClick={() => confirm("Obnovit ukázková data do výchozího stavu?") && resetDemo.mutate()}>
            <RotateCcw className="h-4 w-4" /> Resetovat demo data
          </button>
        )}
      </div>
      {resetDemo.isError && <LoadError className="mt-4" message="Demo data se nepodařilo obnovit." />}
      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)}
            className={`min-h-11 rounded-full px-5 text-sm font-medium ${tab === k ? "bg-cocoa text-cream" : "bg-card hover:bg-blush"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="mt-8">
        {tab === "prehled" && <Overview go={setTab} />}
        {tab === "akce" && <EventsAdmin />}
        {tab === "rezervace" && <ReservationsAdmin />}
        {tab === "obsah" && <GalleryAdmin />}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-soft)]">
      <p className="text-sm text-muted-foreground">{label}</p>
      {value === null ? <SkeletonBlock className="mt-3 h-9 w-20" /> : <p className="mt-2 font-display text-4xl">{value}</p>}
    </div>
  );
}

const eventTitle = (events: Pick<DveEvent, "id" | "title">[] | undefined, id: string, extra: Pick<DveEvent, "id" | "title">[] = []) =>
  (events?.find((e) => e.id === id) ?? extra.find((e) => e.id === id))?.title;

/** Admin pohled -> vstup pro uložení (bez dopočítaných údajů o obsazenosti). */
function toEventInput(e: AdminEvent): EventInput {
  const { availableSpots: _a, blockedSpots: _b, createdAt: _c, updatedAt: _u, ...input } = e;
  return input;
}

function Overview({ go }: { go: (t: Tab) => void }) {
  const eventsQuery = useAdminEvents();
  const reservationsQuery = useAdminReservations();
  const { data: events } = eventsQuery;
  const { data: reservations } = reservationsQuery;
  const failed = eventsQuery.isError || reservationsQuery.isError;
  // Při chybě se místo nekonečného skeletonu zobrazí pomlčka a chybové hlášení.
  const stat = <T,>(ready: T | undefined, value: (v: T) => string | number, error: boolean) =>
    ready !== undefined ? value(ready) : error ? "—" : null;
  const today = toZonedDate(new Date().toISOString(), DEFAULT_TIMEZONE);
  const cap = events?.reduce((n, e) => n + e.capacity, 0) ?? 0;
  const taken = events?.reduce((n, e) => n + e.blockedSpots, 0) ?? 0;
  return (
    <div className="space-y-8">
      {failed && (
        <LoadError
          message="Část dat se nepodařilo načíst."
          onRetry={() => void Promise.all([eventsQuery.refetch(), reservationsQuery.refetch()])}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Akcí celkem" value={stat(events, (e) => e.length, eventsQuery.isError)} />
        <Stat label="Nadcházející akce" value={stat(events, (e) => e.filter((x) => toZonedDate(x.startAt, x.timezone) >= today).length, eventsQuery.isError)} />
        <Stat label="Rezervací" value={stat(reservations, (r) => r.length, reservationsQuery.isError)} />
        <Stat label="Obsazenost" value={stat(events, () => `${taken} / ${cap}`, eventsQuery.isError)} />
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary min-h-11" onClick={() => go("akce")}><Plus className="h-4 w-4" /> Přidat akci</button>
        <button className="btn btn-sun min-h-11" onClick={() => go("rezervace")}>Spravovat rezervace</button>
      </div>
      <div>
        <h2 className="text-2xl">Nedávné rezervace</h2>
        {!reservations ? (
          reservationsQuery.isError ? null : <SkeletonBlock className="mt-4 h-16 w-full" />
        ) : reservations.length === 0 ? (
          <p className="mt-3 text-muted-foreground">Zatím žádné. Vytvoř si ukázkovou rezervaci na veřejném webu.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-3xl bg-card">
            {reservations.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 p-4">
                <span><strong>{r.customerName}</strong> · {eventTitle(events, r.eventId)}</span>
                <span className="text-sm text-muted-foreground">{r.numberOfSpots} míst · {reservationStatusLabels[r.reservationStatus]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Hodnoty formuláře akce – pole formuláře zůstávají stejná jako v původní demo administraci. */
interface EventFormValues {
  existing: AdminEvent | null;
  /** Akce z v1 bez jednoznačného času – po uložení se stane běžnou akcí se stejným id. */
  legacy: UnscheduledLegacyEvent | null;
  title: string; category: EventCategory; instructor?: string | undefined; date: string; endDate: string;
  timeLabel: string; location: string; price: number; capacity: number; shortDescription: string;
  description: string; bring: string[]; image?: string | undefined; published: boolean;
}

const emptyEvent = (): EventFormValues => ({
  existing: null, legacy: null, title: "", category: "joga", shortDescription: "", description: "",
  date: toZonedDate(new Date().toISOString(), DEFAULT_TIMEZONE), endDate: "",
  timeLabel: "", location: "", price: 0, capacity: 10, bring: [], published: false,
});

function toFormValues(e: AdminEvent): EventFormValues {
  const date = toZonedDate(e.startAt, e.timezone);
  const end = toZonedDate(e.endAt, e.timezone);
  return {
    existing: e, legacy: null, title: e.title, category: e.category, instructor: e.instructor, date, endDate: end !== date ? end : "",
    timeLabel: e.timeLabel, location: e.location, price: e.price, capacity: e.capacity, shortDescription: e.shortDescription,
    description: e.description, bring: e.bring, image: e.image, published: e.status === "published",
  };
}

function legacyToFormValues(e: UnscheduledLegacyEvent): EventFormValues {
  return {
    existing: null, legacy: e, title: e.title, category: e.category, instructor: e.instructor, date: e.date,
    endDate: e.endDate ?? "", timeLabel: e.timeLabel, location: e.location, price: e.price, capacity: e.capacity,
    shortDescription: e.shortDescription, description: e.description, bring: e.bring, image: e.image, published: e.wasPublished,
  };
}

function EventsAdmin() {
  const { data: events, isPending, isError, refetch } = useAdminEvents();
  const { data: unscheduled = [] } = useUnscheduledLegacyEvents();
  const upsertEvent = useUpsertEvent();
  const removeEvent = useRemoveEvent();
  const [editing, setEditing] = useState<EventFormValues | null>(null);
  const mutationError = upsertEvent.error ?? removeEvent.error;
  return (
    <div>
      <button className="btn btn-primary min-h-11" onClick={() => setEditing(emptyEvent())}><Plus className="h-4 w-4" /> Nová akce</button>
      {isError && <LoadError className="mt-6" message="Akce se nepodařilo načíst." onRetry={() => void refetch()} />}
      {mutationError && <LoadError className="mt-6" message={errorMessage(mutationError, "Změnu se nepodařilo uložit. Zkus to prosím znovu.")} />}
      <div className="mt-6 overflow-x-auto rounded-3xl bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr><th className="p-4">Akce</th><th className="p-4">Termín</th><th className="p-4">Cena</th><th className="p-4">Obsazenost</th><th className="p-4">Stav</th><th className="p-4 text-right">Akce</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isPending && <TableRowsSkeleton cols={6} />}
            {events?.map((e) => (
              <tr key={e.id}>
                <td className="p-4"><p className="font-semibold">{e.title}</p><p className="text-muted-foreground">{categoryLabels[e.category]}</p></td>
                <td className="p-4">{formatEventDate(e)}</td>
                <td className="p-4">{formatPrice(e.price)}</td>
                <td className="p-4">{e.capacity - e.availableSpots} / {e.capacity}</td>
                <td className="p-4">{eventStatusLabels[e.status]}</td>
                <td className="p-4">
                  <div className="flex justify-end gap-1">
                    <IconBtn label={e.status === "published" ? "Skrýt" : "Publikovat"} onClick={() => upsertEvent.mutate({ ...toEventInput(e), status: e.status === "published" ? "draft" : "published" })}>{e.status === "published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</IconBtn>
                    <IconBtn label="Upravit" onClick={() => setEditing(toFormValues(e))}><Pencil className="h-4 w-4" /></IconBtn>
                    <IconBtn label="Odstranit" onClick={() => confirm(`Odstranit akci „${e.title}“ i její rezervace?`) && removeEvent.mutate(e.id)}><Trash2 className="h-4 w-4" /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
            {unscheduled.map((e) => (
              <tr key={e.id}>
                <td className="p-4"><p className="font-semibold">{e.title}</p><p className="text-muted-foreground">{categoryLabels[e.category]}</p></td>
                <td className="p-4">{e.date}{e.endDate ? ` – ${e.endDate}` : ""} · {e.timeLabel || "čas neuveden"}</td>
                <td className="p-4">{formatPrice(e.price)}</td>
                <td className="p-4">—</td>
                <td className="p-4">Doplň čas akce</td>
                <td className="p-4">
                  <div className="flex justify-end gap-1">
                    <IconBtn label="Upravit" onClick={() => setEditing(legacyToFormValues(e))}><Pencil className="h-4 w-4" /></IconBtn>
                    <IconBtn label="Odstranit" onClick={() => confirm(`Odstranit akci „${e.title}“ i její rezervace?`) && removeEvent.mutate(e.id)}><Trash2 className="h-4 w-4" /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <EventForm ev={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className="grid h-10 w-10 place-items-center rounded-full hover:bg-blush">{children}</button>;
}

/** Pole formuláře. Musí být definované mimo EventForm – jinak React při každém renderu
 *  (např. po zobrazení chyby) pole znovu vytvoří a rozepsané hodnoty se ztratí. */
function L({ n, l, children }: { n: string; l: string; children: React.ReactNode }) {
  return <div><label htmlFor={n} className="mb-1 block text-sm font-medium">{l}</label>{children}</div>;
}

function EventForm({ ev, onClose }: { ev: EventFormValues; onClose: () => void }) {
  const [err, setErr] = useState("");
  const upsertEvent = useUpsertEvent();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "").trim();
    const title = g("title");
    if (!title || !g("date") || Number(g("capacity")) < 1) return setErr("Vyplň název, datum a kapacitu (alespoň 1).");
    const timezone = ev.existing?.timezone ?? DEFAULT_TIMEZONE;
    // Termín se nikdy nedoplňuje automaticky – nejednoznačný čas je chyba formuláře.
    const schedule = buildSchedule({ date: g("date"), endDate: g("endDate") || undefined, timeLabel: g("time"), timezone });
    if (!schedule.ok) return setErr(schedule.error);
    const published = f.get("published") === "on";
    const previousStatus = ev.existing?.status ?? "draft";
    try {
      await upsertEvent.mutateAsync({
        ...(ev.existing
          ? toEventInput(ev.existing)
          : ev.legacy
            ? { id: ev.legacy.id, slug: ev.legacy.id, currency: "CZK" as const, isDemo: ev.legacy.isDemo }
            : { slug: "", currency: "CZK" as const, isDemo: true }),
        title,
        category: g("category") as EventCategory,
        shortDescription: g("shortDescription"),
        description: g("description"),
        startAt: schedule.startAt,
        endAt: schedule.endAt,
        timezone,
        timeLabel: g("time"),
        location: g("location"),
        price: Number(g("price")) || 0,
        capacity: Number(g("capacity")),
        instructor: g("instructor") || undefined,
        bring: g("bring").split(",").map((x) => x.trim()).filter(Boolean),
        image: g("image") || undefined,
        status: published ? "published" : previousStatus === "published" ? "draft" : previousStatus,
      });
      onClose();
    } catch (error) {
      setErr(errorMessage(error, "Akci se nepodařilo uložit. Zkus to prosím znovu."));
    }
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Úprava akce" className="fixed inset-0 z-50 overflow-y-auto bg-cocoa/70 p-4">
      <form onSubmit={submit} className="mx-auto my-8 max-w-2xl space-y-4 rounded-3xl bg-background p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl">{ev.existing || ev.legacy ? "Upravit akci" : "Nová akce"}</h2>
          <IconBtn label="Zavřít" onClick={onClose}><X className="h-5 w-5" /></IconBtn>
        </div>
        <L n="title" l="Název"><input id="title" name="title" defaultValue={ev.title} className="field" /></L>
        <div className="grid gap-4 sm:grid-cols-2">
          <L n="category" l="Kategorie">
            <select id="category" name="category" defaultValue={ev.category} className="field">
              {Object.entries(categoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </L>
          <L n="instructor" l="Lektor/ka"><input id="instructor" name="instructor" defaultValue={ev.instructor} className="field" /></L>
          <L n="date" l="Datum"><input id="date" name="date" type="date" defaultValue={ev.date} className="field" /></L>
          <L n="endDate" l="Datum konce (nepovinné)"><input id="endDate" name="endDate" type="date" defaultValue={ev.endDate} className="field" /></L>
          <L n="time" l="Čas"><input id="time" name="time" defaultValue={ev.timeLabel} className="field" /></L>
          <L n="location" l="Místo"><input id="location" name="location" defaultValue={ev.location} className="field" /></L>
          <L n="price" l="Cena (Kč)"><input id="price" name="price" type="number" min={0} defaultValue={ev.price} className="field" /></L>
          <L n="capacity" l="Kapacita"><input id="capacity" name="capacity" type="number" min={1} defaultValue={ev.capacity} className="field" /></L>
        </div>
        <L n="shortDescription" l="Krátký popis"><input id="shortDescription" name="shortDescription" defaultValue={ev.shortDescription} className="field" /></L>
        <L n="description" l="Podrobný popis"><textarea id="description" name="description" rows={4} defaultValue={ev.description} className="field" /></L>
        <L n="bring" l="Co si vzít (oddělené čárkou)"><input id="bring" name="bring" defaultValue={ev.bring.join(", ")} className="field" /></L>
        <L n="image" l="URL obrázku (nepovinné)"><input id="image" name="image" defaultValue={ev.image} className="field" /></L>
        <label className="flex items-center gap-3"><input type="checkbox" name="published" defaultChecked={ev.published} className="h-5 w-5" /> Publikovat na webu (jen v tomto prohlížeči)</label>
        {err && <p role="alert" className="text-destructive">{err}</p>}
        <div className="flex gap-3"><button type="submit" className="btn btn-primary">Uložit</button><button type="button" onClick={onClose} className="btn btn-ghost">Zrušit</button></div>
      </form>
    </div>
  );
}

function ReservationsAdmin() {
  const { data: reservations = [], isPending, isError, refetch } = useAdminReservations();
  const { data: events } = useAdminEvents();
  const { data: unscheduled = [] } = useUnscheduledLegacyEvents();
  const updateStatus = useUpdateReservationStatus();
  const setReservationStatus = (id: string, status: ReservationStatus) => updateStatus.mutate({ id, status });
  const [q, setQ] = useState("");
  const [st, setSt] = useState<ReservationStatus | "">("");
  const [detail, setDetail] = useState<string | null>(null);
  const rows = useMemo(
    () => reservations.filter((r) =>
      (!st || r.reservationStatus === st) &&
      (!q || `${r.customerName} ${r.customerEmail} ${r.id}`.toLowerCase().includes(q.toLowerCase()))),
    [reservations, q, st],
  );
  const d = reservations.find((r) => r.id === detail);
  function exportCsv() {
    const blob = new Blob([reservationsToCsv(rows, [...(events ?? []), ...unscheduled])], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dve-demo-rezervace.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <input aria-label="Hledat" placeholder="Hledat jméno, e-mail, číslo…" value={q} onChange={(e) => setQ(e.target.value)} className="field max-w-xs" />
        <select aria-label="Filtr stavu" value={st} onChange={(e) => setSt(e.target.value as ReservationStatus | "")} className="field max-w-48">
          <option value="">Všechny stavy</option>
          {Object.entries(reservationStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn btn-ghost min-h-12" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" /> Export CSV</button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Změny stavu jsou pouze simulace – neodesílají se e-maily ani neprobíhají platby.</p>
      {isError && <LoadError className="mt-4" message="Rezervace se nepodařilo načíst." onRetry={() => void refetch()} />}
      {updateStatus.isError && <LoadError className="mt-4" message={errorMessage(updateStatus.error, "Stav rezervace se nepodařilo změnit.")} />}
      <div className="mt-4 overflow-x-auto rounded-3xl bg-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr><th className="p-4">Číslo</th><th className="p-4">Jméno</th><th className="p-4">Akce</th><th className="p-4">Míst</th><th className="p-4">Stav</th><th className="p-4" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isPending && <TableRowsSkeleton cols={6} />}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-4 font-mono text-xs">{r.id}</td>
                <td className="p-4">{r.customerName}<br /><span className="text-muted-foreground">{r.customerEmail}</span></td>
                <td className="p-4">{eventTitle(events, r.eventId, unscheduled) ?? "—"}</td>
                <td className="p-4">{r.numberOfSpots}</td>
                <td className="p-4">
                  <select aria-label={`Stav rezervace ${r.id}`} value={r.reservationStatus} onChange={(e) => setReservationStatus(r.id, e.target.value as ReservationStatus)} className="field min-h-10 py-1">
                    {Object.entries(reservationStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="p-4 text-right">
                  <button className="text-sm font-medium underline-offset-4 hover:underline" onClick={() => setDetail(r.id)}>Detail</button>
                </td>
              </tr>
            ))}
            {!isPending && !isError && !rows.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Žádné rezervace.</td></tr>}
          </tbody>
        </table>
      </div>
      {d && (
        <div role="dialog" aria-modal="true" aria-label="Detail rezervace" className="fixed inset-0 z-50 grid place-items-center bg-cocoa/70 p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md rounded-3xl bg-background p-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-2xl">Rezervace {d.id}</h2><IconBtn label="Zavřít" onClick={() => setDetail(null)}><X className="h-5 w-5" /></IconBtn></div>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Jméno</dt><dd>{d.customerName}</dd>
              <dt className="text-muted-foreground">E-mail</dt><dd>{d.customerEmail}</dd>
              <dt className="text-muted-foreground">Telefon</dt><dd>{d.customerPhone}</dd>
              <dt className="text-muted-foreground">Míst</dt><dd>{d.numberOfSpots}</dd>
              <dt className="text-muted-foreground">Stav</dt><dd>{reservationStatusLabels[d.reservationStatus]}</dd>
              <dt className="text-muted-foreground">Platba</dt><dd>{paymentStatusLabels[d.paymentStatus]}</dd>
              <dt className="text-muted-foreground">Vytvořeno</dt><dd>{new Date(d.createdAt).toLocaleString("cs-CZ")}</dd>
              <dt className="text-muted-foreground">Poznámka</dt><dd>{d.note ?? "—"}</dd>
            </dl>
            {d.reservationStatus !== "cancelled" && <button className="btn btn-ghost mt-6" onClick={() => setReservationStatus(d.id, "cancelled")}>Zrušit rezervaci</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function GalleryAdmin() {
  const { data: gallery = [], isPending, isError, refetch } = useGallery();
  const saveGallery = useSaveGallery();
  const updateGallery = (items: typeof gallery) => saveGallery.mutate(items);
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">Doplň URL fotografie a popisek. Změny se projeví jen v tomto prohlížeči.</p>
      {isError && <LoadError message="Galerii se nepodařilo načíst." onRetry={() => void refetch()} />}
      {saveGallery.isError && <LoadError message="Změnu galerie se nepodařilo uložit." />}
      {isPending && [0, 1, 2].map((i) => <div key={i} className="h-[74px] animate-pulse rounded-2xl bg-card" aria-hidden />)}
      {gallery.map((g, i) => (
        <div key={g.id} className="grid gap-3 rounded-2xl bg-card p-4 sm:grid-cols-[1fr_1fr_auto]">
          <input aria-label="Popisek" className="field" value={g.caption} onChange={(e) => updateGallery(gallery.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} />
          <input aria-label="URL fotografie" placeholder="https://…" className="field" value={g.src ?? ""} onChange={(e) => updateGallery(gallery.map((x, j) => (j === i ? { ...x, src: e.target.value || undefined } : x)))} />
          <select aria-label="Poměr stran" className="field" value={g.ratio} onChange={(e) => updateGallery(gallery.map((x, j) => (j === i ? { ...x, ratio: e.target.value as typeof g.ratio } : x)))}>
            <option value="square">Čtverec</option><option value="tall">Na výšku</option><option value="wide">Na šířku</option>
          </select>
        </div>
      ))}
      <Link to="/" hash="galerie" className="btn btn-sun min-h-11">Zobrazit galerii</Link>
    </div>
  );
}
