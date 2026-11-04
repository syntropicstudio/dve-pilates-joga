import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRepositories, type EventInput } from "@/data/repositories";

export const dataKeys = {
  events: ["events"] as const,
  publishedEvents: ["events", "published"] as const,
  publishedEvent: (slug: string) => ["events", "published", slug] as const,
  adminEvents: ["events", "admin"] as const,
  unscheduledEvents: ["events", "unscheduled"] as const,
  reservations: ["reservations"] as const,
  gallery: ["gallery"] as const,
};

export function usePublishedEvents() {
  return useQuery({ queryKey: dataKeys.publishedEvents, queryFn: () => getRepositories().events.listPublished() });
}

export function usePublishedEvent(slug: string) {
  return useQuery({
    queryKey: dataKeys.publishedEvent(slug),
    queryFn: () => getRepositories().events.getPublishedBySlug(slug),
  });
}

export function useAdminEvents() {
  return useQuery({ queryKey: dataKeys.adminEvents, queryFn: () => getRepositories().events.listAllForAdmin() });
}

/** Pouze demo: akce z v1 bez jednoznačného času (čekají na doplnění). V Supabase vždy prázdné. */
export function useUnscheduledLegacyEvents() {
  const list = getRepositories().listUnscheduledLegacyEvents;
  return useQuery({
    queryKey: dataKeys.unscheduledEvents,
    queryFn: () => (list ? list() : Promise.resolve([])),
  });
}

export function useUpsertEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EventInput) => getRepositories().events.upsert(input),
    onSettled: () => qc.invalidateQueries({ queryKey: dataKeys.events }),
  });
}

export function useRemoveEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getRepositories().events.remove(id),
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: dataKeys.events }),
      qc.invalidateQueries({ queryKey: dataKeys.reservations }),
    ]),
  });
}

/** Pouze demo režim – obnoví výchozí ukázková data. */
export function useResetDemo() {
  const qc = useQueryClient();
  const reset = getRepositories().resetDemo;
  const mutation = useMutation({
    mutationFn: async () => reset?.(),
    onSettled: () => qc.invalidateQueries(),
  });
  return { ...mutation, available: !!reset };
}
