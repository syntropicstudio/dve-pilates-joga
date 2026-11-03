/**
 * Centrální konfigurace webu DVĚ.
 * Neznámé hodnoty nechte jako null – web zobrazí bezpečný náhradní stav.
 */
export const site = {
  name: "DVĚ",
  subtitle: "jóga a pilates",
  slogan: "Pohyb, který tě vrátí k sobě.",
  intro:
    "Jóga, pilates a chvíle, na které se těšíš. Online i naživo. Objev prostor pro pohyb, zpomalení a radost ze společných setkání.",
  description:
    "DVĚ – jóga a pilates. Online lekce na Forendors, pravidelné lekce naživo, workshopy a víkendové pobyty pro všechny úrovně.",

  /** Odkaz na profil DVĚ na Forendors, např. "https://www.forendors.cz/..." */
  forendorsUrl: "https://www.forendors.cz/" as string | null,
  /** YouTube URL ukázkové lekce (watch?v=…, youtu.be/…, shorts/…) */
  youtubeUrl: "https://www.youtube.com/watch?v=3DcoC8p9az8&list=RD3DcoC8p9az8&start_radio=1" as string | null,
  /** Kontaktní e-mail */
  email: "info@projektdve.cz" as string | null,
  /** Instagram profil */
  instagramUrl: "https://www.instagram.com/" as string | null,
  /** Další sociální sítě */
  facebookUrl: null as string | null,
  /** Oblast působení */
  location: null as string | null,

  /** Právní dokumenty – zatím nejsou připravené */
  privacyUrl: null as string | null,
  termsUrl: null as string | null,
};

export const navItems = [
  { id: "uvod", label: "Úvod" },
  { id: "o-nas", label: "O nás" },
  { id: "online", label: "Online lekce" },
  { id: "akce", label: "Akce a rezervace" },
  { id: "galerie", label: "Galerie" },
  { id: "faq", label: "FAQ" },
  { id: "kontakt", label: "Kontakt" },
] as const;

export function youtubeId(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{6,})/);
    return m?.[2] ?? null;
  } catch {
    return null;
  }
}
