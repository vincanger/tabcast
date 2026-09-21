import { useState } from "react";
import { Link } from "react-router";
import { Trash2 } from "lucide-react";
import {
  deleteArticle,
  generateEpisode,
  getEpisodes,
  getInbox,
  useQuery,
} from "wasp/client/operations";
import {
  DEFAULT_MINUTES,
  FULL_READ_MAX_MINUTES,
  MAX_MINUTES,
  MIN_MINUTES,
  estimateMinutes,
  type EpisodeMode,
} from "../shared/constants";
import { isInFlight, pollWhileAnyInFlight } from "../components/episode";
import { GenerationSteps } from "../components/GenerationSteps";
import { InlineSelect } from "../components/InlineSelect";
import { useScheduleSentence } from "../components/ScheduleToggle";
import { SourceIcon } from "../components/SourceIcon";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { useEnterOnce } from "../lib/enterOnce";
import { cn } from "../lib/utils";

export function InboxPage() {
  const inbox = useQuery(getInbox);
  const episodes = useQuery(getEpisodes, undefined, {
    // Poll while an episode is being generated so the progress updates.
    refetchInterval: pollWhileAnyInFlight,
  });
  const enter = useEnterOnce("inbox");

  const [mode, setMode] = useState<EpisodeMode>("summary");
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inFlight = episodes.data?.find((e) => isInFlight(e.status));
  const latestFailed = episodes.data?.[0]?.status === "failed" ? episodes.data[0] : null;
  const articles = inbox.data ?? [];

  // A full read narrates every article verbatim, so its length is the inbox's,
  // not the user's. The sentence states the estimate instead of a target.
  const fullRead = mode === "full";
  const fullMinutes = estimateMinutes(articles.reduce((n, a) => n + a.wordCount, 0));
  const overCap = fullRead && fullMinutes > FULL_READ_MAX_MINUTES;
  const canGenerate = articles.length > 0 && !inFlight && !busy && !overCap;

  const schedule = useScheduleSentence({ minutes, fullRead });

  async function onGenerate() {
    setError(null);
    setBusy(true);
    try {
      await generateEpisode(fullRead ? { mode: "full" } : { mode: "summary", targetMinutes: minutes });
    } catch (e) {
      setError("Unable to start the episode. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    setError(null);
    try {
      await deleteArticle({ id });
    } catch (e) {
      setError("Unable to delete the article. Reload the page and try again.");
    }
  }

  const count = `${articles.length} article${articles.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-20">
      {inFlight ? (
        <div className="motion-safe:animate-in motion-safe:fade-in">
          <GenerationSteps
            phase={inFlight.phase}
            startedAt={inFlight.createdAt}
            articleCount={inFlight.articleCount}
          />
          <p className="kicker mt-3 text-center">
            <Link
              to={`/episodes/${inFlight.id}`}
              className="inline-block py-1 underline decoration-border underline-offset-4 hover:text-foreground"
            >
              Open the episode page →
            </Link>
          </p>
        </div>
      ) : (
        <section aria-label="Generate an episode">
          <p className="font-heading text-[28px] leading-[1.35] font-normal text-balance">
            Make a{" "}
            {!fullRead && (
              <>
                <InlineSelect label="Episode length" value={minutes} onChange={(v) => setMinutes(Number(v))}>
                  {Array.from({ length: MAX_MINUTES - MIN_MINUTES + 1 }, (_, i) => {
                    const m = MIN_MINUTES + i;
                    return (
                      <option key={m} value={m}>
                        {m} minute
                      </option>
                    );
                  })}
                </InlineSelect>{" "}
              </>
            )}
            <InlineSelect label="Episode kind" value={mode} onChange={(v) => setMode(v as EpisodeMode)}>
              <option value="summary">summary</option>
              <option value="full">full reading</option>
            </InlineSelect>{" "}
            {fullRead ? "of" : "from"} the {count} below
            {fullRead && articles.length > 0 && (
              <>
                {" "}
                (about{" "}
                <span className={cn("tabular-nums", overCap && "text-destructive")}>{fullMinutes} minutes</span>)
              </>
            )}
            {schedule.clause}.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Button
              size="lg"
              className="kicker h-auto min-h-10 bg-rubric py-2 text-center whitespace-normal text-background hover:bg-rubric/90"
              disabled={!canGenerate}
              onClick={onGenerate}
            >
              {busy ? "Starting…" : fullRead ? `Read ${count} in full` : `Generate from ${count}`}
            </Button>
            {schedule.actions}
          </div>

          {overCap && (
            <p className="mt-4 text-sm text-destructive">
              A full reading of everything here would run about {fullMinutes} minutes; the limit is{" "}
              {FULL_READ_MAX_MINUTES}. Remove some articles or switch to a summary.
            </p>
          )}
          {schedule.error && <p className="mt-4 text-sm text-destructive">{schedule.error}</p>}
        </section>
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
        <h1 className="kicker border-b pb-2">Inbox</h1>
        {inbox.isLoading && <Skeleton className="mt-4 h-40 w-full" />}
        {inbox.error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>Unable to load the inbox. Reload the page to try again.</AlertDescription>
          </Alert>
        )}
        {!inbox.isLoading && articles.length === 0 && (
          <div className="mt-4 border px-6 py-12 text-center">
            <p className="font-serif text-xl">Nothing saved yet</p>
            <p className="mt-1 font-serif italic text-muted-foreground">
              Articles arrive from the Chrome extension, or from your iPhone's share sheet.
            </p>
            <p className="kicker mt-4">
              <Link to="/setup" className="inline-block py-1 underline decoration-border underline-offset-4 hover:text-foreground">
                Set up the extension or your iPhone →
              </Link>
            </p>
          </div>
        )}
        {articles.length > 0 && (
          <ul className="divide-y border-b">
            {articles.map((a, i) => (
              <li
                key={a.id}
                style={enter ? { animationDelay: `${i * 45}ms` } : undefined}
                className={cn(
                  // A compact table row: favicon, title, words, date, delete.
                  // Below sm the words and date stack under the title.
                  "grid grid-cols-[24px_minmax(0,1fr)_36px] items-center gap-3 py-2",
                  enter &&
                    "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-backwards",
                )}
              >
                <SourceIcon url={a.url} className="size-6 rounded-sm" />
                <div className="grid min-w-0 gap-x-4 gap-y-0.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={a.title}
                    className="line-clamp-2 font-serif text-[19px] leading-snug hover:text-rubric sm:line-clamp-1"
                  >
                    {a.title}
                  </a>
                  <span className="kicker whitespace-nowrap">{a.wordCount.toLocaleString()} words</span>
                  <span className="kicker whitespace-nowrap">{formatDate(a.savedAt)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${a.title}`}
                  className="text-muted-foreground hover:text-destructive"
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
