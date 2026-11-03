import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/dve-logo.png.asset.json";
import { navItems } from "@/config/site";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 lg:h-18">
        <Link to="/" hash="uvod" className="shrink-0" aria-label="DVĚ – jóga a pilates, úvod">
          <img src={logo.url} alt="DVĚ – jóga a pilates" className="h-10 w-auto lg:h-11" width={84} height={44} />
        </Link>
        <nav aria-label="Hlavní navigace" className="hidden items-center gap-1 xl:flex">
          {navItems.map((n) => (
            <Link
              key={n.id}
              to="/"
              hash={n.id}
              className="rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-blush"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/" hash="akce" className="btn btn-primary hidden min-h-11 sm:inline-flex">
            Rezervovat místo
          </Link>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full hover:bg-blush xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Zavřít menu" : "Otevřít menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label="Mobilní navigace" className="border-t border-border bg-background px-5 pb-6 pt-2 xl:hidden">
          <ul className="flex flex-col">
            {navItems.map((n) => (
              <li key={n.id}>
                <Link
                  to="/"
                  hash={n.id}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-3 font-display text-xl hover:bg-blush"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/" hash="akce" onClick={() => setOpen(false)} className="btn btn-primary mt-4 w-full">
            Rezervovat místo
          </Link>
        </nav>
      )}
    </header>
  );
}
