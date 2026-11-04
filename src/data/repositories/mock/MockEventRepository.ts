import { availableSpots, blockedSpots } from "@/lib/capacity";
import type { AdminEvent, DveEvent, PublicEvent } from "@/lib/types";
import type { EventInput, EventRepository } from "@/data/repositories/types";
import { mockId, readState, writeState, type MockState } from "./mock-db";

function withAvailability(s: MockState, ev: DveEvent, now: Date): AdminEvent {
  const blocked = blockedSpots(s.reservations, ev.id, now);
  return { ...ev, blockedSpots: blocked, availableSpots: availableSpots(ev.capacity, blocked) };
}

/** Veřejný pohled nesmí obsahovat interní údaje administrace. */
function toPublic(ev: AdminEvent): PublicEvent {
  const { blockedSpots: _blocked, ...rest } = ev;
  return rest;
}

const byStart = (a: DveEvent, b: DveEvent) => a.startAt.localeCompare(b.startAt);

export function slugify(title: string) {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "akce"}-${mockId().slice(0, 4)}`;
}

export class MockEventRepository implements EventRepository {
  async listPublished() {
    const now = new Date();
    const s = readState(now);
    return s.events
      .filter((e) => e.status === "published")
      .sort(byStart)
      .map((e) => toPublic(withAvailability(s, e, now)));
  }

  async getPublishedBySlug(slug: string) {
    const now = new Date();
    const s = readState(now);
    const ev = s.events.find((e) => e.slug === slug && e.status === "published");
    return ev ? toPublic(withAvailability(s, ev, now)) : null;
  }

  async listAllForAdmin() {
    const now = new Date();
    const s = readState(now);
    return s.events.map((e) => withAvailability(s, e, now));
  }

  async upsert(input: EventInput) {
    const s = readState();
    const now = new Date().toISOString();
    const existing = input.id ? s.events.find((e) => e.id === input.id) : undefined;
    let saved: DveEvent;
    if (existing) {
      saved = { ...existing, ...input, id: existing.id, createdAt: existing.createdAt, updatedAt: now };
      writeState({ ...s, events: s.events.map((e) => (e.id === existing.id ? saved : e)) });
    } else {
      // V demu je id zároveň slug (URL). V Supabase bude id UUID a slug samostatný sloupec.
      const id = input.id || slugify(input.title);
      saved = { ...input, id, slug: input.slug || id, createdAt: now, updatedAt: now };
      // Doplněná akce z v1 opouští seznam akcí bez termínu (její rezervace zůstávají navázané).
      writeState({
        ...s,
        events: [...s.events, saved],
        unscheduledEvents: s.unscheduledEvents.filter((e) => e.id !== id),
      });
    }
    return saved;
  }

  async remove(id: string) {
    const s = readState();
    writeState({
      ...s,
      events: s.events.filter((e) => e.id !== id),
      unscheduledEvents: s.unscheduledEvents.filter((e) => e.id !== id),
      reservations: s.reservations.filter((r) => r.eventId !== id),
    });
  }
}
