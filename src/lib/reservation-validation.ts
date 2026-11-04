/**
 * Validace rezervace. Používá ji formulář (UX) i repozitář.
 * V produkci musí stejná pravidla znovu ověřit Edge Function / databáze.
 */
import type { CreateReservationInput } from "@/data/repositories/types";

export type ReservationField = "customerName" | "customerEmail" | "customerPhone" | "numberOfSpots";
export type ReservationFieldErrors = Partial<Record<ReservationField, string>>;

export function validateReservationInput(input: CreateReservationInput): ReservationFieldErrors {
  const err: ReservationFieldErrors = {};
  if (input.customerName.trim().length < 3) err.customerName = "Vyplň prosím jméno a příjmení.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customerEmail.trim())) err.customerEmail = "Zadej platný e-mail.";
  if (!/^\+?[\d\s]{9,16}$/.test(input.customerPhone.trim())) err.customerPhone = "Zadej platné telefonní číslo.";
  if (!Number.isInteger(input.numberOfSpots) || input.numberOfSpots < 1)
    err.numberOfSpots = "Počet míst musí být alespoň 1.";
  return err;
}

export const spotsErrorMessage = (available: number) =>
  available === 0 ? "Akce je již obsazená." : `Volných míst je už jen ${available}.`;
