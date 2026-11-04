/** Text chyby z datové vrstvy (RepositoryError nese českou zprávu). */
export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.name === "RepositoryError" ? error.message : fallback;
}
