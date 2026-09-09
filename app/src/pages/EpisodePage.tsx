import { Link, useParams } from "react-router";
import { getEpisode, useQuery } from "wasp/client/operations";
import { StatusBadge, formatDuration, isInFlight, pollWhileInFlight } from "../components/episode";
import { AudioPlayer } from "../components/AudioPlayer";
import { EpisodeCover } from "../components/EpisodeCover";
import { GenerationSteps } from "../components/GenerationSteps";
import { SourceIcon } from "../components/SourceIcon";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Skeleton } from "../components/ui/skeleton";

export function EpisodePage() {
  const { id } = useParams<{ id: string }>();
  const episodeId = Number(id);

  const { data: episode, isLoading, error } = useQuery(
    getEpisode,
    { id: episodeId },
    { enabled: Number.isInteger(episodeId), refetchInterval: pollWhileInFlight },
  );

  if (!Number.isInteger(episodeId)) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Invalid episode id.</AlertDescription>
      </Alert>
    );
  }
  if (isLoading) return <Skeleton className="h-56 w-full" />;
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }
  if (!episode) return null;

  const inFlight = isInFlight(episode.status);
  const sources = episode.articles.map((a) => a.url);

  return (
    <article className="space-y-8">
      <p className="kicker">
        <Link to="/episodes" className="hover:text-foreground">
          ← All episodes
        </Link>
      </p>

      <header className="flex flex-wrap items-center gap-6 border-b pb-6">
        <EpisodeCover sources={sources} className="size-28" />
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-4xl leading-tight font-medium text-balance">{episode.title}</h2>
          <p className="kicker mt-3 flex flex-wrap items-center gap-2">
            <span>
              {new Date(episode.createdAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}{" "}
              · target {episode.targetMinutes} min
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
        />
      )}
      {episode.status === "failed" && (
        <Alert variant="destructive">
          <AlertDescription>Generation failed: {episode.error ?? "unknown error"}.</AlertDescription>
        </Alert>
      )}
      {episode.status === "ready" && episode.audioUrl && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <AudioPlayer src={episode.audioUrl} title={episode.title} />
        </div>
      )}

      <section>
        <h3 className="kicker border-b pb-2">Sources</h3>
        <ul className="divide-y">
          {episode.articles.map((a) => (
            <li key={a.id} className="flex items-center gap-4 py-3">
              <SourceIcon url={a.url} />
              <div className="min-w-0">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block truncate font-serif text-lg leading-snug hover:text-rubric"
                >
                  {a.title}
                </a>
                <p className="font-serif italic text-muted-foreground">
                  {a.siteName ?? new URL(a.url).hostname}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {episode.script && (
        <section>
          <h3 className="kicker border-b pb-2">Transcript</h3>
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
