import { useState } from "react";
import { Link } from "react-router";
import { Inbox, Sparkles, Trash2 } from "lucide-react";
import {
  deleteArticle,
  generateEpisode,
  getEpisodes,
  getInbox,
  useQuery,
} from "wasp/client/operations";
import { DEFAULT_MINUTES, MAX_MINUTES, MIN_MINUTES } from "../shared/constants";
import { isInFlight, pollWhileAnyInFlight } from "../components/episode";
import { GenerationSteps } from "../components/GenerationSteps";
import { SourceIcon } from "../components/SourceIcon";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Slider } from "../components/ui/slider";

export function InboxPage() {
  const inbox = useQuery(getInbox);
  const episodes = useQuery(getEpisodes, undefined, {
    // Poll while an episode is being generated so the progress updates.
    refetchInterval: pollWhileAnyInFlight,
  });

  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inFlight = episodes.data?.find((e) => isInFlight(e.status));
  const latestFailed = episodes.data?.[0]?.status === "failed" ? episodes.data[0] : null;
  const articles = inbox.data ?? [];
  const canGenerate = articles.length > 0 && !inFlight && !busy;

  async function onGenerate() {
    setError(null);
    setBusy(true);
    try {
      await generateEpisode({ targetMinutes: minutes });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    setError(null);
    try {
      await deleteArticle({ id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the article.");
    }
  }

  return (
    <div className="space-y-8">
      {inFlight ? (
        <div className="animate-in fade-in">
          <GenerationSteps
            phase={inFlight.phase}
            startedAt={inFlight.createdAt}
            articleCount={inFlight.articleCount}
          />
          <p className="mt-3 text-center text-sm text-muted-foreground">
            <Link to={`/episodes/${inFlight.id}`} className="hover:text-foreground">
              Open the episode page →
            </Link>
          </p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border bg-card p-6">
          {/* Warm glow behind the primary action. */}
          <div className="pointer-events-none absolute -top-24 -right-16 size-56 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex flex-wrap items-end gap-x-8 gap-y-6">
            <div>
              <p className="text-sm text-muted-foreground">Target length</p>
              <p className="flex items-baseline gap-1.5">
                <span className="text-5xl font-semibold tabular-nums">{minutes}</span>
                <span className="text-lg text-muted-foreground">min</span>
              </p>
            </div>
            <div className="min-w-48 flex-1 pb-3">
              <Slider
                aria-label="Target length in minutes"
                min={MIN_MINUTES}
                max={MAX_MINUTES}
                step={1}
                value={[minutes]}
                onValueChange={([value]) => setMinutes(value)}
              />
            </div>
            <Button size="lg" className="pb-0.5" disabled={!canGenerate} onClick={onGenerate}>
              <Sparkles className="size-4" />
              {busy
                ? "Starting…"
                : `Generate from ${articles.length} article${articles.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

      {latestFailed && !inFlight && (
        <Alert variant="destructive">
          <AlertDescription>
            The last episode failed: {latestFailed.error ?? "unknown error"}. Your articles are back
            in the inbox.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Inbox</h2>
        {inbox.isLoading && <Skeleton className="h-40 w-full rounded-2xl" />}
        {inbox.error && (
          <Alert variant="destructive">
            <AlertDescription>{inbox.error.message}</AlertDescription>
          </Alert>
        )}
        {!inbox.isLoading && articles.length === 0 && (
          <div className="rounded-2xl border border-dashed py-14 text-center">
            <Inbox className="mx-auto size-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="mt-3 font-medium">Nothing saved yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click the extension icon on any article to save it here.
            </p>
          </div>
        )}
        {articles.length > 0 && (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {articles.map((a, i) => (
              <li
                key={a.id}
                style={{ animationDelay: `${i * 45}ms` }}
                className="group flex animate-in items-center gap-4 px-4 py-3 fade-in slide-in-from-bottom-2 fill-mode-backwards hover:bg-muted/40"
              >
                <SourceIcon url={a.url} />
                <div className="min-w-0 flex-1">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block truncate font-medium hover:text-primary"
                  >
                    {a.title}
                  </a>
                  <div className="text-sm text-muted-foreground">
                    {a.siteName ?? new URL(a.url).hostname} · {a.wordCount.toLocaleString()} words ·{" "}
                    {formatDate(a.savedAt)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${a.title}`}
                  className="shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                  onClick={() => onDelete(a.id)}
                  disabled={!!inFlight}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
