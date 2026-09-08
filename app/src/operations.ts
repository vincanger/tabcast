import { HttpError } from "wasp/server";
import type {
  DeleteArticle,
  GenerateEpisode,
  GetEpisode,
  GetEpisodes,
  GetInbox,
} from "wasp/server/operations";
import type { Article, Episode } from "wasp/entities";
import { generateEpisodeJob } from "wasp/server/jobs";
import { getSignedAudioUrl } from "./lib/s3";

import { MAX_MINUTES, MIN_MINUTES } from "./shared/constants";

export type InboxArticle = Pick<
  Article,
  "id" | "url" | "title" | "siteName" | "wordCount" | "savedAt"
>;

export const getInbox: GetInbox<void, InboxArticle[]> = async (_args, context) => {
  if (!context.user) throw new HttpError(401);
  return context.entities.Article.findMany({
    where: { userId: context.user.id, episodeId: null },
    orderBy: { savedAt: "desc" },
    select: { id: true, url: true, title: true, siteName: true, wordCount: true, savedAt: true },
  });
};

export type EpisodeSummary = Pick<
  Episode,
  "id" | "status" | "title" | "targetMinutes" | "durationSeconds" | "createdAt" | "error"
> & { articleCount: number };

export const getEpisodes: GetEpisodes<void, EpisodeSummary[]> = async (_args, context) => {
  if (!context.user) throw new HttpError(401);
  const episodes = await context.entities.Episode.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { articles: true } } },
  });
  return episodes.map(({ _count, ...e }) => ({
    id: e.id,
    status: e.status,
    title: e.title,
    targetMinutes: e.targetMinutes,
    durationSeconds: e.durationSeconds,
    createdAt: e.createdAt,
    error: e.error,
    articleCount: _count.articles,
  }));
};

export type EpisodeDetail = Omit<Episode, "audioKey" | "userId"> & {
  audioUrl: string | null;
  articles: Pick<Article, "id" | "url" | "title" | "siteName">[];
};

export const getEpisode: GetEpisode<{ id: number }, EpisodeDetail> = async ({ id }, context) => {
  if (!context.user) throw new HttpError(401);
  const episode = await context.entities.Episode.findFirst({
    where: { id, userId: context.user.id },
    include: {
      articles: {
        select: { id: true, url: true, title: true, siteName: true },
        orderBy: { savedAt: "asc" },
      },
    },
  });
  if (!episode) throw new HttpError(404, "Episode not found.");

  const { audioKey, userId: _userId, ...rest } = episode;
  const audioUrl = audioKey ? await getSignedAudioUrl(audioKey) : null;
  return { ...rest, audioUrl };
};

export const deleteArticle: DeleteArticle<{ id: number }, void> = async ({ id }, context) => {
  if (!context.user) throw new HttpError(401);
  const article = await context.entities.Article.findFirst({
    where: { id, userId: context.user.id },
  });
  if (!article) throw new HttpError(404, "Article not found.");
  if (article.episodeId !== null) {
    throw new HttpError(400, "This article is already part of an episode.");
  }
  await context.entities.Article.delete({ where: { id } });
};

export const generateEpisode: GenerateEpisode<{ targetMinutes: number }, { episodeId: number }> =
  async ({ targetMinutes }, context) => {
    if (!context.user) throw new HttpError(401);
    if (
      !Number.isInteger(targetMinutes) ||
      targetMinutes < MIN_MINUTES ||
      targetMinutes > MAX_MINUTES
    ) {
      throw new HttpError(400, `Target length must be between ${MIN_MINUTES} and ${MAX_MINUTES} minutes.`);
    }

    const userId = context.user.id;

    const inFlight = await context.entities.Episode.findFirst({
      where: { userId, status: { in: ["pending", "generating"] } },
    });
    if (inFlight) throw new HttpError(409, "An episode is already being generated.");

    const unused = await context.entities.Article.findMany({
      where: { userId, episodeId: null },
      select: { id: true },
    });
    if (unused.length === 0) throw new HttpError(400, "Save some articles first.");

    const episode = await context.entities.Episode.create({
      data: { userId, targetMinutes, status: "pending" },
    });
    await context.entities.Article.updateMany({
      where: { id: { in: unused.map((a) => a.id) } },
      data: { episodeId: episode.id },
    });

    await generateEpisodeJob.submit({ episodeId: episode.id });
    return { episodeId: episode.id };
  };
