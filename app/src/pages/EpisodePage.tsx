import { useRef } from "react";
import { useParams } from "react-router";
import { Link } from "wasp/client/router";
import { Play } from "lucide-react";
import { cancelEpisode, getEpisode, useQuery } from "wasp/client/operations";
import { StatusBadge, formatDuration, isInFlight, pollWhileInFlight } from "../components/episode";
import { AudioPlayer, type AudioPlayerHandle } from "../components/AudioPlayer";
import { EpisodeCover } from "../components/EpisodeCover";
import { GenerationSteps } from "../components/GenerationSteps";
import { SourceIcon } from "../components/SourceIcon";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Skeleton } from "../components/ui/skeleton";
import { chaptersFor } from "../shared/chapters";

export function EpisodePage() {
  const { id } = useParams<{ id: string }>();
  const episodeId = Number(id);
  const playerRef = useRef<AudioPlayerHandle>(null);

  const { data: episode, isLoading, error } = useQuery(
    getEpisode,
    { id: episodeId },
    { enabled: Number.isInteger(episodeId), refetchInterval: pollWhileInFlight },
  );

  if (!Number.isInteger(episodeId)) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          This episode does not exist. <Link to="/episodes">Go to all episodes</Link>.
        </AlertDescription>
      </Alert>
    );
  }
  if (isLoading) return <Skeleton className="h-56 w-full" />;
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Unable to load this episode. Reload the page, or{" "}
          <Link to="/episodes">go to all episodes</Link>.
        </AlertDescription>
      </Alert>
    );
  }
  if (!episode) return null;

  const inFlight = isInFlight(episode.status);
  const sources = episode.articles.map((a) => a.url);
  const ready = episode.status === "ready" && !!episode.audioUrl;

  return (
    <article className="space-y-8">
      <p className="kicker">
        <Link to="/episodes" className="inline-block py-1 hover:text-foreground">
          ← All episodes
        </Link>
      </p>

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
        </div>
      </header>

      {inFlight && (
        <GenerationSteps
          phase={episode.phase}
          startedAt={episode.createdAt}
          articleCount={episode.articles.length}
          // A failed cancel just leaves the panel up; the query keeps polling.
          onCancel={() => void cancelEpisode({ id: episode.id }).catch(() => {})}
        />
      )}
      {episode.status === "failed" && (
        <Alert variant="destructive">
          <AlertDescription>
            Generation failed: {episode.error ?? "unknown error"}. Your articles are back in the{" "}
            <Link to="/inbox">inbox</Link>, so you can generate the episode again.
          </AlertDescription>
        </Alert>
      )}
      {episode.status === "ready" && episode.audioUrl && (
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
          <AudioPlayer
            ref={playerRef}
            src={episode.audioUrl}
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
