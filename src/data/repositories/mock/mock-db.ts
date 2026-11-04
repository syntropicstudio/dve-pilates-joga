/**
 * Demonstrační úložiště v localStorage – používají ho pouze mock repozitáře.
 * NENÍ určeno pro skutečné osobní údaje zákazníků.
 */
import { demoEvents, demoGallery } from "@/data/demo";
import { isPendingExpired } from "@/lib/capacity";
import { buildSchedule, DEFAULT_TIMEZONE, toZonedDate } from "@/lib/event-schedule";
import { categoryLabels } from "@/lib/types";
import type { DveEvent, GalleryItem, PaymentStatus, Reservation, ReservationStatus } from "@/lib/types";
import type { UnscheduledLegacyEvent } from "@/data/repositories/types";

export interface MockState {
  events: DveEvent[];
  reservations: Reservation[];
  gallery: GalleryItem[];
  /** Akce z v1, u kterých nešlo jednoznačně určit čas – čekají na doplnění v administraci. */
  unscheduledEvents: UnscheduledLegacyEvent[];
}

export const STORAGE_KEY = "dve-demo-v2";
export const LEGACY_STORAGE_KEY = "dve-demo-v1";
/** Kam se odloží nečitelná data v2, než se začne znovu (nic se tiše nemaže). */
export const CORRUPTED_BACKUP_KEY = "dve-demo-v2-backup";

export const initialState = (): MockState => ({
  events: structuredClone(demoEvents),
  reservations: [],
  gallery: structuredClone(demoGallery),
  unscheduledEvents: [],
});

let cache: MockState | null = null;

const storage = (): Storage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/* ---------- migrace z verze v1 (původní src/services/store.ts) ----------
 * Migrace je čistě čtecí: klíč `dve-demo-v1` se nikdy nemaže ani nepřepisuje,
 * slouží jako záloha. Jakmile existuje `dve-demo-v2`, v1 se ignoruje (opakované
 * spuštění je tedy bezpečné). Neplatný záznam se přeskočí, ostatní data zůstanou.
 */

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isCategory = (v: unknown): v is DveEvent["category"] => typeof v === "string" && v in categoryLabels;

const legacyStatus: Record<string, ReservationStatus> = {
  nova: "pending_payment",
  "ceka-na-platbu": "pending_payment",
  potvrzena: "confirmed",
  zrusena: "cancelled",
};

const legacyPayment: Record<string, PaymentStatus> = {
  "neresi-se": "unpaid",
  ceka: "pending",
  zaplaceno: "paid",
};

type MigratedEvent = { kind: "event"; event: DveEvent } | { kind: "unscheduled"; event: UnscheduledLegacyEvent };

function migrateEvent(ev: Raw, now: string): MigratedEvent | null {
  const id = str(ev["id"]);
  const title = str(ev["title"]);
  const date = ev["date"];
  const endDate = ev["endDate"];
  if (!id || title === undefined || !isCategory(ev["category"]) || !isDate(date)) return null;
  if (endDate !== undefined && endDate !== "" && !isDate(endDate)) return null;

  const common = {
    id,
    title,
    category: ev["category"],
    shortDescription: str(ev["shortDescription"]) ?? "",
    description: str(ev["description"]) ?? "",
    timeLabel: str(ev["time"]) ?? "",
    location: str(ev["location"]) ?? "",
    price: num(ev["price"]) ?? 0,
    capacity: num(ev["capacity"]) ?? 0,
    instructor: str(ev["instructor"]),
    bring: Array.isArray(ev["bring"]) ? ev["bring"].filter((b): b is string => typeof b === "string") : [],
    image: str(ev["image"]),
    isDemo: ev["demo"] === true,
  };

  const demo = demoEvents.find((d) => d.id === id);
  let schedule: { startAt: string; endAt: string } | null = null;
  if (demo && demo.timeLabel === common.timeLabel && date === toZonedDate(demo.startAt, demo.timezone)) {
    schedule = demo; // původní ukázka – přesný termín ze seedu
  } else {
    const built = buildSchedule({ date, endDate: endDate || undefined, timeLabel: common.timeLabel });
    if (built.ok) schedule = built;
  }

  if (!schedule) {
    // Čas nelze určit jednoznačně → žádný vymyšlený termín. Akce čeká na doplnění v administraci.
    return {
      kind: "unscheduled",
      event: { ...common, date, endDate: endDate || undefined, wasPublished: ev["published"] === true },
    };
  }
  return {
    kind: "event",
    event: {
      ...common,
      slug: id,
      startAt: schedule.startAt,
      endAt: schedule.endAt,
      timezone: DEFAULT_TIMEZONE,
      currency: "CZK",
      status: ev["published"] === true ? "published" : "draft",
      createdAt: demo?.createdAt ?? now,
      updatedAt: now,
    },
  };
}

function migrateReservation(r: Raw, now: string): Reservation | null {
  const id = str(r["id"]);
  const eventId = str(r["eventId"]);
  if (!id || !eventId) return null;
  const seats = num(r["seats"]);
  return {
    id,
    eventId,
    customerName: str(r["name"]) ?? "",
    customerEmail: str(r["email"]) ?? "",
    customerPhone: str(r["phone"]) ?? "",
    numberOfSpots: seats && seats > 0 ? Math.floor(seats) : 1,
    note: str(r["note"]),
    reservationStatus: legacyStatus[str(r["status"]) ?? ""] ?? "pending_payment",
    paymentStatus: legacyPayment[str(r["payment"]) ?? ""] ?? "unpaid",
    // V1 neznala lhůtu na zaplacení: migrované rezervace blokují místo, dokud admin nezmění stav
    // (stejně jako dřív). `expiresAt` se proto nevymýšlí.
    expiresAt: undefined,
    createdAt: str(r["createdAt"]) ?? now,
    updatedAt: now,
  };
}

