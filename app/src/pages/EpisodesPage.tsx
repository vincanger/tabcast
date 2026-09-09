import { Link } from "react-router";
import { Radio } from "lucide-react";
import { getEpisodes, useQuery } from "wasp/client/operations";
import { StatusBadge, formatDuration, pollWhileAnyInFlight } from "../components/episode";
import { EpisodeCover } from "../components/EpisodeCover";
import { PodcastFeedCard } from "../components/PodcastFeedCard";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Skeleton } from "../components/ui/skeleton";

export function EpisodesPage() {
  const { data: episodes, isLoading, error } = useQuery(getEpisodes, undefined, {
    refetchInterval: pollWhileAnyInFlight,
  });

  return (
    <section className="space-y-8">
      <div>
      <h2 className="mb-3 text-xl font-semibold tracking-tight">Episodes</h2>
      {isLoading && <Skeleton className="h-40 w-full rounded-2xl" />}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      {episodes && episodes.length === 0 && (
        <div className="rounded-2xl border border-dashed py-14 text-center">
          <Radio className="mx-auto size-8 text-muted-foreground" strokeWidth={1.5} />
          <p className="mt-3 font-medium">No episodes yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link to="/" className="text-primary hover:underline">
              Generate one from your inbox
            </Link>
            .
          </p>
        </div>
      )}
      {episodes && episodes.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {episodes.map((e, i) => (
            <li
              key={e.id}
              style={{ animationDelay: `${i * 45}ms` }}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards"
            >
              <Link
                to={`/episodes/${e.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40"
              >
                <EpisodeCover seed={e.title} sources={e.sourceUrls} className="size-12" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()} · {e.articleCount} article
                    {e.articleCount === 1 ? "" : "s"} · target {e.targetMinutes} min
                    {e.durationSeconds ? ` · ${formatDuration(e.durationSeconds)}` : ""}
                  </span>
                </div>
                <StatusBadge status={e.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      </div>
      <PodcastFeedCard />
    </section>
  );
}
