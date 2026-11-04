import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoEvents } from "@/data/demo";
import { blocksCapacity, blockedSpots } from "@/lib/capacity";
import { buildSchedule, formatEventDate, parseTimeLabel, toZonedDate } from "@/lib/event-schedule";
import type { CreateReservationInput } from "@/data/repositories";

const validInput = (eventId: string, numberOfSpots = 1): CreateReservationInput => ({
  eventId,
  customerName: "Jana Ukázková",
  customerEmail: "jana@example.com",
  customerPhone: "+420 123 456 789",
  numberOfSpots,
});

async function freshRepos() {
  vi.resetModules();
  const { getRepositories } = await import("@/data/repositories");
  return getRepositories();
}

describe("Event schedule", () => {
  it("formats demo dates exactly like the original web", () => {
    const byId = Object.fromEntries(demoEvents.map((e) => [e.id, formatEventDate(e)]));
    expect(byId["ranni-joga-v-parku"]).toBe("5. prosince 2026");
    expect(byId["jarni-vikend-v-prirode"]).toBe("17. dubna 2027 – 19. dubna 2027");
  });

  it("derives the same startAt/endAt as the demo seed from date + time label", () => {
    for (const ev of demoEvents) {
      const date = toZonedDate(ev.startAt, ev.timezone);
      const end = toZonedDate(ev.endAt, ev.timezone);
      const result = buildSchedule({ date, endDate: end !== date ? end : undefined, timeLabel: ev.timeLabel });
      expect(result).toEqual({ ok: true, startAt: ev.startAt, endAt: ev.endAt });
    }
  });

  it("rejects ambiguous or invalid time labels instead of defaulting to midnight", () => {
    expect(parseTimeLabel("dopoledne")).toBeNull();
    expect(parseTimeLabel("9:00")).toBeNull();
    expect(parseTimeLabel("9:00, 12:00 a 15:00")).toBeNull();
    expect(parseTimeLabel("25:00–26:00")).toBeNull();
    expect(buildSchedule({ date: "2027-01-01", timeLabel: "celý den" }).ok).toBe(false);
    expect(buildSchedule({ date: "2027-01-01", timeLabel: "18:00–17:00" }).ok).toBe(false);
    expect(buildSchedule({ date: "2027-01-02", endDate: "2027-01-01", timeLabel: "9:00–10:00" }).ok).toBe(false);
  });
});

describe("Capacity rules", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const future = "2026-06-02T12:00:00Z";
  const past = "2026-05-31T12:00:00Z";

  it("blocks for confirmed always and for pending_payment only until expiresAt", () => {
    expect(blocksCapacity({ reservationStatus: "confirmed" }, now)).toBe(true);
    expect(blocksCapacity({ reservationStatus: "pending_payment", expiresAt: future }, now)).toBe(true);
    expect(blocksCapacity({ reservationStatus: "pending_payment", expiresAt: past }, now)).toBe(false);
    expect(blocksCapacity({ reservationStatus: "cancelled" }, now)).toBe(false);
    expect(blocksCapacity({ reservationStatus: "expired" }, now)).toBe(false);
  });

  it("sums only blocking reservations of the given event", () => {
    const rows = [
      { eventId: "a", numberOfSpots: 2, reservationStatus: "confirmed" as const },
      { eventId: "a", numberOfSpots: 1, reservationStatus: "pending_payment" as const, expiresAt: future },
      { eventId: "a", numberOfSpots: 5, reservationStatus: "pending_payment" as const, expiresAt: past },
      { eventId: "a", numberOfSpots: 4, reservationStatus: "cancelled" as const },
      { eventId: "b", numberOfSpots: 3, reservationStatus: "confirmed" as const },
    ];
    expect(blockedSpots(rows, "a", now)).toBe(3);
  });
});

