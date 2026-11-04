/**
 * Rezervační služba – jediný vstupní bod UI pro vytvoření rezervace.
 *
 * Demo: volá MockReservationRepository (localStorage).
 * Produkce: SupabaseReservationRepository zavolá Edge Function `create-reservation`,
 * která ověří captchu, provede atomickou kontrolu kapacity v PostgreSQL
 * a zařadí e-mailové notifikace. Frontend o dostupnosti nerozhoduje.
 */
import { getRepositories, type CreateReservationInput, type CreateReservationResult } from "@/data/repositories";
import { validateReservationInput } from "@/lib/reservation-validation";

export const reservationService = {
  validate: validateReservationInput,

  async createReservation(input: CreateReservationInput): Promise<CreateReservationResult> {
    try {
      return await getRepositories().reservations.create(input);
    } catch {
      return { ok: false, code: "unavailable", message: "Rezervaci se nepodařilo odeslat. Zkus to prosím znovu." };
    }
  },
};
