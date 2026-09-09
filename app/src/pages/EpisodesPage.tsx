import { Link } from "react-router";
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
    <div className="space-y-10">
      <section>
        <h2 className="kicker border-b pb-2">Episodes</h2>
        {isLoading && <Skeleton className="mt-4 h-40 w-full" />}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        {episodes && episodes.length === 0 && (
          <div className="mt-4 border px-6 py-12 text-center">
            <p className="font-serif text-xl">No episodes yet</p>
            <p className="mt-1 font-serif italic text-muted-foreground">
              <Link to="/" className="text-rubric hover:underline">
                Generate one from your inbox
              </Link>
              .
            </p>
          </div>
        )}
        {episodes && episodes.length > 0 && (
          <ul className="divide-y">
            {episodes.map((e, i) => (
              <li
                key={e.id}
                style={{ animationDelay: `${i * 45}ms` }}
                className="animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards"
              >
                <Link to={`/episodes/${e.id}`} className="group flex items-center gap-4 py-4">
                  <EpisodeCover sources={e.sourceUrls} className="size-14" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-lg leading-snug group-hover:text-rubric">
                      {e.title}
                    </span>
                    <span className="kicker mt-1 block">
                      {new Date(e.createdAt).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}{" "}
                      · {e.articleCount} article{e.articleCount === 1 ? "" : "s"} · target{" "}
                      {e.targetMinutes} min
                      {e.durationSeconds ? ` · ${formatDuration(e.durationSeconds)}` : ""}
                    </span>
                  </div>
                  <StatusBadge status={e.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <PodcastFeedCard />
    </div>
  );
}
