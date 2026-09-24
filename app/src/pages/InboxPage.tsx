import { useState } from "react";
import { Link } from "wasp/client/router";
import { GripVertical, Trash2 } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  cancelEpisode,
  deleteArticle,
  generateEpisode,
  getEpisodeLimit,
  getEpisodes,
  getInbox,
  reorderInbox,
  useQuery,
} from "wasp/client/operations";
import {
  DEFAULT_MINUTES,
  FULL_READ_MAX_MINUTES,
  MINUTE_OPTIONS,
  MIN_MINUTES_PER_ARTICLE,
  estimateMinutes,
  summaryMinutes,
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
import type { InboxArticle } from "../operations";

export function InboxPage() {
  const inbox = useQuery(getInbox);
  const episodes = useQuery(getEpisodes, undefined, {
    // Poll while an episode is being generated so the progress updates.
    refetchInterval: pollWhileAnyInFlight,
  });
  const enter = useEnterOnce("inbox");
  // Null limit means this instance has no cap; the hosted demo has one. The
  // running count lives in the header; here it only gates the button.
  const { data: quota } = useQuery(getEpisodeLimit);
  const capped = !!quota?.limit && quota.used >= quota.limit;

  const [mode, setMode] = useState<EpisodeMode>("summary");
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inFlight = episodes.data?.find((e) => isInFlight(e.status));
  const latestFailed = episodes.data?.[0]?.status === "failed" ? episodes.data[0] : null;
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);
  const loaded = inbox.data ?? [];
  const articles = pendingOrder
    ? [...loaded].sort((a, b) => pendingOrder.indexOf(a.id) - pendingOrder.indexOf(b.id))
    : loaded;

  // A full read narrates every article verbatim, so its length is the inbox's,
  // not the user's. The sentence states the estimate instead of a target.
  const fullRead = mode === "full";
  const words = articles.reduce((n, a) => n + a.wordCount, 0);
  const fullMinutes = estimateMinutes(words);
  const overCap = fullRead && fullMinutes > FULL_READ_MAX_MINUTES;
  const canGenerate = articles.length > 0 && !inFlight && !busy && !overCap && !capped;

  // The summary number is a budget. What it will actually run to is the
  // server's arithmetic, repeated here so the sentence can say how much of
  // that each article gets.
  const summaryLength = summaryMinutes(minutes, words);
  const perArticle = articles.length > 0 ? summaryLength / articles.length : 0;
  // Nudge only when the budget is what squeezes the articles. If they are
  // that short on their own, a longer budget changes nothing and saying so
  // would be wrong.
  const tooThin =
    !fullRead && articles.length > 1 && minutes < fullMinutes && perArticle < MIN_MINUTES_PER_ARTICLE;

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

  async function onCancel(id: number) {
    setError(null);
    try {
      await cancelEpisode({ id });
    } catch (e) {
      setError("Unable to cancel the episode. Reload the page and try again.");
    }
  }

  // Drag and drop reorders the list. The new order shows at once from local
  // state and is sent whole; once the server has it the inbox query refreshes
  // and the local copy is dropped.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = articles.map((a) => a.id);
    const next = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    setPendingOrder(next);
    setError(null);
    try {
      await reorderInbox({ ids: next });
    } catch (e) {
      setError("Unable to reorder. Reload the page and try again.");
    } finally {
      setPendingOrder(null);
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
            onCancel={() => onCancel(inFlight.id)}
          />
          <p className="kicker mt-3 text-center">
            <Link
              to="/episodes/:id"
              params={{ id: inFlight.publicId }}
              className="inline-block py-1 underline decoration-border underline-offset-4 hover:text-foreground"
            >
              Open the episode page →
            </Link>
          </p>
        </div>
      ) : capped ? (
        <DeployPitch limit={quota!.limit!} />
      ) : !inbox.isLoading && articles.length === 0 ? (
        <GetSetUp />
      ) : (
        <section aria-label="Generate an episode">
          <p className="font-heading text-[28px] leading-[1.35] font-normal text-balance">
            Make a{" "}
            <InlineSelect label="Episode kind" value={mode} onChange={(v) => setMode(v as EpisodeMode)}>
              <option value="summary">summary</option>
              <option value="full">full reading</option>
            </InlineSelect>{" "}
            {fullRead ? (
              <>
                of the {count} below
                {articles.length > 0 && (
                  <>
                    {" "}
                    (about{" "}
                    <span className={cn("tabular-nums", overCap && "text-destructive")}>{fullMinutes} minutes</span>)
                  </>
                )}
              </>
            ) : (
              <>
                of up to{" "}
                <InlineSelect label="Length budget" value={minutes} onChange={(v) => setMinutes(Number(v))}>
                  {MINUTE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </InlineSelect>{" "}
                from the {count} below
                {articles.length > 0 && (
                  <>
                    , <span className={cn("tabular-nums", tooThin && "text-destructive")}>{perArticleLabel(perArticle)}</span>
                    {articles.length > 1 && " each"}
                  </>
                )}
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
          {tooThin && (
            <p className="mt-4 text-sm text-destructive">
              That is under a minute per article, room for a mention and not much else. Pick a longer
              budget or remove some articles.
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
        <h1 className="kicker flex items-baseline justify-between border-b pb-2">
          Inbox
          {articles.length > 1 && <span className="text-muted-foreground">Drag to set the reading order</span>}
        </h1>
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
          </div>
        )}
        {articles.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={articles.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y border-b">
                {articles.map((a, i) => (
                  <InboxRow
                    key={a.id}
                    article={a}
                    index={i}
                    enter={enter}
                    sortable={articles.length > 1 && !inFlight}
                    onDelete={() => onDelete(a.id)}
                    deleteDisabled={!!inFlight}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>
    </div>
  );
}

const DEPLOY_URL = "https://github.com/vincanger/tabcast#deploying";

// Takes the place of the generate sentence while the inbox is empty. There
// is nothing to generate from yet, so the one thing to do is get the
// extension or the iPhone shortcut set up.
function GetSetUp() {
  return (
    <section aria-label="Get set up">
      <p className="font-heading text-[28px] leading-[1.35] font-normal text-balance">
        Save an article and it lands here. Episodes are made from whatever is in the inbox.
      </p>
      <p className="mt-5">
        <Link
          to="/setup"
          className="kicker inline-block py-1 underline decoration-border underline-offset-4 hover:text-rubric"
        >
          Get set up to start saving articles →
        </Link>
      </p>
    </section>
  );
}

// Shown in place of the generate sentence once a demo account has used its
// episodes. This is the moment the demo exists for, so it reads like the
// rest of the page and not like an error.
function DeployPitch({ limit }: { limit: number }) {
  return (
    <section aria-label="Deploy your own">
      <p className="font-heading text-[28px] leading-[1.35] font-normal text-balance">
        That's the {limit} episode{limit === 1 ? "" : "s"} this demo allows. Your own Tabcast has no
        limit, runs on your own OpenAI key, and takes about ten minutes to put on Fly.
      </p>
      <p className="mt-5">
        <a
          href={DEPLOY_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="kicker inline-block py-1 underline decoration-border underline-offset-4 hover:text-rubric"
        >
          Deploy your own →
        </a>
      </p>
      <p className="mt-6 font-serif italic text-muted-foreground">
        Your episodes stay playable here and in your podcast app.
      </p>
    </section>
  );
}

// One inbox row. The grip at the front is the only drag handle, so the title
// stays a plain link and the delete button a plain button. While a row is
// being dragged it goes translucent and the others slide out of its way.
function InboxRow({
  article: a,
  index,
  enter,
  sortable,
  onDelete,
  deleteDisabled,
}: {
  article: InboxArticle;
  index: number;
  enter: boolean;
  sortable: boolean;
  onDelete: () => void;
  deleteDisabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: a.id,
    disabled: !sortable,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(enter && !transform ? { animationDelay: `${index * 45}ms` } : {}),
      }}
      className={cn(
        // A compact table row: grip, favicon, title, words, date, delete.
        // Below sm the words and date stack under the title.
        "grid grid-cols-[16px_24px_minmax(0,1fr)_36px] items-center gap-3 bg-background py-2",
        isDragging && "relative z-10 opacity-60",
        enter &&
          !isDragging &&
          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-backwards",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Drag to reorder ${a.title}`}
        className={cn(
          "flex h-8 w-4 items-center justify-center text-muted-foreground/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          sortable ? "cursor-grab active:cursor-grabbing" : "invisible",
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
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
        onClick={onDelete}
        disabled={deleteDisabled}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}

// "about 4 minutes", "about a minute", "under a minute".
function perArticleLabel(minutes: number): string {
  if (minutes < 1) return "under a minute";
  const n = Math.round(minutes);
  return n === 1 ? "about a minute" : `about ${n} minutes`;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
