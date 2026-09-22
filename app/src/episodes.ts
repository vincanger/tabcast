import { HttpError, env, type PrismaClient } from "wasp/server";
import { generateEpisodeJob } from "wasp/server/jobs";
import { FULL_READ_MAX_MINUTES, estimateMinutes, summaryMinutes, type EpisodeRequest } from "./shared/constants";

type Entities = { Episode: PrismaClient["episode"]; Article: PrismaClient["article"] };

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
  if (inFlight) throw new HttpError(409, "An episode is already being generated.");

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
