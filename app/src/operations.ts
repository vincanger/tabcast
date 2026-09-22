import { HttpError } from "wasp/server";
import type {
  DeleteArticle,
  GenerateEpisode,
  GetEpisode,
  GetEpisodeLimit,
  GetEpisodes,
  GetFeed,
  GetSaveShortcut,
  GetSchedule,
  GetInbox,
  RotateFeedToken,
  RotateSaveToken,
  UpdateSchedule,
} from "wasp/server/operations";
import type { Article, Episode, GenerationSchedule } from "wasp/entities";
import { getSignedAudioUrl } from "./lib/s3";
import { feedUrl } from "./feed";
import { saveUrl } from "./apis";
import { newSecretToken } from "./lib/token";
import { episodeLimit, startEpisode } from "./episodes";
import { EVERY_DAYS_OPTIONS, TICK_MINUTES, firstRun } from "./lib/schedule";

import { MAX_MINUTES, MIN_MINUTES, type EpisodeRequest } from "./shared/constants";

export type InboxArticle = Pick<
  Article,
  "id" | "url" | "title" | "siteName" | "byline" | "wordCount" | "savedAt"
>;

export const getInbox: GetInbox<void, InboxArticle[]> = async (_args, context) => {
  if (!context.user) throw new HttpError(401);
  return context.entities.Article.findMany({
    where: { userId: context.user.id, episodeId: null },
    orderBy: { savedAt: "desc" },
    select: {
      id: true,
      url: true,
      title: true,
      siteName: true,
      byline: true,
      wordCount: true,
      savedAt: true,
    },
  });
};

export type EpisodeSummary = Pick<
  Episode,
  "id" | "status" | "phase" | "title" | "mode" | "targetMinutes" | "durationSeconds" | "createdAt" | "error"
> & { articleCount: number; sourceUrls: string[] };

export const getEpisodes: GetEpisodes<void, EpisodeSummary[]> = async (_args, context) => {
  if (!context.user) throw new HttpError(401);
  const episodes = await context.entities.Episode.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { articles: true } },
      // Just enough for the cover mosaic.
      articles: { select: { url: true }, orderBy: { savedAt: "asc" }, take: 4 },
    },
  });
  return episodes.map(({ _count, articles, ...e }) => ({
    id: e.id,
    status: e.status,
    phase: e.phase,
    title: e.title,
    mode: e.mode,
    targetMinutes: e.targetMinutes,
    durationSeconds: e.durationSeconds,
    createdAt: e.createdAt,
    error: e.error,
    articleCount: _count.articles,
    sourceUrls: articles.map((a) => a.url),
  }));
};

export type EpisodeDetail = Omit<Episode, "audioKey" | "userId"> & {
  audioUrl: string | null;
  articles: Pick<Article, "id" | "url" | "title" | "siteName" | "startSeconds">[];
};

