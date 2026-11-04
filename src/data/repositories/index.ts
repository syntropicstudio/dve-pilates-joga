/**
 * Jediné místo, kde se volí implementace datové vrstvy.
 * Pro Supabase stačí doplnit `createSupabaseRepositories()` – UI se nemění.
 */
import { dataSource } from "@/config/data-source";
import type { Repositories } from "./types";
import { MockAuthRepository } from "./mock/MockAuthRepository";
import { MockEventRepository } from "./mock/MockEventRepository";
import { MockGalleryRepository } from "./mock/MockGalleryRepository";
import { MockReservationRepository } from "./mock/MockReservationRepository";
import { readState, resetState } from "./mock/mock-db";
import { RepositoryError } from "./types";

function createMockRepositories(): Repositories {
  return {
    events: new MockEventRepository(),
    reservations: new MockReservationRepository(),
    gallery: new MockGalleryRepository(),
    auth: new MockAuthRepository(),
    resetDemo: async () => resetState(),
    listUnscheduledLegacyEvents: async () => readState().unscheduledEvents,
  };
}

/**
 * Supabase zatím není implementován. Místo pádu celé stránky vrací repozitáře,
 * jejichž metody skončí srozumitelnou chybou – UI zobrazí chybový stav.
 */
function createUnavailableRepositories(): Repositories {
  const fail = () =>
    Promise.reject(
      new RepositoryError(
        "Datový zdroj „supabase“ zatím není implementován. Nastav VITE_DATA_SOURCE=mock nebo viz SUPABASE_INTEGRATION.md.",
        "not_configured",
      ),
    );
  const stub = <T extends object>() => new Proxy({} as T, { get: () => fail });
  return { events: stub(), reservations: stub(), gallery: stub(), auth: stub() };
}

let repositories: Repositories | null = null;

export function getRepositories(): Repositories {
  if (repositories) return repositories;
  repositories = dataSource === "supabase" ? createUnavailableRepositories() : createMockRepositories();
  return repositories;
}

export type * from "./types";
export { RepositoryError } from "./types";
