import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Download, Eye, EyeOff, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import {
  useStore, freeSeats, reservedSeats, setReservationStatus, upsertEvent, deleteEvent,
  resetDemo, newEventId, formatDate, formatPrice, toCsv, updateGallery,
} from "@/services/store";
import { categoryLabels, statusLabels, type DveEvent, type EventCategory, type ReservationStatus } from "@/lib/types";

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
        <button type="button" className="btn btn-ghost min-h-11" onClick={() => confirm("Obnovit ukázková data do výchozího stavu?") && resetDemo()}>
          <RotateCcw className="h-4 w-4" /> Resetovat demo data
        </button>
      </div>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-soft)]">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-4xl">{value}</p>
    </div>
  );
}

function Overview({ go }: { go: (t: Tab) => void }) {
  const s = useStore();
  const today = new Date().toISOString().slice(0, 10);
  const cap = s.events.reduce((n, e) => n + e.capacity, 0);
  const taken = s.events.reduce((n, e) => n + reservedSeats(s, e.id), 0);
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Akcí celkem" value={s.events.length} />
        <Stat label="Nadcházející akce" value={s.events.filter((e) => e.date >= today).length} />
        <Stat label="Rezervací" value={s.reservations.length} />
        <Stat label="Obsazenost" value={`${taken} / ${cap}`} />
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary min-h-11" onClick={() => go("akce")}><Plus className="h-4 w-4" /> Přidat akci</button>
        <button className="btn btn-sun min-h-11" onClick={() => go("rezervace")}>Spravovat rezervace</button>
      </div>
      <div>
        <h2 className="text-2xl">Nedávné rezervace</h2>
        {s.reservations.length === 0 ? (
          <p className="mt-3 text-muted-foreground">Zatím žádné. Vytvoř si ukázkovou rezervaci na veřejném webu.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-3xl bg-card">
            {s.reservations.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 p-4">
                <span><strong>{r.name}</strong> · {s.events.find((e) => e.id === r.eventId)?.title}</span>
                <span className="text-sm text-muted-foreground">{r.seats} míst · {statusLabels[r.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const emptyEvent = (): DveEvent => ({
  id: "", title: "", category: "joga", shortDescription: "", description: "", date: new Date().toISOString().slice(0, 10),
  time: "", location: "", price: 0, capacity: 10, bring: [], published: false, demo: true,
});

function EventsAdmin() {
  const s = useStore();
  const [editing, setEditing] = useState<DveEvent | null>(null);
  return (
    <div>
      <button className="btn btn-primary min-h-11" onClick={() => setEditing(emptyEvent())}><Plus className="h-4 w-4" /> Nová akce</button>
      <div className="mt-6 overflow-x-auto rounded-3xl bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr><th className="p-4">Akce</th><th className="p-4">Termín</th><th className="p-4">Cena</th><th className="p-4">Obsazenost</th><th className="p-4">Stav</th><th className="p-4 text-right">Akce</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {s.events.map((e) => (
              <tr key={e.id}>
                <td className="p-4"><p className="font-semibold">{e.title}</p><p className="text-muted-foreground">{categoryLabels[e.category]}</p></td>
                <td className="p-4">{formatDate(e)}</td>
                <td className="p-4">{formatPrice(e.price)}</td>
                <td className="p-4">{e.capacity - freeSeats(s, e)} / {e.capacity}</td>
                <td className="p-4">{e.published ? "Publikováno" : "Skryto"}</td>
                <td className="p-4">
                  <div className="flex justify-end gap-1">
                    <IconBtn label={e.published ? "Skrýt" : "Publikovat"} onClick={() => upsertEvent({ ...e, published: !e.published })}>{e.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</IconBtn>
                    <IconBtn label="Upravit" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></IconBtn>
                    <IconBtn label="Odstranit" onClick={() => confirm(`Odstranit akci „${e.title}“ i její rezervace?`) && deleteEvent(e.id)}><Trash2 className="h-4 w-4" /></IconBtn>
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

function EventForm({ ev, onClose }: { ev: DveEvent; onClose: () => void }) {
  const [err, setErr] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "").trim();
    const title = g("title");
    if (!title || !g("date") || Number(g("capacity")) < 1) return setErr("Vyplň název, datum a kapacitu (alespoň 1).");
    upsertEvent({
      ...ev,
      id: ev.id || newEventId(title),
      title,
      category: g("category") as EventCategory,
      shortDescription: g("shortDescription"),
      description: g("description"),
      date: g("date"),
      endDate: g("endDate") || undefined,
      time: g("time"),
      location: g("location"),
      price: Number(g("price")) || 0,
      capacity: Number(g("capacity")),
      instructor: g("instructor") || undefined,
      bring: g("bring").split(",").map((x) => x.trim()).filter(Boolean),
      image: g("image") || undefined,
      published: f.get("published") === "on",
    });
    onClose();
  }
  const L = ({ n, l, children }: { n: string; l: string; children: React.ReactNode }) => (
    <div><label htmlFor={n} className="mb-1 block text-sm font-medium">{l}</label>{children}</div>
  );
  return (
    <div role="dialog" aria-modal="true" aria-label="Úprava akce" className="fixed inset-0 z-50 overflow-y-auto bg-cocoa/70 p-4">
      <form onSubmit={submit} className="mx-auto my-8 max-w-2xl space-y-4 rounded-3xl bg-background p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl">{ev.id ? "Upravit akci" : "Nová akce"}</h2>
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
          <L n="time" l="Čas"><input id="time" name="time" defaultValue={ev.time} className="field" /></L>
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
  const s = useStore();
  const [q, setQ] = useState("");
  const [st, setSt] = useState<ReservationStatus | "">("");
  const [detail, setDetail] = useState<string | null>(null);
  const rows = useMemo(
    () => s.reservations.filter((r) =>
      (!st || r.status === st) &&
      (!q || `${r.name} ${r.email} ${r.id}`.toLowerCase().includes(q.toLowerCase()))),
    [s.reservations, q, st],
  );
  const d = s.reservations.find((r) => r.id === detail);
  function exportCsv() {
    const blob = new Blob([toCsv(rows, s.events)], { type: "text/csv;charset=utf-8" });
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
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn btn-ghost min-h-12" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" /> Export CSV</button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Změny stavu jsou pouze simulace – neodesílají se e-maily ani neprobíhají platby.</p>
      <div className="mt-4 overflow-x-auto rounded-3xl bg-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr><th className="p-4">Číslo</th><th className="p-4">Jméno</th><th className="p-4">Akce</th><th className="p-4">Míst</th><th className="p-4">Stav</th><th className="p-4" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-4 font-mono text-xs">{r.id}</td>
                <td className="p-4">{r.name}<br /><span className="text-muted-foreground">{r.email}</span></td>
                <td className="p-4">{s.events.find((e) => e.id === r.eventId)?.title ?? "—"}</td>
                <td className="p-4">{r.seats}</td>
                <td className="p-4">
                  <select aria-label={`Stav rezervace ${r.id}`} value={r.status} onChange={(e) => setReservationStatus(r.id, e.target.value as ReservationStatus)} className="field min-h-10 py-1">
                    {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="p-4 text-right">
                  <button className="text-sm font-medium underline-offset-4 hover:underline" onClick={() => setDetail(r.id)}>Detail</button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Žádné rezervace.</td></tr>}
          </tbody>
        </table>
      </div>
      {d && (
        <div role="dialog" aria-modal="true" aria-label="Detail rezervace" className="fixed inset-0 z-50 grid place-items-center bg-cocoa/70 p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md rounded-3xl bg-background p-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between"><h2 className="text-2xl">Rezervace {d.id}</h2><IconBtn label="Zavřít" onClick={() => setDetail(null)}><X className="h-5 w-5" /></IconBtn></div>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Jméno</dt><dd>{d.name}</dd>
              <dt className="text-muted-foreground">E-mail</dt><dd>{d.email}</dd>
              <dt className="text-muted-foreground">Telefon</dt><dd>{d.phone}</dd>
              <dt className="text-muted-foreground">Míst</dt><dd>{d.seats}</dd>
              <dt className="text-muted-foreground">Stav</dt><dd>{statusLabels[d.status]}</dd>
              <dt className="text-muted-foreground">Vytvořeno</dt><dd>{new Date(d.createdAt).toLocaleString("cs-CZ")}</dd>
              <dt className="text-muted-foreground">Poznámka</dt><dd>{d.note ?? "—"}</dd>
            </dl>
            {d.status !== "zrusena" && <button className="btn btn-ghost mt-6" onClick={() => setReservationStatus(d.id, "zrusena")}>Zrušit rezervaci</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function GalleryAdmin() {
  const { gallery } = useStore();
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">Doplň URL fotografie a popisek. Změny se projeví jen v tomto prohlížeči.</p>
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
