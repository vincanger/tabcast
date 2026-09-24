import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Link, routes } from "wasp/client/router";
import { cancelEpisode, deleteEpisode, getEpisode, setEpisodePublic, useQuery } from "wasp/client/operations";
import { isInFlight, pollWhileInFlight } from "../components/episode";
import { EpisodeView } from "../components/EpisodeView";
import { GenerationSteps } from "../components/GenerationSteps";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Skeleton } from "../components/ui/skeleton";

export function EpisodePage() {
  const { id } = useParams<{ id: string }>();
  const episodeId = Number(id);
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    if (!window.confirm("Delete this episode? Its articles go back to the inbox.")) return;
    setDeleting(true);
    try {
      await deleteEpisode({ id: episodeId });
      navigate(routes.EpisodesRoute.build());
    } catch {
      setDeleting(false);
      window.alert("Unable to delete the episode. Reload the page and try again.");
    }
  }

  const { data: episode, isLoading, error } = useQuery(
    getEpisode,
    { id: episodeId },
    {
      enabled: Number.isInteger(episodeId),
      refetchInterval: pollWhileInFlight,
      // Every fetch signs a fresh audio URL. Refetching when the window
      // regains focus would swap the <audio> src mid-play and stop it.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
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

  return (
    <div className="space-y-8">
      <p className="kicker flex items-center justify-between gap-4">
        <Link to="/episodes" className="inline-block py-1 hover:text-foreground">
          ← All episodes
        </Link>
        {!isInFlight(episode.status) && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="py-1 text-muted-foreground hover:text-destructive hover:cursor-pointer disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete episode"}
          </button>
        )}
      </p>
      <EpisodeView
        episode={episode}
        aside={episode.status === "ready" && <ShareControl id={episode.id} isPublic={episode.isPublic} />}
        status={
          <>
            {isInFlight(episode.status) && (
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
          </>
        }
      />
    </div>
  );
}

// Toggles the public link and shows it while it is on. The URL is built
// from the route so it survives a move to another domain.
function ShareControl({ id, isPublic }: { id: number; isPublic: boolean }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const path = routes.ListenRoute.build({ params: { id } });
  const url = `${window.location.origin}${path}`;

  async function toggle() {
    setBusy(true);
    try {
      await setEpisodePublic({ id, isPublic: !isPublic });
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <p className="kicker mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      {isPublic ? (
        <>
          <span className="text-rubric">Public</span>
          <a href={url} target="_blank" rel="noreferrer noopener" className="normal-case tracking-normal underline decoration-border underline-offset-4 hover:text-foreground">
            {url}
          </a>
          <button type="button" onClick={copy} className="py-1 hover:text-foreground hover:cursor-pointer">
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={toggle} disabled={busy} className="py-1 hover:text-foreground hover:cursor-pointer">
            Make private
          </button>
        </>
      ) : (
        <button type="button" onClick={toggle} disabled={busy} className="py-1 underline decoration-border underline-offset-4 hover:text-foreground hover:cursor-pointer">
          Share with a public link →
        </button>
      )}
    </p>
  );
}
