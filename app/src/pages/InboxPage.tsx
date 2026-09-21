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
  FULL_READ,
  FULL_READ_MAX_MINUTES,
  MIN_MINUTES,
  estimateMinutes,
} from "../shared/constants";
import { isInFlight, pollWhileAnyInFlight } from "../components/episode";
import { GenerationSteps } from "../components/GenerationSteps";
import { SaveShortcutCard } from "../components/SaveShortcutCard";
import { ScheduleToggle } from "../components/ScheduleToggle";
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

  // The slider's last stop reads everything verbatim, so the length is the
  // inbox's, not the user's. Show the estimate where the target would be.
  const fullRead = minutes === FULL_READ;
  const fullMinutes = estimateMinutes(articles.reduce((n, a) => n + a.wordCount, 0));
  const overCap = fullRead && fullMinutes > FULL_READ_MAX_MINUTES;
  const canGenerate = articles.length > 0 && !inFlight && !busy && !overCap;

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

  return (
    <div className="space-y-10">
      {inFlight ? (
        <div className="motion-safe:animate-in motion-safe:fade-in">
          <GenerationSteps
            phase={inFlight.phase}
            startedAt={inFlight.createdAt}
            articleCount={inFlight.articleCount}
          />
          <p className="kicker mt-3 text-center">
            <Link to={`/episodes/`} className="inline-block py-1 hover:text-foreground">
              Open the episode page →
            </Link>
          </p>
        </div>
      ) : (
        <div className="border bg-secondary p-6">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-6">
            {/* Fixed width so the label and number can change without moving the row. */}
            <div className="w-64 shrink-0">
              <p className="kicker whitespace-nowrap">
                {fullRead ? "Read in full · estimated" : "Target length"}
              </p>
              <p className="flex items-baseline gap-1.5 font-serif">
                <span className={`text-6xl leading-none tabular-nums ${overCap ? "text-rubric" : ""}`}>
                  {fullRead ? fullMinutes : minutes}
                </span>
                <span className="text-xl text-muted-foreground">min</span>
              </p>
            </div>
            <div className="relative min-w-48 flex-1 pb-3">
              <Slider
                aria-label="Target length in minutes, or read in full at the end"
                min={MIN_MINUTES}
                max={FULL_READ}
                step={1}
                value={[minutes]}
                onValueChange={([value]) => setMinutes(value)}
              />
              <span className="kicker absolute top-full right-0 mt-1">Full</span>
            </div>
            <Button
              size="lg"
              className="kicker h-auto min-h-10 w-full py-2 text-center whitespace-normal text-primary-foreground sm:w-auto"
              disabled={!canGenerate} onClick={onGenerate}>
              {busy
                ? "Starting…"
                : fullRead
                  ? `Read ${articles.length} article${articles.length === 1 ? "" : "s"} in full`
                  : `Generate from ${articles.length} article${articles.length === 1 ? "" : "s"}`}
            </Button>
          </div>
          {overCap && (
            <p className="mt-4 text-sm text-rubric">
              A full read of everything here would run about {fullMinutes} minutes; the limit is{" "}
              {FULL_READ_MAX_MINUTES}. Remove some articles or pick a length.
            </p>
          )}
          <ScheduleToggle minutes={minutes} fullRead={fullRead} />
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
              Click the extension icon on any article, or share it from your iPhone, to save it
              here.
            </p>
          </div>
        )}
        {articles.length > 0 && (
          <ul className="divide-y">
            {articles.map((a, i) => (
              <li
                key={a.id}
                style={{ animationDelay: `${i * 45}ms` }}
                className="group flex items-center gap-4 py-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-backwards"
              >
                <SourceIcon url={a.url} />
                <div className="min-w-0 flex-1">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="line-clamp-2 font-serif text-lg leading-snug hover:text-rubric"
                  >
                    {a.title}
                  </a>
                  <p className="truncate font-serif italic text-muted-foreground">
                    {a.byline ? `By ${a.byline} · ` : ""}
                    {a.siteName ?? new URL(a.url).hostname}
                  </p>
                  <p className="kicker mt-0.5">
                    {a.wordCount.toLocaleString()} words · {formatDate(a.savedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${a.title}`}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
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

      <SaveShortcutCard />
    </div>
  );
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
