import type { GenerateEpisodeJob } from "wasp/server/jobs";
import { estimateDurationSeconds, narrate, scriptText, writeFullScript, writeScript } from "../lib/openai";
import { mp3DurationSeconds } from "../lib/mp3";
import { withChapterTags } from "../lib/id3";
import { episodeAudioKey, uploadEpisodeAudio } from "../lib/s3";
import { failEpisode } from "../episodes";
import { ARTICLE_ORDER } from "../lib/articleOrder";

type Input = { episodeId: number };

export const generateEpisodeJob: GenerateEpisodeJob<Input, void> = async ({ episodeId }, context) => {
  const { Episode, Article } = context.entities;

  const episode = await Episode.findUnique({
    where: { id: episodeId },
    include: { articles: { orderBy: ARTICLE_ORDER } },
  });
  if (!episode) {
    console.warn(`[generateEpisode] Episode ${episodeId} no longer exists.`);
    return;
  }
  // "generating" here means an earlier attempt died with its worker (a deploy
  // or a stopped machine) and pg-boss has retried the job. Every step below
  // is safe to repeat, so start over from the script.
  if (episode.status !== "pending" && episode.status !== "generating") {
    console.warn(`[generateEpisode] Episode ${episodeId} is ${episode.status}, skipping.`);
    return;
  }
  if (episode.status === "generating") {
    console.warn(`[generateEpisode] Episode ${episodeId} was left generating, starting over.`);
  }

  await Episode.update({
    where: { id: episodeId },
    data: { status: "generating", phase: "reading" },
  });

  try {
    if (episode.articles.length === 0) throw new Error("Episode has no articles.");

    console.log(`[generateEpisode] Writing script for episode ${episodeId} (${episode.articles.length} articles, ${episode.mode === "full" ? "in full" : `${episode.targetMinutes} min`}).`);
    await Episode.update({ where: { id: episodeId }, data: { phase: "writing" } });
    const script =
      episode.mode === "full"
        ? await writeFullScript(episode.articles)
        : await writeScript(episode.articles, episode.targetMinutes);
    const text = scriptText(script);

    console.log(`[generateEpisode] Narrating episode ${episodeId} (${text.length} chars).`);
    await Episode.update({ where: { id: episodeId }, data: { phase: "recording" } });

    // Narrate the intro, each article's segment, and the sign off separately so
    // each part can be measured. The total before an article is where its
    // chapter starts.
    const parts = [script.intro, ...script.segments, script.outro];
    const buffers: Buffer[] = [];
    const seconds: number[] = [];
    for (const part of parts) {
      const audio = await narrate(part);
      buffers.push(audio);
      seconds.push(mp3DurationSeconds(audio) ?? 0);
    }
    const measured = seconds.reduce((a, b) => a + b, 0);
    // The word count estimate is only a fallback for audio we could not read.
    const durationSeconds = measured > 0 ? Math.round(measured) : estimateDurationSeconds(text);

    // Chapter marks travel inside the file too. Apple Podcasts reads those from
    // the MP3 itself, which works for a private feed it fetches directly.
    const audio = withChapterTags(Buffer.concat(buffers), {
      title: script.title,
      parts: parts.map((part, i) => ({
        title: i === 0 ? "Introduction" : i <= episode.articles.length ? episode.articles[i - 1].title : "Sign off",
        seconds: seconds[i],
        empty: !part.trim(),
      })),
    });

    const audioKey = episodeAudioKey(episode.userId, episodeId);
    await uploadEpisodeAudio(audioKey, audio);

    // Segments are written one per article, so the parts line up. An article
    // whose segment came back empty has no chapter of its own.
    let at = seconds[0];
    for (let i = 0; i < episode.articles.length; i++) {
      if (script.segments[i].trim()) {
        await Article.update({
          where: { id: episode.articles[i].id },
          data: { startSeconds: Math.round(at) },
        });
      } else {
        console.warn(`[generateEpisode] Episode ${episodeId}: article ${episode.articles[i].id} got no narration.`);
      }
      at += seconds[i + 1];
    }

    // The user may have cancelled while this ran. Only a row still in flight
    // becomes ready; a cancelled one keeps its failed state and its articles
    // are already back in the inbox, so the finished audio is simply dropped.
    const { count } = await Episode.updateMany({
      where: { id: episodeId, status: "generating" },
      data: {
        status: "ready",
        phase: null,
        title: script.title,
        script: text,
        audioKey,
        audioBytes: audio.length,
        durationSeconds,
        completedAt: new Date(),
      },
    });
    if (count === 0) {
      console.warn(`[generateEpisode] Episode ${episodeId} was cancelled before it finished.`);
      return;
    }
    console.log(`[generateEpisode] Episode ${episodeId} ready (${durationSeconds}s).`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[generateEpisode] Episode ${episodeId} failed: ${message}`);
    // Return the articles to the inbox so the user can try again. A no-op if
    // the user already cancelled.
    await failEpisode(episodeId, message, { Episode, Article });
  }
};
