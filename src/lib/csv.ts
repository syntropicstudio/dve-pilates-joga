import type { DveEvent, Reservation } from "@/lib/types";

/** Export rezervací do CSV (středník, UTF-8 s BOM – kvůli Excelu). */
export function reservationsToCsv(rows: Reservation[], events: Pick<DveEvent, "id" | "title">[]) {
  const head = ["ID", "Akce", "Jméno", "E-mail", "Telefon", "Míst", "Stav", "Platba", "Vytvořeno", "Poznámka"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.id,
      events.find((e) => e.id === r.eventId)?.title,
      r.customerName,
      r.customerEmail,
      r.customerPhone,
      r.numberOfSpots,
      r.reservationStatus,
      r.paymentStatus,
      r.createdAt,
      r.note,
    ]
      .map(esc)
      .join(";"),
  );
  return "﻿" + [head.map(esc).join(";"), ...lines].join("\n");
}
