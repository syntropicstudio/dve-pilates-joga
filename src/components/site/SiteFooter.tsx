import { Link } from "@tanstack/react-router";
import symbol from "@/assets/dve-symbol.png.asset.json";
import { navItems, site } from "@/config/site";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-cocoa text-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <img src={symbol.url} alt="" className="h-14 w-14" width={56} height={56} loading="lazy" />
            <div>
              <p className="font-display text-4xl leading-none">Dvě</p>
              <p className="text-sm text-cream/70">jóga a pilates</p>
            </div>
          </div>
          <p className="mt-5 max-w-sm text-cream/75">
            Komunita dvou žen, které spojuje láska k vědomému pohybu. Online lekce, setkání naživo, workshopy a pobyty.
          </p>
        </div>
        <nav aria-label="Odkazy v patičce">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sun">Web</p>
          <ul className="grid grid-cols-2 gap-2 text-cream/80">
            {navItems.map((n) => (
              <li key={n.id}>
                <Link to="/" hash={n.id} className="hover:text-sun">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sun">Kontakt</p>
          <ul className="space-y-2 text-cream/80">
            <li>{site.email ? <a href={`mailto:${site.email}`} className="hover:text-sun">{site.email}</a> : "E-mail brzy doplníme"}</li>
            <li>{site.instagramUrl ? <a href={site.instagramUrl} target="_blank" rel="noreferrer" className="hover:text-sun">Instagram</a> : "Instagram brzy doplníme"}</li>
            <li>{site.forendorsUrl ? <a href={site.forendorsUrl} target="_blank" rel="noreferrer" className="hover:text-sun">Forendors</a> : "Forendors brzy doplníme"}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-sm text-cream/60 sm:flex-row sm:justify-between">
          <p>© {year} DVĚ – jóga a pilates</p>
          <p>
            {site.privacyUrl ? <a href={site.privacyUrl} className="hover:text-sun">Ochrana osobních údajů</a> : "Ochrana osobních údajů – připravujeme"}
            {" · "}
            {site.termsUrl ? <a href={site.termsUrl} className="hover:text-sun">Obchodní podmínky</a> : "Obchodní podmínky – připravujeme"}
          </p>
        </div>
      </div>
    </footer>
  );
}
