export type EventCategory = "joga" | "pilates" | "workshop" | "event" | "pobyt";

export const categoryLabels: Record<EventCategory, string> = {
  joga: "Lekce jógy",
  pilates: "Lekce pilates",
  workshop: "Workshop",
  event: "Jednodenní event",
  pobyt: "Víkendový pobyt",
};

export interface DveEvent {
  id: string;
  title: string;
  category: EventCategory;
  shortDescription: string;
  description: string;
  date: string; // YYYY-MM-DD
  endDate?: string | undefined;
  time: string;
  location: string;
  price: number;
  capacity: number;
  instructor?: string | undefined;
  bring: string[];
  image?: string | undefined;
  published: boolean;
  demo: boolean;
}

export type ReservationStatus = "nova" | "ceka-na-platbu" | "potvrzena" | "zrusena";

export const statusLabels: Record<ReservationStatus, string> = {
  nova: "Nová",
  "ceka-na-platbu": "Čeká na platbu",
  potvrzena: "Potvrzená",
  zrusena: "Zrušená",
};

/** Připraveno pro budoucí platby (QR, brána). Zatím se nic nezpracovává. */
export type PaymentState = "neresi-se" | "ceka" | "zaplaceno";

export interface Reservation {
  id: string;
  eventId: string;
  name: string;
  email: string;
  phone: string;
  seats: number;
  note?: string | undefined;
  status: ReservationStatus;
  payment: PaymentState;
  createdAt: string;
}

export interface GalleryItem {
  id: string;
  caption: string;
  src?: string | undefined;
  ratio: "square" | "tall" | "wide";
}
