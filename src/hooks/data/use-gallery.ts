import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRepositories } from "@/data/repositories";
import type { GalleryItem } from "@/lib/types";
import { dataKeys } from "./use-events";

export function useGallery() {
  return useQuery({ queryKey: dataKeys.gallery, queryFn: () => getRepositories().gallery.list() });
}

export function useSaveGallery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: GalleryItem[]) => getRepositories().gallery.replaceAll(items),
    // Optimistická změna – psaní do polí v administraci nesmí čekat na uložení.
    // Po úspěchu se nerefetchuje (refetch by mohl přepsat rozepsaný text); při chybě se data obnoví.
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: dataKeys.gallery });
      qc.setQueryData(dataKeys.gallery, items);
    },
    onError: () => qc.invalidateQueries({ queryKey: dataKeys.gallery }),
  });
}
