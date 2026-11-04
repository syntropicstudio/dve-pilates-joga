import { Link } from "@tanstack/react-router";

/**
 * Chyba při načítání dat. Používá jen existující styly webu (`btn`, barvy značky),
 * aby se chyba nikdy netvářila jako prázdný seznam.
 */
export function LoadError({
  message = "Data se teď nepodařilo načíst.",
  onRetry,
  className = "",
}: {
  message?: string;
  onRetry?: (() => void) | undefined;
  className?: string;
}) {
  return (
    <div role="alert" className={`rounded-2xl bg-destructive/10 p-4 text-destructive ${className}`}>
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-ghost mt-3 min-h-11">
          Zkusit znovu
        </button>
      )}
    </div>
  );
}

/** Celostránková chyba načtení (detail akce, rezervace) – stejné rozvržení jako stránka „nenalezeno“. */
export function PageLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="text-4xl">Akci se nepodařilo načíst</h1>
      <p className="mt-3 text-muted-foreground">Zkus to prosím za chvíli znovu.</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onRetry} className="btn btn-primary">Zkusit znovu</button>
        <Link to="/" hash="akce" className="btn btn-ghost">Zpět na akce</Link>
      </div>
    </div>
  );
}
