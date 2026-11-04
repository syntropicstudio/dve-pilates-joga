import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRepositories, type CreateReservationInput } from "@/data/repositories";
import type { ReservationStatus } from "@/lib/types";
import { reservationService } from "@/services/reservation-service";
import { dataKeys } from "./use-events";

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReservationInput) => reservationService.createReservation(input),
    // Obsazenost se mění → načti akce znovu (i po neúspěchu, např. „obsazeno“).
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: dataKeys.events }),
      qc.invalidateQueries({ queryKey: dataKeys.reservations }),
    ]),
  });
}

export function useAdminReservations() {
  return useQuery({ queryKey: dataKeys.reservations, queryFn: () => getRepositories().reservations.listForAdmin() });
}

export function useUpdateReservationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReservationStatus }) =>
      getRepositories().reservations.updateStatus(id, status),
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: dataKeys.reservations }),
      qc.invalidateQueries({ queryKey: dataKeys.events }),
    ]),
  });
}
