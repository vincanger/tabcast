import { HttpError, env, type PrismaClient } from "wasp/server";
import { generateEpisodeJob } from "wasp/server/jobs";
import { FULL_READ_MAX_MINUTES, estimateMinutes, summaryMinutes, type EpisodeRequest } from "./shared/constants";

type Entities = { Episode: PrismaClient["episode"]; Article: PrismaClient["article"] };

// An episode still in flight after this long is treated as dead. The job's
// own expiry (see main.wasp.ts) is the same number, so by now pg-boss has
// given up on it too. A healthy run is minutes.
export const STALE_MINUTES = 30;

// Shared by the Generate button and the automatic schedule, so the two cannot
// drift: same guards, same cap, same linking, same job.
export async function startEpisode(
  userId: number,
  request: EpisodeRequest,
  { Episode, Article }: Entities,
): Promise<{ episodeId: number }> {
  const inFlight = await Episode.findFirst({
    where: { userId, status: { in: ["pending", "generating"] } },
  });
  if (inFlight) {
    // A worker can die mid-run and leave the row in flight forever. Rather
    // than block this account until someone notices, fail the corpse and
    // carry on. Anything younger is assumed to still be working.
    const age = Date.now() - inFlight.createdAt.getTime();
    if (age < STALE_MINUTES * 60_000) throw new HttpError(409, "An episode is already being generated.");
    console.warn(`[startEpisode] Episode ${inFlight.id} stuck for ${Math.round(age / 60_000)} min, failing it.`);
    await failEpisode(inFlight.id, "Generation did not finish. Try again.", { Episode, Article });
  }

  const limit = await episodeLimit(userId, Episode);
  if (limit.limit !== null && limit.used >= limit.limit) {
    throw new HttpError(403, `This instance allows ${limit.limit} episodes per account.`);
  }

  const unused = await Article.findMany({
    where: { userId, episodeId: null },
    select: { id: true, wordCount: true },
  });
  if (unused.length === 0) throw new HttpError(400, "Save some articles first.");

  // A full read is as long as the inbox. Refuse past the cap rather than
  // narrate three hours of text at per character prices.
  const words = unused.reduce((n, a) => n + a.wordCount, 0);
  let targetMinutes: number;
  if (request.mode === "full") {
    targetMinutes = estimateMinutes(words);
    if (targetMinutes > FULL_READ_MAX_MINUTES) {
      throw new HttpError(
        400,
        `Reading these in full would take about ${targetMinutes} minutes; the limit is ${FULL_READ_MAX_MINUTES}. Remove some articles or generate a summary.`,
      );
    }
  } else {
    // The request carries a budget. Clamp it here rather than in the client
    // so the schedule, whose budget was saved against a different inbox,
    // gets the same treatment.
    targetMinutes = summaryMinutes(request.targetMinutes, words);
  }

  const episode = await Episode.create({
    data: { userId, mode: request.mode, targetMinutes, status: "pending" },
  });
  await Article.updateMany({
    where: { id: { in: unused.map((a) => a.id) } },
    data: { episodeId: episode.id },
  });

  await generateEpisodeJob.submit({ episodeId: episode.id });
  return { episodeId: episode.id };
}

// Marks an in-flight episode failed and returns its articles to the inbox.
// Used by the cancel button, the stale sweep above, and the job's own error
// path. Only touches a row that is still in flight, so a job finishing at
// the same moment cannot be undone; returns whether anything changed.
export async function failEpisode(
  episodeId: number,
  reason: string,
  { Episode, Article }: Entities,
): Promise<boolean> {
  const { count } = await Episode.updateMany({
    where: { id: episodeId, status: { in: ["pending", "generating"] } },
    data: { status: "failed", phase: null, error: reason, completedAt: new Date() },
  });
  if (count === 0) return false;
  await Article.updateMany({ where: { episodeId }, data: { episodeId: null, startSeconds: null } });
  return true;
}

// How many episodes the account may still make. `limit` is null when the
// instance has no cap. Failed episodes are not held against anyone.
export async function episodeLimit(
  userId: number,
  Episode: PrismaClient["episode"],
): Promise<{ limit: number | null; used: number }> {
  if (env.EPISODES_PER_USER === 0) return { limit: null, used: 0 };
  const used = await Episode.count({ where: { userId, status: { not: "failed" } } });
  return { limit: env.EPISODES_PER_USER, used };
}
