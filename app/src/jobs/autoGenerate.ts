import type { AutoGenerateJob } from "wasp/server/jobs";
import { startEpisode } from "../episodes";
import { nextRun } from "../lib/schedule";

// Runs on the hour and half hour. Finds every enabled schedule that is due,
// claims it by advancing nextRunAt, and starts an episode if the inbox has
// enough in it. When nothing is due this is one indexed query.
// No input: the schedule fires it with no args.
type Input = Record<string, never>;

export const autoGenerateJob: AutoGenerateJob<Input, void> = async (_args, context) => {
  const { GenerationSchedule, Article, Episode } = context.entities;
  const now = new Date();

  const due = await GenerationSchedule.findMany({
    // A minute of tolerance in case the tick lands a hair before the slot.
    where: { enabled: true, nextRunAt: { lte: new Date(now.getTime() + 60_000) } },
  });
  if (due.length === 0) return;

  for (const schedule of due) {
    // Claim by advancing nextRunAt, conditionally on nobody else having done
    // so, in case a slow tick overlaps the next one.
    const nextRunAt = nextRun(schedule.nextRunAt!, schedule.everyDays, now);
    const claimed = await GenerationSchedule.updateMany({
      where: { userId: schedule.userId, nextRunAt: schedule.nextRunAt },
      data: { nextRunAt, lastCheckedAt: now },
    });
    if (claimed.count === 0) continue;

    // One user's failure must not stop the loop for the rest.
    try {
      const count = await Article.count({ where: { userId: schedule.userId, episodeId: null } });
      if (count >= schedule.minArticles) {
        const request =
          schedule.mode === "full"
            ? ({ mode: "full" } as const)
            : ({ mode: "summary", targetMinutes: schedule.targetMinutes } as const);
        await startEpisode(schedule.userId, request, { Episode, Article });
        console.log(`[autoGenerate] user ${schedule.userId}: started episode from ${count} articles.`);
      } else {
        console.log(`[autoGenerate] user ${schedule.userId}: ${count} of ${schedule.minArticles} articles, skipping.`);
      }
    } catch (err) {
      // Includes 409 when a manual generation is already in flight.
      console.warn(`[autoGenerate] user ${schedule.userId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
};
