/**
 * Pravidla obsazenosti akcí.
 *
 * - `confirmed` blokuje kapacitu vždy,
 * - `pending_payment` blokuje kapacitu jen do `expiresAt`,
 * - `cancelled` a `expired` kapacitu neblokují.
 *
 * Stejné pravidlo musí v produkci vynucovat databáze (RPC `create_reservation`
 * a view `public_events`) – viz SUPABASE_INTEGRATION.md. Frontend není autoritou.
 */
import type { Reservation } from "@/lib/types";

/** Jak dlouho drží nezaplacená rezervace místo (demo hodnota; v produkci nastavení backendu). */
export const PENDING_PAYMENT_HOLD_HOURS = 48;

export function pendingExpiresAt(createdAt: string) {
  return new Date(new Date(createdAt).getTime() + PENDING_PAYMENT_HOLD_HOURS * 3_600_000).toISOString();
}

type CapacityFields = Pick<Reservation, "reservationStatus" | "expiresAt">;

export function blocksCapacity(r: CapacityFields, now: Date = new Date()): boolean {
  if (r.reservationStatus === "confirmed") return true;
  if (r.reservationStatus === "pending_payment") {
    // Bez nastavené expirace raději blokuje (ochrana proti přeplnění).
    return !r.expiresAt || new Date(r.expiresAt).getTime() > now.getTime();
  }
  return false;
}

export function blockedSpots(
  reservations: (CapacityFields & Pick<Reservation, "eventId" | "numberOfSpots">)[],
  eventId: string,
  now: Date = new Date(),
) {
  return reservations
    .filter((r) => r.eventId === eventId && blocksCapacity(r, now))
    .reduce((n, r) => n + r.numberOfSpots, 0);
}

export function availableSpots(capacity: number, blocked: number) {
  return Math.max(0, capacity - blocked);
}

/** Je rezervace ve stavu `pending_payment` po expiraci? (v produkci řeší plánovaná úloha) */
export function isPendingExpired(r: CapacityFields, now: Date = new Date()) {
  return r.reservationStatus === "pending_payment" && !!r.expiresAt && new Date(r.expiresAt).getTime() <= now.getTime();
}
