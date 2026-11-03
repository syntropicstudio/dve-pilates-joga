/**
 * Demonstrační datová vrstva (localStorage).
 * Komponenty používají pouze tyto funkce – později je lze nahradit voláním REST API.
 */
import { useSyncExternalStore } from "react";
import { demoEvents, demoGallery } from "@/data/demo";
import type { DveEvent, GalleryItem, Reservation, ReservationStatus } from "@/lib/types";

interface State {
  events: DveEvent[];
  reservations: Reservation[];
  gallery: GalleryItem[];
}

const KEY = "dve-demo-v1";
const initial = (): State => ({
  events: structuredClone(demoEvents),
  reservations: [],
  gallery: structuredClone(demoGallery),
});

const serverState = initial();
let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    const loaded: State = raw ? { ...initial(), ...JSON.parse(raw) } : initial();
    // Doplňte nové ilustrační fotky pouze do původních prázdných ukázek.
    // Vlastní fotografie, změny akcí i rezervace zůstávají zachovány.
    state = {
      ...loaded,
      events: loaded.events.map((ev) => {
        const demo = demoEvents.find((item) => item.id === ev.id);
        return ev.demo && !ev.image && demo?.image ? { ...ev, image: demo.image } : ev;
      }),
      gallery: loaded.gallery.map((item) => {
        const demo = demoGallery.find((entry) => entry.id === item.id);
        return !item.src && item.caption.startsWith("Místo pro ") && demo
          ? { ...item, src: demo.src, caption: demo.caption }
          : item;
      }),
    };
  } catch {
    state = initial();
  }
  return state ?? serverState;
}

function save(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* úložiště nedostupné */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, load, () => serverState);
}

export function reservedSeats(s: State, eventId: string) {
  return s.reservations
    .filter((r) => r.eventId === eventId && r.status !== "zrusena")
    .reduce((n, r) => n + r.seats, 0);
}

export function freeSeats(s: State, ev: DveEvent) {
  return Math.max(0, ev.capacity - reservedSeats(s, ev.id));
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function createReservation(
  input: Omit<Reservation, "id" | "status" | "payment" | "createdAt">,
): { ok: true; reservation: Reservation } | { ok: false; error: string } {
  const s = load();
  const ev = s.events.find((e) => e.id === input.eventId);
  if (!ev) return { ok: false, error: "Akce nebyla nalezena." };
  const free = freeSeats(s, ev);
  if (input.seats > free)
    return { ok: false, error: free === 0 ? "Akce je již obsazená." : `Volných míst je už jen ${free}.` };
  const reservation: Reservation = {
    ...input,
    id: "R-" + uid().toUpperCase(),
    status: "nova",
    payment: "neresi-se",
    createdAt: new Date().toISOString(),
  };
  save({ ...s, reservations: [reservation, ...s.reservations] });
  return { ok: true, reservation };
}

export function setReservationStatus(id: string, status: ReservationStatus) {
  const s = load();
  save({ ...s, reservations: s.reservations.map((r) => (r.id === id ? { ...r, status } : r)) });
}

export function upsertEvent(ev: DveEvent) {
  const s = load();
  const exists = s.events.some((e) => e.id === ev.id);
  save({ ...s, events: exists ? s.events.map((e) => (e.id === ev.id ? ev : e)) : [...s.events, ev] });
}

export function deleteEvent(id: string) {
  const s = load();
  save({
    ...s,
    events: s.events.filter((e) => e.id !== id),
    reservations: s.reservations.filter((r) => r.eventId !== id),
  });
}

export function updateGallery(items: GalleryItem[]) {
  save({ ...load(), gallery: items });
}

export function resetDemo() {
  save(initial());
}

export function newEventId(title: string) {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "akce"}-${uid().slice(0, 4)}`;
}

export function formatDate(ev: Pick<DveEvent, "date" | "endDate">) {
  const f = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
  return ev.endDate ? `${f(ev.date)} – ${f(ev.endDate)}` : f(ev.date);
}

export const formatPrice = (n: number) => `${n.toLocaleString("cs-CZ")} Kč`;

export function toCsv(rows: Reservation[], events: DveEvent[]) {
  const head = ["ID", "Akce", "Jméno", "E-mail", "Telefon", "Míst", "Stav", "Vytvořeno", "Poznámka"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.id, events.find((e) => e.id === r.eventId)?.title, r.name, r.email, r.phone, r.seats, r.status, r.createdAt, r.note]
      .map(esc)
      .join(";"),
  );
  return "\ufeff" + [head.map(esc).join(";"), ...lines].join("\n");
}
