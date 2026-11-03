import { Play } from "lucide-react";
import { useState } from "react";
import { site, youtubeId } from "@/config/site";

/** YouTube iframe se načte až po kliknutí (youtube-nocookie). */
export function FreeLessonVideo() {
  const id = youtubeId(site.youtubeUrl);
  const [play, setPlay] = useState(false);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-cocoa shadow-[var(--shadow-lift)]">
      {id && play ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title="Ukázková lekce DVĚ"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : id ? (
        <button type="button" onClick={() => setPlay(true)} className="group absolute inset-0 grid place-items-center" aria-label="Přehrát ukázkovou lekci">
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" loading="lazy" />
          <span className="relative grid h-20 w-20 place-items-center rounded-full bg-sun text-cocoa transition-transform group-hover:scale-110">
            <Play className="ml-1 h-8 w-8" />
          </span>
        </button>
      ) : (
        <div className="absolute inset-0 grid place-items-center p-8 text-center text-cream">
          <div>
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-cream/15"><Play className="ml-1 h-7 w-7" /></span>
            <p className="mt-4 font-display text-2xl">Ukázkovou lekci právě připravujeme</p>
            <p className="mt-2 text-cream/70">Video sem doplníme už brzy.</p>
          </div>
        </div>
      )}
    </div>
  );
}
