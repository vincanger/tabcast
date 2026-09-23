import { useRef } from "react";
import { Play } from "lucide-react";
import type { EpisodeDetail } from "../operations";
import { StatusBadge, formatDuration } from "./episode";
import { AudioPlayer, type AudioPlayerHandle } from "./AudioPlayer";
import { EpisodeCover } from "./EpisodeCover";
import { SourceIcon } from "./SourceIcon";
import { chaptersFor } from "../shared/chapters";

// One episode: cover, title line, player, sources with chapter jumps, and the
// transcript. The owner's page and the public /listen page both render this;
// what differs (the generating panel, the failure alert, the share control)
// comes in through `status` and `aside`.
export function EpisodeView({
  episode,
  status,
  aside,
}: {
  episode: EpisodeDetail;
  // Rendered between the header and the player: generation progress, errors.
  status?: React.ReactNode;
  // Rendered inside the header under the date line: the owner's share control.
  aside?: React.ReactNode;
}) {
  const playerRef = useRef<AudioPlayerHandle>(null);
  const sources = episode.articles.map((a) => a.url);
  const ready = episode.status === "ready" && !!episode.audioUrl;

  return (
    <article className="space-y-8">
      <header className="flex flex-wrap items-center gap-6 border-b pb-6">
        <EpisodeCover sources={sources} className="size-28" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-4xl leading-tight font-medium text-balance">{episode.title}</h1>
          <p className="kicker mt-3 flex flex-wrap items-center gap-2">
            <span>
              {new Date(episode.createdAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}{" "}
              · {episode.mode === "full" ? "read in full" : `target ${episode.targetMinutes} min`}
              {episode.durationSeconds ? ` · about ${formatDuration(episode.durationSeconds)}` : ""}
            </span>
            <StatusBadge status={episode.status} />
          </p>
          {aside}
        </div>
      </header>

      {status}

      {ready && (
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
          <AudioPlayer
            ref={playerRef}
            src={episode.audioUrl!}
            title={episode.title}
            chapters={chaptersFor(episode.articles)}
          />
        </div>
      )}

      <section>
        <h2 className="kicker border-b pb-2">Sources</h2>
        <ul className="divide-y">
          {episode.articles.map((a) => (
            <li key={a.id} className="flex items-start gap-4 py-3">
              <SourceIcon url={a.url} className="mt-0.5" />
              <div className="min-w-0">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="line-clamp-2 font-serif text-lg leading-snug hover:text-rubric"
                >
                  {a.title}
                </a>
                <p className="font-serif italic text-muted-foreground">
                  {a.siteName ?? new URL(a.url).hostname}
                </p>
              </div>
              {ready && a.startSeconds !== null && (
                <button
                  type="button"
                  onClick={() => playerRef.current?.seek(a.startSeconds!)}
                  aria-label={`Play from ${formatDuration(a.startSeconds)}`}
                  className="kicker ms-auto inline-flex shrink-0 items-center gap-1 py-1 tabular-nums hover:text-rubric"
                >
                  <Play className="size-3 fill-current" />
                  {formatDuration(a.startSeconds)}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {episode.script && (
        <section>
          <h2 className="kicker border-b pb-2">Transcript</h2>
          <div className="mt-4 space-y-4 font-serif text-[17px] leading-relaxed">
            {episode.script.split(/\n\s*\n/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
