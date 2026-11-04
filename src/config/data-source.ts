/**
 * Výběr datového zdroje. Dnes je podporován pouze demo režim (`mock`).
 * `supabase` bude dostupný po implementaci `src/data/repositories/supabase/*`.
 */
export type DataSource = "mock" | "supabase";

function resolveDataSource(): DataSource {
  const value = import.meta.env["VITE_DATA_SOURCE"];
  return value === "supabase" ? "supabase" : "mock";
}

export const dataSource: DataSource = resolveDataSource();

export const isDemoMode = dataSource === "mock";
