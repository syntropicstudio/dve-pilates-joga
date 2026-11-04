import type { GalleryItem } from "@/lib/types";
import type { GalleryRepository } from "@/data/repositories/types";
import { readState, writeState } from "./mock-db";

export class MockGalleryRepository implements GalleryRepository {
  async list() {
    return [...readState().gallery].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async replaceAll(items: GalleryItem[]) {
    writeState({ ...readState(), gallery: items });
  }
}
