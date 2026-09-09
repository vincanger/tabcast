import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";

// The phases generateEpisodeJob writes to the episode as it works.
const PHASES: string[] = ["reading", "writing", "recording"];

export function GenerationSteps({
  phase,
  startedAt,
  articleCount,
}: {
  phase: string | null;
  startedAt: Date;
  articleCount: number;
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
    <div className="rounded-2xl border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        <p className="font-medium">Building your episode</p>
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {Math.floor(elapsed / 1000)}s
        </span>
      </div>

      <ol className="space-y-3">
        {labels.map((label, i) => (
          <li key={label} className="flex items-center gap-3">
            {i < activeIndex ? (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
            ) : i === activeIndex ? (
              // The ring itself spins. A spinner glyph inside a bordered circle
              // reads as two rings stacked on each other.
              <span className="size-6 shrink-0 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
            ) : (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
                <span className="size-1.5 rounded-full bg-current opacity-50" />
              </span>
            )}
            <span
              className={cn("text-sm", i === activeIndex ? "text-foreground" : "text-muted-foreground")}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
