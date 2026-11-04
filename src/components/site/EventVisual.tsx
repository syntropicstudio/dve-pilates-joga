import symbol from "@/assets/dve-symbol.png";
import type { DveEvent } from "@/lib/types";
import { categoryLabels } from "@/lib/types";

const tones: Record<DveEvent["category"], string> = {
  joga: "bg-sun/60",
  pilates: "bg-blush",
  workshop: "bg-rose/40",
  event: "bg-sun/40",
  pobyt: "bg-mist/60",
};

/** Fotka akce, nebo stylový placeholder v barvách značky. */
export function EventVisual({ ev, className = "" }: { ev: DveEvent; className?: string }) {
  if (ev.image)
    return <img src={ev.image} alt={ev.title} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  return (
    <div className={`relative grid h-full w-full place-items-center overflow-hidden ${tones[ev.category]} ${className}`} role="img" aria-label={`Ilustrace: ${categoryLabels[ev.category]}`}>
      <img src={symbol} alt="" className="drift w-1/3 max-w-32 opacity-80" loading="lazy" />
      <span className="absolute bottom-3 right-4 text-xs font-medium text-cocoa/60">foto brzy doplníme</span>
    </div>
  );
}