describe("Mock repositories", () => {
  beforeEach(() => localStorage.clear());

  it("lists only published events with availability and no reservation data", async () => {
    const repos = await freshRepos();
    const hidden = demoEvents[0]!;
    await repos.events.upsert({ ...hidden, status: "draft" });
    const list = await repos.events.listPublished();
    expect(list.map((e) => e.id)).not.toContain(hidden.id);
    expect(list.every((e) => e.availableSpots === e.capacity)).toBe(true);
    expect(list[0]).not.toHaveProperty("blockedSpots");
    expect(await repos.events.getPublishedBySlug(hidden.slug)).toBeNull();
  });

  it("creates pending_payment reservations and enforces capacity", async () => {
    const repos = await freshRepos();
    const pilates = "pilates-stred-tela"; // kapacita 3
    const first = await repos.reservations.create(validInput(pilates, 2));
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.reservation.reservationStatus).toBe("pending_payment");
      expect(first.reservation.paymentStatus).toBe("unpaid");
      expect(first.reservation.expiresAt).toBeTruthy();
    }
    const tooMany = await repos.reservations.create(validInput(pilates, 2));
    expect(tooMany).toMatchObject({ ok: false, code: "not_enough_spots", availableSpots: 1 });
    expect((await repos.reservations.create(validInput(pilates, 1))).ok).toBe(true);
    expect(await repos.reservations.create(validInput(pilates, 1))).toMatchObject({ ok: false, code: "sold_out" });
    expect((await repos.events.getPublishedBySlug(pilates))?.availableSpots).toBe(0);
  });

  it("frees capacity when a reservation is cancelled", async () => {
    const repos = await freshRepos();
    const res = await repos.reservations.create(validInput("pilates-stred-tela", 3));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    await repos.reservations.updateStatus(res.reservation.id, "cancelled");
    expect((await repos.events.getPublishedBySlug("pilates-stred-tela"))?.availableSpots).toBe(3);
  });

  it("expires unpaid reservations after expiresAt and releases their spots", async () => {
    const repos = await freshRepos();
    const res = await repos.reservations.create(validInput("pilates-stred-tela", 3));
    if (!res.ok) throw new Error("reservation failed");
    vi.useFakeTimers({ now: new Date(res.reservation.expiresAt!).getTime() + 1000 });
    try {
      const [reservation] = await repos.reservations.listForAdmin();
      expect(reservation?.reservationStatus).toBe("expired");
      expect((await repos.events.getPublishedBySlug("pilates-stred-tela"))?.availableSpots).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects invalid input and unknown events on the repository side", async () => {
    const repos = await freshRepos();
    expect(await repos.reservations.create({ ...validInput("pilates-stred-tela"), customerEmail: "x" }))
      .toMatchObject({ ok: false, code: "invalid_input" });
    expect(await repos.reservations.create(validInput("neexistuje"))).toMatchObject({ ok: false, code: "event_not_found" });
  });
});

