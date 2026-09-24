import { Link } from "wasp/client/router";
import { getEpisodes, getFeed, useQuery } from "wasp/client/operations";
import { StatusBadge, formatDuration, pollWhileAnyInFlight } from "../components/episode";
import { EpisodeCover } from "../components/EpisodeCover";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Skeleton } from "../components/ui/skeleton";
import { useEnterOnce } from "../lib/enterOnce";
import { cn } from "../lib/utils";

export function EpisodesPage() {
  const { data: episodes, isLoading, error } = useQuery(getEpisodes, undefined, {
    refetchInterval: pollWhileAnyInFlight,
  });
  const enter = useEnterOnce("episodes");
  // Nudge toward the podcast feed until the user has set one up.
  const { data: feed } = useQuery(getFeed);
  const showFeedNudge = !!episodes?.length && feed !== undefined && !feed.url;

  return (
    <div className="space-y-10">
      <section>
        <h1 className="kicker border-b pb-2">Episodes</h1>
        {isLoading && <Skeleton className="mt-4 h-40 w-full" />}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>Unable to load episodes. Reload the page to try again.</AlertDescription>
          </Alert>
        )}
        {episodes && episodes.length === 0 && (
          <div className="mt-4 border px-6 py-12 text-center">
            <p className="font-serif text-xl">No episodes yet</p>
            <p className="mt-1 font-serif italic text-muted-foreground">
              <Link to="/inbox" className="text-rubric hover:underline">
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
                style={enter ? { animationDelay: `${i * 45}ms` } : undefined}
                className={cn(
                  enter &&
                    "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-backwards",
                )}
              >
                <Link to="/episodes/:id" params={{ id: e.publicId }} className="group flex items-start gap-4 py-4">
                  <EpisodeCover sources={e.sourceUrls} className="mt-0.5 size-14" />
                  <div className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-serif text-lg leading-snug group-hover:text-rubric">
                      {e.title}
                    </span>
                    <span className="kicker mt-1 block">
                      {new Date(e.createdAt).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}{" "}
                      · {e.articleCount} article{e.articleCount === 1 ? "" : "s"} ·{" "}
                      {e.mode === "full" ? "read in full" : `target ${e.targetMinutes} min`}
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

      {showFeedNudge && (
        <p className="border-t pt-6 text-center font-serif italic text-muted-foreground">
          Add your private feed to your favorite podcast app so new episodes arrive automatically.{" "}
          <Link to="/setup" className="not-italic text-rubric hover:underline">
            Set up your feed →
          </Link>
        </p>
      )}
    </div>
  );
}
