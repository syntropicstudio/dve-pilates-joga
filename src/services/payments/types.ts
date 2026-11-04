/**
 * Kontrakt budoucí platební integrace (QR platba, GoPay, Comgate).
 * Zatím BEZ implementace – žádná platba se neprovádí.
 *
 * Zásady:
 * - Platbu zakládá a ověřuje backend (Supabase Edge Function), nikdy prohlížeč.
 * - Stav `paid` nastavuje pouze ověřený webhook brány nebo ruční párování adminem.
 * - Frontend dostane jen údaje k zobrazení (QR / URL přesměrování).
 */
import type { Currency, PaymentMethod, PaymentStatus } from "@/lib/types";

export interface PaymentInstructions {
  reservationId: string;
  method: PaymentMethod;
  amount: number;
  currency: Currency;
  /** Bankovní převod / QR platba. */
  bankAccount?: string | undefined;
  variableSymbol?: string | undefined;
  qrPayload?: string | undefined;
  /** Platební brána – URL, kam přesměrovat zákazníka. */
  redirectUrl?: string | undefined;
  /** Do kdy je nutné zaplatit (shodné s `Reservation.expiresAt`). */
  payBy?: string | undefined;
}

/** Klientská část platebního toku – implementace bude volat Edge Functions. */
export interface PaymentGateway {
  /** Vytvoří (na backendu) platbu k rezervaci a vrátí instrukce pro zákazníka. */
  startPayment(reservationId: string): Promise<PaymentInstructions>;
  /** Přečte stav platby z backendu (jen pro zobrazení, nikdy jako autorita). */
  getPaymentStatus(reservationId: string): Promise<PaymentStatus>;
}
