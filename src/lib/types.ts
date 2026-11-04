/**
 * Doménové modely projektu DVĚ.
 * Názvy polí odpovídají budoucím tabulkám Supabase (camelCase ↔ snake_case),
 * viz SUPABASE_INTEGRATION.md.
 */

export type EventCategory = "joga" | "pilates" | "workshop" | "event" | "pobyt";

export const categoryLabels: Record<EventCategory, string> = {
  joga: "Lekce jógy",
  pilates: "Lekce pilates",
  workshop: "Workshop",
  event: "Jednodenní event",
  pobyt: "Víkendový pobyt",
};

export type EventStatus = "draft" | "published" | "cancelled" | "archived";

export const eventStatusLabels: Record<EventStatus, string> = {
  draft: "Skryto",
  published: "Publikováno",
  cancelled: "Zrušeno",
  archived: "Archivováno",
};

export type Currency = "CZK";

export interface DveEvent {
  id: string;
  /** Část URL (`/akce/$id`). U demo akcí shodná s `id`. */
  slug: string;
  title: string;
  category: EventCategory;
  shortDescription: string;
  description: string;
  /** Začátek akce – ISO 8601 v UTC. */
  startAt: string;
  /** Konec akce – ISO 8601 v UTC. */
  endAt: string;
  /** IANA časové pásmo, ve kterém se termín zobrazuje. */
  timezone: string;
  /** Čas tak, jak se zobrazuje na webu (např. „8:30–9:45“). */
  timeLabel: string;
  location: string;
  price: number;
  currency: Currency;
  capacity: number;
  instructor?: string | undefined;
  bring: string[];
  image?: string | undefined;
  status: EventStatus;
  /** Ukázková akce – na webu se označuje štítkem „Ukázka“. */
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Veřejný pohled na akci – obsahuje jen agregovanou obsazenost, nikdy rezervace. */
export interface PublicEvent extends DveEvent {
  availableSpots: number;
}

/** Pohled pro administraci. */
export interface AdminEvent extends PublicEvent {
  blockedSpots: number;
}

export type ReservationStatus = "pending_payment" | "confirmed" | "cancelled" | "expired";

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  pending_payment: "Čeká na platbu",
  confirmed: "Potvrzená",
  cancelled: "Zrušená",
  expired: "Vypršela",
};

export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | "failed";

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: "Nezaplaceno",
  pending: "Platba se zpracovává",
  paid: "Zaplaceno",
  refunded: "Vráceno",
  failed: "Platba selhala",
};

export interface Reservation {
  id: string;
  eventId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  numberOfSpots: number;
  note?: string | undefined;
  reservationStatus: ReservationStatus;
  paymentStatus: PaymentStatus;
  /** Do kdy blokuje rezervace ve stavu `pending_payment` kapacitu. */
  expiresAt?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryItem {
  id: string;
  caption: string;
  src?: string | undefined;
  /** Budoucí cesta v Supabase Storage (bucket `gallery`). */
  storagePath?: string | undefined;
  ratio: "square" | "tall" | "wide";
  sortOrder: number;
}

/** Profil administrátorky – propojený s uživatelem Supabase Auth. Zákazníci účty nemají. */
export interface AdminProfile {
  id: string;
  email: string;
  displayName: string;
  role: "admin";
}

export type PaymentMethod = "qr" | "gopay" | "comgate" | "manual";

/** Platba k rezervaci. Stav potvrzuje výhradně backend (webhook / ruční párování). */
export interface Payment {
  id: string;
  reservationId: string;
  method: PaymentMethod;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  providerReference?: string | undefined;
  createdAt: string;
  updatedAt: string;
}
