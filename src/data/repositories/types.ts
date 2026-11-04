/**
 * Rozhraní datové vrstvy. UI pracuje pouze s nimi (přes hooky v `src/hooks/data`).
 * Dnes je implementuje `mock/*` (localStorage), později `supabase/*`.
 * Všechny metody jsou asynchronní, aby šlo implementaci vyměnit bez změn UI.
 */
import type {
  AdminEvent,
  AdminProfile,
  DveEvent,
  GalleryItem,
  PublicEvent,
  Reservation,
  ReservationStatus,
} from "@/lib/types";

/** Data akce zadaná v administraci. `id`, `createdAt`, `updatedAt` doplní repozitář. */
export type EventInput = Omit<DveEvent, "id" | "createdAt" | "updatedAt"> & { id?: string | undefined };

export interface EventRepository {
  /** Veřejné: publikované akce s agregovanou obsazeností. */
  listPublished(): Promise<PublicEvent[]>;
  /** Veřejné: jedna publikovaná akce podle slugu, jinak `null`. */
  getPublishedBySlug(slug: string): Promise<PublicEvent | null>;
  /** Admin: všechny akce včetně skrytých. */
  listAllForAdmin(): Promise<AdminEvent[]>;
  /** Admin: vytvoření nebo úprava akce. */
  upsert(input: EventInput): Promise<DveEvent>;
  /** Admin: odstranění akce (v produkci spíše `status = cancelled/archived`). */
  remove(id: string): Promise<void>;
}

/** Vstup z veřejného rezervačního formuláře. Zákazník nemá účet. */
export interface CreateReservationInput {
  eventId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  numberOfSpots: number;
  note?: string | undefined;
  /** Token z ochrany proti botům (Turnstile/hCaptcha) – v produkci ověří Edge Function. */
  captchaToken?: string | undefined;
}

export type ReservationErrorCode = "event_not_found" | "sold_out" | "not_enough_spots" | "invalid_input" | "unavailable";

export type CreateReservationResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; code: ReservationErrorCode; message: string; availableSpots?: number | undefined };

export interface ReservationRepository {
  /** Veřejné: atomická kontrola kapacity + vytvoření rezervace (v produkci RPC / Edge Function). */
  create(input: CreateReservationInput): Promise<CreateReservationResult>;
  /** Admin: seznam rezervací. */
  listForAdmin(): Promise<Reservation[]>;
  /**
   * Admin: změna stavu rezervace. Přechod do stavu, který blokuje kapacitu
   * (`confirmed` / `pending_payment`), znovu ověří volná místa a při nedostatku
   * skončí chybou `RepositoryError` – v produkci totéž atomicky v databázi.
   */
  updateStatus(id: string, status: ReservationStatus): Promise<void>;
}

/** Chyba datové vrstvy se srozumitelnou českou zprávou pro UI. */
export class RepositoryError extends Error {
  constructor(message: string, readonly code: string = "error") {
    super(message);
    this.name = "RepositoryError";
  }
}

/**
 * Akce z původního dema (v1), u které nešlo jednoznačně určit čas.
 * Neexistuje pro ni vymyšlený termín – čeká na doplnění v administraci.
 */
export interface UnscheduledLegacyEvent {
  id: string;
  title: string;
  category: DveEvent["category"];
  shortDescription: string;
  description: string;
  date: string;
  endDate?: string | undefined;
  timeLabel: string;
  location: string;
  price: number;
  capacity: number;
  instructor?: string | undefined;
  bring: string[];
  image?: string | undefined;
  wasPublished: boolean;
  isDemo: boolean;
}

export interface GalleryRepository {
  list(): Promise<GalleryItem[]>;
  /** Admin: uložení celé galerie (demo). V produkci jednotlivé operace + upload do Storage. */
  replaceAll(items: GalleryItem[]): Promise<void>;
}

export interface AdminSession {
  /** Simulovaná relace demo administrace – NENÍ to zabezpečení. */
  isDemo: boolean;
  profile: AdminProfile | null;
}

export interface AuthRepository {
  getSession(): Promise<AdminSession | null>;
  signOut(): Promise<void>;
}

export interface Repositories {
  events: EventRepository;
  reservations: ReservationRepository;
  gallery: GalleryRepository;
  auth: AuthRepository;
  /** Pouze demo režim: obnoví výchozí ukázková data. */
  resetDemo?: (() => Promise<void>) | undefined;
  /** Pouze demo režim: akce z v1 bez jednoznačného času (Supabase je mít nebude). */
  listUnscheduledLegacyEvents?: (() => Promise<UnscheduledLegacyEvent[]>) | undefined;
}
