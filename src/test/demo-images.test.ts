import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
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
    const events = demoEvents.map(({ image: _image, ...event }) => event);
    const reservation = { id: "R-KEEP", eventId: events[0]?.id, seats: 1, status: "nova" };
    localStorage.setItem("dve-demo-v1", JSON.stringify({
      events: events.map((event, i) => i === 1 ? { ...event, image: "/custom.jpg" } : event),
      reservations: [reservation],
      gallery: [{ id: "g1", caption: "Místo pro fotografii z lekce", ratio: "tall" },
        { id: "g2", caption: "Moje fotka", src: "/gallery-custom.jpg", ratio: "square" }],
    }));
    const { useStore } = await import("@/services/store");
    const { result } = renderHook(() => useStore());
    expect(result.current.events[0]?.image).toBe(demoEvents[0]?.image);
    expect(result.current.events[1]?.image).toBe("/custom.jpg");
    expect(result.current.reservations).toEqual([reservation]);
    expect(result.current.gallery[0]?.src).toBe(demoGallery[0]?.src);
    expect(result.current.gallery[1]?.src).toBe("/gallery-custom.jpg");
  });
});