export const getEpisode: GetEpisode<{ id: number }, EpisodeDetail> = async ({ id }, context) => {
  if (!context.user) throw new HttpError(401);
  const episode = await context.entities.Episode.findFirst({
    where: { id, userId: context.user.id },
    include: {
      articles: {
        select: { id: true, url: true, title: true, siteName: true, startSeconds: true },
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

export const generateEpisode: GenerateEpisode<EpisodeRequest, { episodeId: number }> = async (
  request,
  context,
) => {
  if (!context.user) throw new HttpError(401);
  if (request.mode === "summary" && !validMinutes(request.targetMinutes)) {
    throw new HttpError(400, `Target length must be between ${MIN_MINUTES} and ${MAX_MINUTES} minutes.`);
  }
  if (request.mode !== "summary" && request.mode !== "full") {
    throw new HttpError(400, "Unknown episode mode.");
  }
  return startEpisode(context.user.id, request, context.entities);
};

export const getEpisodeLimit: GetEpisodeLimit<void, { limit: number | null; used: number }> = async (
  _args,
  context,
) => {
  if (!context.user) throw new HttpError(401);
  return episodeLimit(context.user.id, context.entities.Episode);
};

function validMinutes(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_MINUTES && n <= MAX_MINUTES;
}

export const getFeed: GetFeed<void, { url: string | null }> = async (_args, context) => {
  if (!context.user) throw new HttpError(401);
  const user = await context.entities.User.findUnique({
    where: { id: context.user.id },
    select: { feedToken: true },
  });
  return { url: user?.feedToken ? feedUrl(user.feedToken) : null };
};

// Creates the feed on first use and replaces the token on every later call,
// which is how a user cuts off anyone they shared the link with.
export const rotateFeedToken: RotateFeedToken<void, { url: string }> = async (_args, context) => {
  if (!context.user) throw new HttpError(401);
  const token = newSecretToken();
  await context.entities.User.update({
    where: { id: context.user.id },
    data: { feedToken: token },
  });
  return { url: feedUrl(token) };
};

export const getSaveShortcut: GetSaveShortcut<void, { url: string | null }> = async (_args, context) => {
  if (!context.user) throw new HttpError(401);
  const user = await context.entities.User.findUnique({
    where: { id: context.user.id },
    select: { saveToken: true },
  });
  return { url: user?.saveToken ? saveUrl(user.saveToken) : null };
};

// Same lifecycle as the feed token: created on first use, replaced on every
// later call so a Shortcut on a lost phone stops working.
export const rotateSaveToken: RotateSaveToken<void, { url: string }> = async (_args, context) => {
  if (!context.user) throw new HttpError(401);
  const token = newSecretToken();
  await context.entities.User.update({
    where: { id: context.user.id },
    data: { saveToken: token },
  });
  return { url: saveUrl(token) };
};

export type ScheduleInput = Pick<
  GenerationSchedule,
  "enabled" | "everyDays" | "hourUtc" | "minuteUtc" | "minArticles" | "mode" | "targetMinutes"
>;

export const getSchedule: GetSchedule<void, GenerationSchedule | null> = async (_args, context) => {
  if (!context.user) throw new HttpError(401);
  return context.entities.GenerationSchedule.findUnique({ where: { userId: context.user.id } });
};

// Saving is a plain write. The half hourly job reads nextRunAt; turning the
// schedule off clears it, so nothing else needs to be told.
export const updateSchedule: UpdateSchedule<ScheduleInput, GenerationSchedule> = async (
  input,
  context,
) => {
  if (!context.user) throw new HttpError(401);

  const isInt = (n: number, lo: number, hi: number) => Number.isInteger(n) && n >= lo && n <= hi;
  if (!(EVERY_DAYS_OPTIONS as readonly number[]).includes(input.everyDays)) {
    throw new HttpError(400, "Frequency must be daily or weekly.");
  }
  if (!isInt(input.hourUtc, 0, 23)) throw new HttpError(400, "Hour must be between 0 and 23.");
  if (!(TICK_MINUTES as readonly number[]).includes(input.minuteUtc)) {
    throw new HttpError(400, "Minute must be 0 or 30.");
  }
  if (!isInt(input.minArticles, 1, 100)) throw new HttpError(400, "Minimum articles must be between 1 and 100.");
  if (input.mode !== "summary" && input.mode !== "full") throw new HttpError(400, "Unknown episode mode.");
  if (input.mode === "summary" && !validMinutes(input.targetMinutes)) {
    throw new HttpError(400, `Target length must be between ${MIN_MINUTES} and ${MAX_MINUTES} minutes.`);
  }

  const data = {
    enabled: input.enabled,
    everyDays: input.everyDays,
    hourUtc: input.hourUtc,
    minuteUtc: input.minuteUtc,
    minArticles: input.minArticles,
    mode: input.mode,
    targetMinutes: input.mode === "full" ? 0 : input.targetMinutes,
    nextRunAt: input.enabled ? firstRun(input.hourUtc, input.minuteUtc) : null,
  };
  return context.entities.GenerationSchedule.upsert({
    where: { userId: context.user.id },
    create: { userId: context.user.id, ...data },
    update: data,
  });
};