describe("Legacy demo data migration (v1 → v2)", () => {
  beforeEach(() => localStorage.clear());

  const legacyData = {
    events: [
      { id: "ranni-joga-v-parku", title: "Ranní jóga v parku", category: "joga", date: "2026-12-05", time: "8:30–9:45",
        price: 290, capacity: 14, bring: [], published: true, demo: true },
      { id: "vlastni", title: "Vlastní", category: "pilates", date: "2027-03-01", time: "18:00–19:30",
        price: 100, capacity: 5, bring: [], published: false, demo: false, image: "/vlastni.jpg" },
      { id: "nejasna", title: "Nejasný čas", category: "workshop", date: "2027-03-05", time: "večer",
        price: 300, capacity: 8, bring: ["Deku"], published: true, demo: false },
    ],
    reservations: [
      { id: "R-1", eventId: "ranni-joga-v-parku", name: "A", email: "a@b.cz", phone: "123456789", seats: 2,
        status: "nova", payment: "neresi-se", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "R-2", eventId: "ranni-joga-v-parku", name: "B", email: "b@b.cz", phone: "123456789", seats: 1,
        status: "zrusena", payment: "neresi-se", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "R-3", eventId: "nejasna", name: "C", email: "c@b.cz", phone: "123456789", seats: 1,
        status: "potvrzena", payment: "zaplaceno", createdAt: "2026-01-01T00:00:00.000Z" },
    ],
    gallery: [{ id: "g1", caption: "Foto", src: "/x.jpg", ratio: "tall" }],
  };

  async function load() {
    vi.resetModules();
    return (await import("@/data/repositories/mock/mock-db")).readState();
  }

  it("keeps all reservations, custom events and photos; demo schedules stay exact", async () => {
    localStorage.setItem("dve-demo-v1", JSON.stringify(legacyData));
    const s = await load();
    const yoga = s.events.find((e) => e.id === "ranni-joga-v-parku");
    expect(yoga).toMatchObject({ slug: "ranni-joga-v-parku", status: "published", isDemo: true, timeLabel: "8:30–9:45" });
    expect(yoga?.startAt).toBe(demoEvents[0]?.startAt);
    expect(s.events.find((e) => e.id === "vlastni")).toMatchObject({
      status: "draft", image: "/vlastni.jpg", startAt: "2027-03-01T17:00:00.000Z", endAt: "2027-03-01T18:30:00.000Z",
    });
    expect(s.reservations.map((r) => r.id)).toEqual(["R-1", "R-2", "R-3"]);
    expect(s.reservations[2]).toMatchObject({ reservationStatus: "confirmed", paymentStatus: "paid" });
    expect(s.reservations[1]?.reservationStatus).toBe("cancelled");
    expect(s.gallery[0]).toMatchObject({ src: "/x.jpg", sortOrder: 1 });
  });

  it("does not invent times: ambiguous events wait for review instead of becoming all-day events", async () => {
    localStorage.setItem("dve-demo-v1", JSON.stringify(legacyData));
    const s = await load();
    expect(s.events.find((e) => e.id === "nejasna")).toBeUndefined();
    expect(s.unscheduledEvents).toEqual([
      expect.objectContaining({ id: "nejasna", date: "2027-03-05", timeLabel: "večer", wasPublished: true, bring: ["Deku"] }),
    ]);
  });

  it("keeps old 'nova' reservations blocking capacity (no invented payment deadline)", async () => {
    localStorage.setItem("dve-demo-v1", JSON.stringify(legacyData));
    const s = await load();
    expect(s.reservations[0]).toMatchObject({ reservationStatus: "pending_payment", expiresAt: undefined });
    vi.resetModules();
    const { getRepositories } = await import("@/data/repositories");
    expect((await getRepositories().events.getPublishedBySlug("ranni-joga-v-parku"))?.availableSpots).toBe(12);
  });

  it("is safe to run repeatedly and never deletes the v1 original", async () => {
    localStorage.setItem("dve-demo-v1", JSON.stringify(legacyData));
    const first = await load();
    const second = await load();
    expect(second).toEqual(first);
    expect(localStorage.getItem("dve-demo-v1")).toBe(JSON.stringify(legacyData));
    // Po migraci se v1 ignoruje – změny v2 se nepřepíšou starými daty.
    localStorage.setItem("dve-demo-v2", JSON.stringify({ ...first, reservations: [] }));
    expect((await load()).reservations).toEqual([]);
  });

  it("skips only invalid records and keeps the rest", async () => {
    localStorage.setItem("dve-demo-v1", JSON.stringify({
      events: [legacyData.events[1], { id: "bez-data", title: "Bez data", category: "joga" }, "nesmysl"],
      reservations: [legacyData.reservations[2], { name: "bez id" }],
    }));
    const s = await load();
    expect(s.events.map((e) => e.id)).toEqual(["vlastni"]);
    expect(s.reservations.map((r) => r.id)).toEqual(["R-3"]);
  });

  it("falls back to demo data without deleting unreadable v1 data", async () => {
    localStorage.setItem("dve-demo-v1", "{nečitelné");
    const s = await load();
    expect(s.events).toHaveLength(demoEvents.length);
    expect(localStorage.getItem("dve-demo-v1")).toBe("{nečitelné");
  });

  it("backs up corrupted v2 data before starting over", async () => {
    localStorage.setItem("dve-demo-v2", JSON.stringify({ events: "rozbité" }));
    const s = await load();
    expect(s.events).toHaveLength(demoEvents.length);
    expect(localStorage.getItem("dve-demo-v2-backup")).toBe(JSON.stringify({ events: "rozbité" }));
  });

  it("turns an unscheduled event into a regular one once the admin fills a valid time", async () => {
    localStorage.setItem("dve-demo-v1", JSON.stringify(legacyData));
    vi.resetModules();
    const { getRepositories } = await import("@/data/repositories");
    const repos = getRepositories();
    const [legacy] = await repos.listUnscheduledLegacyEvents!();
    const schedule = buildSchedule({ date: legacy!.date, timeLabel: "18:00–20:00" });
    if (!schedule.ok) throw new Error(schedule.error);
    await repos.events.upsert({
      id: legacy!.id, slug: legacy!.id, title: legacy!.title, category: legacy!.category,
      shortDescription: "", description: "", startAt: schedule.startAt, endAt: schedule.endAt, timezone: "Europe/Prague",
      timeLabel: "18:00–20:00", location: "", price: legacy!.price, currency: "CZK", capacity: legacy!.capacity,
      bring: legacy!.bring, status: "published", isDemo: false,
    });
    expect(await repos.listUnscheduledLegacyEvents!()).toEqual([]);
    // potvrzená rezervace R-3 zůstala navázaná a blokuje 1 místo
    expect((await repos.events.getPublishedBySlug("nejasna"))?.availableSpots).toBe(7);
  });
});

