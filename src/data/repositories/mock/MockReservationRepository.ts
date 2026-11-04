import { availableSpots, blockedSpots, blocksCapacity, pendingExpiresAt } from "@/lib/capacity";
import { spotsErrorMessage, validateReservationInput } from "@/lib/reservation-validation";
import type { Reservation, ReservationStatus } from "@/lib/types";
import {
  RepositoryError,
  type CreateReservationInput,
  type CreateReservationResult,
  type ReservationRepository,
} from "@/data/repositories/types";
import { mockId, readState, writeState } from "./mock-db";

/**
 * Demo rezervace. Kontrola kapacity a zápis proběhnou v jednom synchronním kroku,
 * ale jen v rámci jednoho prohlížeče. Skutečnou atomicitu zajistí až databáze.
 */
export class MockReservationRepository implements ReservationRepository {
  async create(input: CreateReservationInput): Promise<CreateReservationResult> {
    const firstError = Object.values(validateReservationInput(input))[0];
    if (firstError) return { ok: false, code: "invalid_input", message: firstError };

    const nowDate = new Date();
    const s = readState(nowDate);
    const ev = s.events.find((e) => e.id === input.eventId && e.status === "published");
    if (!ev) return { ok: false, code: "event_not_found", message: "Akce nebyla nalezena." };

    const free = availableSpots(ev.capacity, blockedSpots(s.reservations, ev.id, nowDate));
    if (input.numberOfSpots > free)
      return {
        ok: false,
        code: free === 0 ? "sold_out" : "not_enough_spots",
        message: spotsErrorMessage(free),
        availableSpots: free,
      };

    const now = nowDate.toISOString();
    const reservation: Reservation = {
      id: "R-" + mockId().toUpperCase(),
      eventId: ev.id,
      customerName: input.customerName.trim(),
      customerEmail: input.customerEmail.trim(),
      customerPhone: input.customerPhone.trim(),
      numberOfSpots: input.numberOfSpots,
      note: input.note?.trim() || undefined,
      reservationStatus: "pending_payment",
      paymentStatus: "unpaid",
      expiresAt: pendingExpiresAt(now),
      createdAt: now,
      updatedAt: now,
    };
    writeState({ ...s, reservations: [reservation, ...s.reservations] });
    return { ok: true, reservation };
  }

  async listForAdmin() {
    return readState().reservations;
  }

  async updateStatus(id: string, status: ReservationStatus) {
    const nowDate = new Date();
    const s = readState(nowDate);
    const now = nowDate.toISOString();
    const current = s.reservations.find((r) => r.id === id);
    if (!current) throw new RepositoryError("Rezervace nebyla nalezena.", "not_found");
    const next = {
      reservationStatus: status,
      expiresAt: status === "pending_payment" ? pendingExpiresAt(now) : current.expiresAt,
    };
    // Návrat zrušené/vypršelé rezervace do blokujícího stavu nesmí přeplnit akci.
    if (!blocksCapacity(current, nowDate) && blocksCapacity(next, nowDate)) {
      const ev = s.events.find((e) => e.id === current.eventId);
      const free = ev ? availableSpots(ev.capacity, blockedSpots(s.reservations, ev.id, nowDate)) : 0;
      if (current.numberOfSpots > free)
        throw new RepositoryError(
          `Stav nelze změnit: na akci zbývá ${free} volných míst, rezervace potřebuje ${current.numberOfSpots}.`,
          "not_enough_spots",
        );
    }
    writeState({
      ...s,
      reservations: s.reservations.map((r) =>
        r.id === id
          ? {
              ...r,
              // Ruční návrat do stavu čekající platby znovu otevře lhůtu na zaplacení.
              ...next,
              updatedAt: now,
            }
          : r,
      ),
    });
  }
}
