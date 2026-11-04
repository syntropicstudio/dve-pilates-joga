import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoEvents, demoGallery } from "@/data/demo";

describe("Demo image updates", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("fills every demo event and gallery entry with an image", () => {
    expect(demoEvents).toHaveLength(5);
    expect(demoGallery).toHaveLength(6);
    for (const event of demoEvents) expect(event.image).toBeTruthy();
    for (const item of demoGallery) expect(item.src).toBeTruthy();
  });

  it("updates saved placeholders without removing reservations or custom photos", async () => {
    const v2 = (await import("@/data/repositories/mock/mock-db")).initialState();
    const events = v2.events.map(({ image: _image, ...event }) => event);
    const reservation = {
      id: "R-KEEP", eventId: events[0]?.id, customerName: "Test", customerEmail: "t@example.com", customerPhone: "123456789",
      numberOfSpots: 1, reservationStatus: "confirmed", paymentStatus: "paid", createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    localStorage.setItem("dve-demo-v2", JSON.stringify({
      events: events.map((event, i) => i === 1 ? { ...event, image: "/custom.jpg" } : event),
      reservations: [reservation],
      gallery: [{ id: "g1", caption: "Místo pro fotografii z lekce", ratio: "tall", sortOrder: 1 },
        { id: "g2", caption: "Moje fotka", src: "/gallery-custom.jpg", ratio: "square", sortOrder: 2 }],
    }));
    const { readState } = await import("@/data/repositories/mock/mock-db");
    const state = readState();
    expect(state.events[0]?.image).toBe(demoEvents[0]?.image);
    expect(state.events[1]?.image).toBe("/custom.jpg");
    expect(state.reservations).toEqual([reservation]);
    expect(state.gallery[0]?.src).toBe(demoGallery[0]?.src);
    expect(state.gallery[1]?.src).toBe("/gallery-custom.jpg");
  });
});
