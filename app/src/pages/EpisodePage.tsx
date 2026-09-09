import { Link, useParams } from "react-router";
import { getEpisode, useQuery } from "wasp/client/operations";
import { StatusBadge, formatDuration, isInFlight, pollWhileInFlight } from "../components/episode";
import { AudioPlayer } from "../components/AudioPlayer";
import { EpisodeCover } from "../components/EpisodeCover";
import { GenerationSteps } from "../components/GenerationSteps";
import { SourceIcon } from "../components/SourceIcon";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
  if (isLoading) return <Skeleton className="h-56 w-full rounded-2xl" />;
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }
  if (!episode) return null;

  const inFlight = isInFlight(episode.status);

  return (
    <article className="space-y-6">
      <p className="text-sm">
        <Link to="/episodes" className="text-muted-foreground hover:text-foreground">
          ← All episodes
        </Link>
      </p>

      <header className="flex flex-wrap items-center gap-5">
        <EpisodeCover
          seed={episode.title}
          sources={episode.articles.map((a) => a.url)}
          className="size-28 shadow-lg"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">{episode.title}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {new Date(episode.createdAt).toLocaleString()} · target {episode.targetMinutes} min
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
          <AlertDescription>
            Generation failed: {episode.error ?? "unknown error"}.
          </AlertDescription>
        </Alert>
      )}
      {episode.status === "ready" && episode.audioUrl && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <AudioPlayer src={episode.audioUrl} title={episode.title} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {episode.articles.map((a) => (
              <li key={a.id} className="flex items-center gap-3">
                <SourceIcon url={a.url} />
                <div className="min-w-0">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block truncate hover:text-primary"
                  >
                    {a.title}
                  </a>
                  <span className="text-sm text-muted-foreground">
                    {a.siteName ?? new URL(a.url).hostname}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {episode.script && (
        <Card>
          <CardHeader>
            <CardTitle>Script</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 leading-relaxed text-muted-foreground">
            {episode.script.split(/\n\s*\n/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </article>
  );
}
