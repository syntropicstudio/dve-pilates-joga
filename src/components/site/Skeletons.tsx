/**
 * Nenápadné placeholdery během načítání dat. Kopírují rozměry skutečného obsahu,
 * aby se layout po načtení neposouval. Používají jen barvy značky.
 */
const bar = "rounded-full bg-blush/70";

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse ${bar} ${className}`} aria-hidden />;
}

export function EventCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-soft)]" aria-hidden>
      <div className="aspect-[4/3] bg-blush/60" />
      <div className="flex flex-1 flex-col p-6">
        <div className={`h-7 w-3/4 ${bar}`} />
        <div className={`mt-3 h-4 w-full ${bar}`} />
        <div className="mt-5 space-y-2.5">
          <div className={`h-3.5 w-1/2 ${bar}`} />
          <div className={`h-3.5 w-1/3 ${bar}`} />
          <div className={`h-3.5 w-2/5 ${bar}`} />
        </div>
        <div className="mt-5 flex items-end justify-between gap-3 border-t border-border pt-4">
          <div className={`h-7 w-24 ${bar}`} />
          <div className="h-11 w-36 rounded-full bg-sun/40" />
        </div>
      </div>
    </div>
  );
}

export function EventGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </>
  );
}

const galleryRatio = ["row-span-2", "", "sm:col-span-2", "", "row-span-2", ""];

export function GallerySkeleton() {
  return (
    <>
      {galleryRatio.map((r, i) => (
        <div key={i} className={`animate-pulse rounded-3xl bg-blush ${r}`} aria-hidden />
      ))}
    </>
  );
}

/** Placeholder detailu akce / rezervace – zachová kontejner stránky. */
export function PageSkeleton({ variant }: { variant: "detail" | "booking" }) {
  if (variant === "detail")
    return (
      <div className="mx-auto max-w-6xl px-5 py-10 lg:py-16" aria-busy="true" aria-label="Načítám akci">
        <SkeletonBlock className="h-4 w-28" />
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="aspect-[4/3] animate-pulse rounded-[2.5rem] bg-blush/60" />
          <div className="space-y-4">
            <SkeletonBlock className="h-3.5 w-32" />
            <SkeletonBlock className="h-12 w-4/5" />
            <SkeletonBlock className="h-5 w-full" />
            <SkeletonBlock className="h-5 w-2/3" />
          </div>
        </div>
      </div>
    );
  return (
    <div className="mx-auto max-w-5xl px-5 py-10 lg:py-16" aria-busy="true" aria-label="Načítám rezervaci">
      <SkeletonBlock className="h-4 w-36" />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="h-64 animate-pulse rounded-3xl bg-blush" />
        <div className="space-y-5">
          <div className="h-16 animate-pulse rounded-2xl bg-card" />
          <div className="h-12 animate-pulse rounded-2xl bg-card" />
          <div className="h-12 animate-pulse rounded-2xl bg-card" />
        </div>
      </div>
    </div>
  );
}

/** Řádky tabulky v administraci. */
export function TableRowsSkeleton({ cols, rows = 3 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} aria-hidden>
          {Array.from({ length: cols }, (_, j) => (
            <td key={j} className="p-4">
              <div className={`h-4 animate-pulse ${bar} ${j === 0 ? "w-3/4" : "w-1/2"}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