describe("Admin reservation status changes", () => {
  beforeEach(() => localStorage.clear());

  it("refuses to re-activate a cancelled reservation when the event is full", async () => {
    const repos = await freshRepos();
    const first = await repos.reservations.create(validInput("pilates-stred-tela", 2));
    if (!first.ok) throw new Error("reservation failed");
    await repos.reservations.updateStatus(first.reservation.id, "cancelled");
    expect((await repos.reservations.create(validInput("pilates-stred-tela", 3))).ok).toBe(true);
    await expect(repos.reservations.updateStatus(first.reservation.id, "confirmed")).rejects.toMatchObject({
      name: "RepositoryError",
      code: "not_enough_spots",
    });
  });

  it("allows changes between blocking states and re-activation when there is room", async () => {
    const repos = await freshRepos();
    const res = await repos.reservations.create(validInput("pilates-stred-tela", 1));
    if (!res.ok) throw new Error("reservation failed");
    await repos.reservations.updateStatus(res.reservation.id, "confirmed");
    await repos.reservations.updateStatus(res.reservation.id, "cancelled");
    await repos.reservations.updateStatus(res.reservation.id, "pending_payment");
    const [saved] = await repos.reservations.listForAdmin();
    expect(saved).toMatchObject({ reservationStatus: "pending_payment" });
    expect(new Date(saved!.expiresAt!).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("Unavailable data source", () => {
  it("rejects with a readable error instead of crashing the page", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_DATA_SOURCE", "supabase");
    try {
      const { getRepositories } = await import("@/data/repositories");
      await expect(getRepositories().events.listPublished()).rejects.toMatchObject({ code: "not_configured" });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("Reservation service", () => {
  beforeEach(() => localStorage.clear());

  it("validates input with field-level messages", async () => {
    vi.resetModules();
    const { reservationService } = await import("@/services/reservation-service");
    const errors = reservationService.validate({ eventId: "x", customerName: "A", customerEmail: "a", customerPhone: "1", numberOfSpots: 0 });
    expect(Object.keys(errors).sort()).toEqual(["customerEmail", "customerName", "customerPhone", "numberOfSpots"]);
  });

  it("creates a reservation through the repository", async () => {
    vi.resetModules();
    const { reservationService } = await import("@/services/reservation-service");
    const res = await reservationService.createReservation(validInput("ranni-joga-v-parku", 2));
    expect(res.ok).toBe(true);
  });
});
