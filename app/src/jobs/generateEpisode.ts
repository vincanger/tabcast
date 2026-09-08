import type { GenerateEpisodeJob } from "wasp/server/jobs";
import { estimateDurationSeconds, narrate, writeScript } from "../lib/openai";
import { episodeAudioKey, uploadEpisodeAudio } from "../lib/s3";

type Input = { episodeId: number };

export const generateEpisodeJob: GenerateEpisodeJob<Input, void> = async ({ episodeId }, context) => {
  const { Episode, Article } = context.entities;

  const episode = await Episode.findUnique({
    where: { id: episodeId },
    include: { articles: { orderBy: { savedAt: "asc" } } },
  });
  if (!episode) {
    console.warn(`[generateEpisode] Episode ${episodeId} no longer exists.`);
    return;
  }
  if (episode.status !== "pending") {
    console.warn(`[generateEpisode] Episode ${episodeId} is ${episode.status}, skipping.`);
    return;
  }

  await Episode.update({ where: { id: episodeId }, data: { status: "generating" } });

  try {
    if (episode.articles.length === 0) throw new Error("Episode has no articles.");

    console.log(`[generateEpisode] Writing script for episode ${episodeId} (${episode.articles.length} articles, ${episode.targetMinutes} min).`);
    const { title, script } = await writeScript(episode.articles, episode.targetMinutes);

    console.log(`[generateEpisode] Narrating episode ${episodeId} (${script.length} chars).`);
    const audio = await narrate(script);

    const audioKey = episodeAudioKey(episode.userId, episodeId);
    await uploadEpisodeAudio(audioKey, audio);

    await Episode.update({
      where: { id: episodeId },
      data: {
        status: "ready",
        title,
        script,
        audioKey,
        durationSeconds: estimateDurationSeconds(script),
        completedAt: new Date(),
      },
    });
    console.log(`[generateEpisode] Episode ${episodeId} ready.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[generateEpisode] Episode ${episodeId} failed: ${message}`);
    // Return the articles to the inbox so the user can try again.
    await Article.updateMany({ where: { episodeId }, data: { episodeId: null } });
    await Episode.update({
      where: { id: episodeId },
      data: { status: "failed", error: message, completedAt: new Date() },
    });
  }
};
