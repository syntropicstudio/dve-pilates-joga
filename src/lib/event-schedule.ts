/**
 * Práce s termíny akcí: převod mezi lokálním datem/časem v časovém pásmu akce
 * a ISO časy v UTC (`startAt` / `endAt`), které se ukládají do databáze.
 */
import type { DveEvent } from "@/lib/types";

export const DEFAULT_TIMEZONE = "Europe/Prague";

const pad = (n: number) => String(n).padStart(2, "0");

function zonedParts(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Posun časového pásma (ms) v daném okamžiku. */
function offsetAt(ms: number, timeZone: string) {
  const p = zonedParts(ms, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** Lokální datum (YYYY-MM-DD) a čas (H:MM) v pásmu `timeZone` → ISO v UTC. */
export function zonedToUtcIso(date: string, time: string, timeZone = DEFAULT_TIMEZONE): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const [h = 0, min = 0] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, h, min);
  let utc = naive - offsetAt(naive, timeZone);
  utc = naive - offsetAt(utc, timeZone); // korekce kolem přechodu letního času
  return new Date(utc).toISOString();
}

/** ISO v UTC → lokální datum (YYYY-MM-DD) v pásmu `timeZone`. */
export function toZonedDate(iso: string, timeZone = DEFAULT_TIMEZONE): string {
  const p = zonedParts(new Date(iso).getTime(), timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

const TIME_RE = /(?<!\d)(\d{1,2}):(\d{2})(?!\d)/g;

/**
 * Z textu času („8:30–9:45“, „pátek 17:00 – neděle 14:00“) vyčte začátek a konec.
 * Vyžaduje přesně dva platné časy – jinak termín nelze určit jednoznačně.
 */
export function parseTimeLabel(label: string): { start: string; end: string } | null {
  const times = [...label.matchAll(TIME_RE)].map((m) => ({ h: Number(m[1]), m: Number(m[2]) }));
  if (times.length !== 2 || times.some((t) => t.h > 23 || t.m > 59)) return null;
  const [a, b] = times as [{ h: number; m: number }, { h: number; m: number }];
  return { start: `${a.h}:${pad(a.m)}`, end: `${b.h}:${pad(b.m)}` };
}

export type ScheduleResult = { ok: true; startAt: string; endAt: string } | { ok: false; error: string };

/** Sestaví `startAt` / `endAt` z polí formuláře. Nikdy nedoplňuje čas automaticky. */
export function buildSchedule(input: {
  date: string;
  endDate?: string | undefined;
  timeLabel: string;
  timezone?: string | undefined;
}): ScheduleResult {
  const tz = input.timezone ?? DEFAULT_TIMEZONE;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: "Zadej platné datum akce." };
  const endDate = input.endDate || input.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < input.date)
    return { ok: false, error: "Datum konce nesmí být dřív než datum začátku." };
  const times = parseTimeLabel(input.timeLabel);
  if (!times)
    return {
      ok: false,
      error: "Z pole Čas nelze určit začátek a konec akce. Uveď dva časy ve tvaru H:MM, např. „8:30–9:45“.",
    };
  const startAt = zonedToUtcIso(input.date, times.start, tz);
  const endAt = zonedToUtcIso(endDate, times.end, tz);
  if (endAt <= startAt) return { ok: false, error: "Konec akce musí být později než její začátek." };
  return { ok: true, startAt, endAt };
}

/** Datum akce pro zobrazení – „5. prosince 2026“ nebo „17. dubna 2027 – 19. dubna 2027“. */
export function formatEventDate(ev: Pick<DveEvent, "startAt" | "endAt" | "timezone">) {
  const start = toZonedDate(ev.startAt, ev.timezone);
  const end = toZonedDate(ev.endAt, ev.timezone);
  const f = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
  return end !== start ? `${f(start)} – ${f(end)}` : f(start);
}
