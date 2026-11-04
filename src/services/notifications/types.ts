/**
 * Kontrakt budoucích e-mailových notifikací (Supabase Edge Functions + Resend).
 * Frontend e-maily NEODESÍLÁ a nesmí znát API klíč Resend.
 * Notifikace vznikají na backendu jako reakce na změny v databázi.
 */
export type NotificationType =
  | "reservation_created" // potvrzení vytvoření rezervace zákazníkovi
  | "payment_instructions" // platební instrukce
  | "payment_confirmed" // potvrzení zaplacení
  | "reservation_cancelled" // zrušení rezervace
  | "event_cancelled" // zrušení celé akce – všem účastníkům
  | "event_reminder" // připomenutí před akcí
  | "admin_new_reservation"; // upozornění administrátorkám

export type NotificationStatus = "queued" | "sent" | "failed";

/** Záznam v tabulce `notification_log` (idempotence a audit odeslaných e-mailů). */
export interface NotificationLogEntry {
  id: string;
  type: NotificationType;
  reservationId?: string | undefined;
  eventId?: string | undefined;
  recipient: string;
  status: NotificationStatus;
  providerMessageId?: string | undefined;
  createdAt: string;
}
