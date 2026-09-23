import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";

// The phases generateEpisodeJob writes to the episode as it works.
const PHASES: string[] = ["reading", "writing", "recording"];

// A normal run finishes inside this, so the way out only appears once
// something is probably wrong.
const CANCEL_AFTER_MS = 2 * 60_000;

export function GenerationSteps({
  phase,
  startedAt,
  articleCount,
  onCancel,
}: {
  phase: string | null;
  startedAt: Date;
  articleCount: number;
  onCancel?: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = now - new Date(startedAt).getTime();
  // Queued episodes have no phase yet, so they sit on the first step.
  const activeIndex = Math.max(0, PHASES.indexOf(phase ?? ""));

  const labels = [
    `Reading ${articleCount} article${articleCount === 1 ? "" : "s"}`,
    "Writing the script",
    "Recording the narration",
  ];

  return (
    <div className="border bg-secondary p-5">
      <div className="mb-4 flex items-center gap-3 border-b pb-3">
        <span className="kicker flex items-center gap-2 text-rubric">
          <span className="size-2 motion-safe:animate-pulse bg-rubric" />
          Live
        </span>
        <p className="font-serif text-lg">Building your episode</p>
        <span className="kicker ms-auto tabular-nums">{Math.floor(elapsed / 1000)}s</span>
      </div>

      <ol className="space-y-2 font-serif text-lg">
        {labels.map((label, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={label}
              className={cn(
                "flex items-baseline gap-3",
                active ? "text-rubric" : done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="w-5 tabular-nums">{i + 1}.</span>
              <span>{label}</span>
              {done && <Check className="size-4 self-center text-rubric" strokeWidth={1.5} />}
            </li>
          );
        })}
      </ol>

      {onCancel && elapsed > CANCEL_AFTER_MS && (
        <p className="mt-4 border-t pt-3 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in">
          Taking too long?{" "}
          <button
            type="button"
            onClick={onCancel}
            className="underline decoration-border underline-offset-4 hover:text-foreground hover:cursor-pointer"
          >
            Cancel and get your articles back
          </button>
          .
        </p>
      )}
    </div>
  );
}