function migrateGalleryItem(g: Raw, index: number): GalleryItem | null {
  const id = str(g["id"]);
  const caption = str(g["caption"]);
  const ratio = g["ratio"];
  if (!id || caption === undefined || (ratio !== "square" && ratio !== "tall" && ratio !== "wide")) return null;
  return { id, caption, src: str(g["src"]), ratio, sortOrder: index + 1 };
}

export interface MigrationReport {
  state: MockState;
  skipped: number;
}

export function migrateLegacyState(raw: unknown): MigrationReport {
  if (!isObject(raw)) throw new Error("Neplatný formát dat v1.");
  const now = new Date().toISOString();
  const base = initialState();
  let skipped = 0;
  const each = <T>(value: unknown, fn: (item: Raw, i: number) => T | null): T[] | null => {
    if (value === undefined) return null;
    if (!Array.isArray(value)) throw new Error("Neplatný formát dat v1.");
    return value.flatMap((item, i) => {
      const result = isObject(item) ? fn(item, i) : null;
      if (result === null) skipped++;
      return result === null ? [] : [result];
    });
  };

  const events = each(raw["events"], (e) => migrateEvent(e, now));
  const reservations = each(raw["reservations"], (r) => migrateReservation(r, now)) ?? [];
  const gallery = each(raw["gallery"], migrateGalleryItem);
  return {
    skipped,
    state: {
      events: events ? events.flatMap((m) => (m.kind === "event" ? [m.event] : [])) : base.events,
      unscheduledEvents: events ? events.flatMap((m) => (m.kind === "unscheduled" ? [m.event] : [])) : [],
      reservations,
      gallery: gallery ?? base.gallery,
    },
  };
}

/* ---------- normalizace ---------- */

/** Doplní nové ilustrační fotky jen do nedotčených ukázek; vlastní data zůstávají. */
function fillDemoImages(s: MockState): MockState {
  return {
    ...s,
    events: s.events.map((ev) => {
      const demo = demoEvents.find((item) => item.id === ev.id);
      return ev.isDemo && !ev.image && demo?.image ? { ...ev, image: demo.image } : ev;
    }),
    gallery: s.gallery.map((item) => {
      const demo = demoGallery.find((entry) => entry.id === item.id);
      return !item.src && item.caption.startsWith("Místo pro ") && demo
        ? { ...item, src: demo.src, caption: demo.caption }
        : item;
    }),
  };
}

/** Simulace plánované úlohy: nezaplacené rezervace po expiraci přejdou do `expired`. */
function expireStale(s: MockState, now: Date): MockState {
  if (!s.reservations.some((r) => isPendingExpired(r, now))) return s;
  const stamp = now.toISOString();
  return {
    ...s,
    reservations: s.reservations.map((r) =>
      isPendingExpired(r, now) ? { ...r, reservationStatus: "expired", updatedAt: stamp } : r,
    ),
  };
}

/** Uložená data v2 – chybějící části se doplní výchozími, nečitelný tvar je chyba. */
function parseV2(raw: string): MockState {
  const parsed: unknown = JSON.parse(raw);
  if (!isObject(parsed)) throw new Error("Neplatný formát dat v2.");
  const base = initialState();
  const part = <K extends keyof MockState>(key: K): MockState[K] => {
    const value = parsed[key];
    if (value === undefined) return base[key];
    if (!Array.isArray(value)) throw new Error(`Neplatná část dat v2: ${key}`);
    return value as MockState[K];
  };
  return {
    events: part("events"),
    reservations: part("reservations"),
    gallery: part("gallery"),
    unscheduledEvents: part("unscheduledEvents"),
  };
}

function loadFromStorage(): MockState {
  const ls = storage();
  if (!ls) return initialState();

  const raw = ls.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return fillDemoImages(parseV2(raw));
    } catch {
      // Nečitelná data neztrácíme: odložíme je stranou a začneme s výchozími.
      try {
        ls.setItem(CORRUPTED_BACKUP_KEY, raw);
      } catch {
        /* úložiště nedostupné */
      }
      console.warn(`[DVĚ demo] Uložená data jsou poškozená, záloha je v localStorage pod „${CORRUPTED_BACKUP_KEY}“.`);
      return initialState();
    }
  }

  const legacy = ls.getItem(LEGACY_STORAGE_KEY);
  if (legacy) {
    try {
      const { state, skipped } = migrateLegacyState(JSON.parse(legacy));
      if (skipped) console.warn(`[DVĚ demo] Při migraci bylo přeskočeno ${skipped} neplatných záznamů (originál zůstává v „${LEGACY_STORAGE_KEY}“).`);
      const migrated = fillDemoImages(state);
      persist(migrated);
      return migrated;
    } catch {
      console.warn(`[DVĚ demo] Data v1 nelze převést, originál zůstává v „${LEGACY_STORAGE_KEY}“.`);
    }
  }
  return initialState();
}

function persist(s: MockState) {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* úložiště nedostupné */
  }
}

/* ---------- veřejné API pro mock repozitáře ---------- */

export function readState(now: Date = new Date()): MockState {
  const current = cache ?? loadFromStorage();
  const next = expireStale(current, now);
  if (next !== current || !cache) {
    cache = next;
    if (next !== current) persist(next);
  }
  return cache;
}

export function writeState(next: MockState) {
  cache = next;
  persist(next);
}

export function resetState() {
  writeState(initialState());
}

export const mockId = () => Math.random().toString(36).slice(2, 10);
