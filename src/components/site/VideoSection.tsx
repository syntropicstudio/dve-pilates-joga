import { Play } from "lucide-react";
import { useState } from "react";
import { site, youtubeId } from "@/config/site";

/** Malé ukázkové video pro kartu v sekci Online lekce. YouTube iframe se načte až po kliknutí (youtube-nocookie). */
export function SmallLessonVideo({ url, title }: { url: string | null; title: string }) {
  return <LessonVideo url={url} title={title} compact />;
}

function LessonVideo({ url, title = "Ukázková lekce DVĚ", compact = false }: { url: string | null; title?: string; compact?: boolean }) {
  const id = youtubeId(url);
  const [play, setPlay] = useState(false);
  return (
    <>
    <div className={`relative aspect-video w-full overflow-hidden bg-cocoa ${compact ? "rounded-2xl" : "rounded-3xl shadow-[var(--shadow-lift)]"}`}>
      {id && play ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : id ? (
        <button type="button" onClick={() => setPlay(true)} className="group absolute inset-0 grid place-items-center" aria-label={`Přehrát: ${title}`}>
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" loading="lazy" />
          <span className={`relative grid place-items-center rounded-full bg-sun text-cocoa transition-transform group-hover:scale-110 ${compact ? "h-14 w-14" : "h-20 w-20"}`}>
            <Play className={compact ? "ml-0.5 h-6 w-6" : "ml-1 h-8 w-8"} />
          </span>
        </button>
      ) : (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-cream">
          <div>
            <span className={`mx-auto grid place-items-center rounded-full bg-cream/15 ${compact ? "h-12 w-12" : "h-16 w-16"}`}><Play className={compact ? "ml-0.5 h-5 w-5" : "ml-1 h-7 w-7"} /></span>
            <p className={`mt-3 font-display ${compact ? "text-lg" : "text-2xl"}`}>Ukázkovou lekci právě připravujeme</p>
            {!compact && <p className="mt-2 text-cream/70">Video sem doplníme už brzy.</p>}
          </div>
        </div>
      )}
    </div>
    {!compact && url && (
      <a href={url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 font-semibold underline underline-offset-4">
        <Play className="h-4 w-4" /> Otevřít na YouTube
      </a>
    )}
    </>
  );
}
