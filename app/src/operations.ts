import { HttpError, env } from "wasp/server";
import type {
  CancelEpisode,
  DeleteArticle,
  DeleteEpisode,
  GenerateEpisode,
  GetEpisode,
  GetEpisodeLimit,
  GetFeaturedEpisode,
  GetPublicEpisode,
  GetEpisodes,
  GetFeed,
  GetSaveShortcut,
  GetSchedule,
  GetInbox,
  RotateFeedToken,
  ReorderInbox,
  RotateSaveToken,
  SetEpisodePublic,
  UpdateSchedule,
} from "wasp/server/operations";
import type { Article, Episode, GenerationSchedule } from "wasp/entities";
import { deleteEpisodeAudio, getSignedAudioUrl } from "./lib/s3";
import { feedUrl } from "./feed";
import { saveUrl } from "./apis";
import { newSecretToken } from "./lib/token";
import { episodeLimit, failEpisode, startEpisode } from "./episodes";
import { ARTICLE_ORDER } from "./lib/articleOrder";
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
    orderBy: ARTICLE_ORDER,
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
  | "id"
  | "publicId"
  | "status"
  | "phase"
  | "title"
  | "mode"
  | "targetMinutes"
  | "durationSeconds"
  | "createdAt"
  | "error"
> & { articleCount: number; sourceUrls: string[] };

export const getEpisodes: GetEpisodes<void, EpisodeSummary[]> = async (_args, context) => {
  if (!context.user) throw new HttpError(401);
  const episodes = await context.entities.Episode.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { articles: true } },
      // Just enough for the cover mosaic.
      articles: { select: { url: true }, orderBy: ARTICLE_ORDER, take: 4 },
    },
  });
  return episodes.map(({ _count, articles, ...e }) => ({
    id: e.id,
    publicId: e.publicId,
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

const episodeDetailInclude = {
  articles: {
    select: { id: true, url: true, title: true, siteName: true, startSeconds: true },
    orderBy: ARTICLE_ORDER,
  },
};

async function toEpisodeDetail(
  episode: Episode & { articles: EpisodeDetail["articles"] },
): Promise<EpisodeDetail> {
  const { audioKey, userId: _userId, ...rest } = episode;
  const audioUrl = audioKey ? await getSignedAudioUrl(audioKey) : null;
  return { ...rest, audioUrl };
}

export const getEpisode: GetEpisode<{ publicId: string }, EpisodeDetail> = async ({ publicId }, context) => {
  if (!context.user) throw new HttpError(401);
  const episode = await context.entities.Episode.findFirst({
    where: { publicId, userId: context.user.id },
    include: episodeDetailInclude,
  });
  if (!episode) throw new HttpError(404, "Episode not found.");
  return toEpisodeDetail(episode);
};

// The same shape as getEpisode, for anyone, but only for an episode its
// owner has made public and only once it is ready: a public link never
// shows someone else's failure or their inbox mid-generation.
export const getPublicEpisode: GetPublicEpisode<{ publicId: string }, EpisodeDetail> = async (
  { publicId },
  context,
) => {
  const episode = await context.entities.Episode.findFirst({
    where: { publicId, isPublic: true, status: "ready" },
    include: episodeDetailInclude,
  });
  if (!episode) throw new HttpError(404, "Episode not found.");
  return toEpisodeDetail(episode);
};

// The landing page's sample episode, named by row id in FEATURED_EPISODE_ID.
// Null when unset, or when that episode is no longer public or ready, so
// the link disappears rather than 404s.
export const getFeaturedEpisode: GetFeaturedEpisode<void, { publicId: string } | null> = async (
  _args,
  context,
) => {
  if (env.FEATURED_EPISODE_ID === 0) return null;
  const episode = await context.entities.Episode.findFirst({
    where: { id: env.FEATURED_EPISODE_ID, isPublic: true, status: "ready" },
    select: { publicId: true },
  });
  return episode ?? null;
};

export const setEpisodePublic: SetEpisodePublic<{ id: number; isPublic: boolean }, void> = async (
  { id, isPublic },
  context,
) => {
  if (!context.user) throw new HttpError(401);
  const { count } = await context.entities.Episode.updateMany({
    where: { id, userId: context.user.id },
    data: { isPublic },
  });
  if (count === 0) throw new HttpError(404, "Episode not found.");
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

// Sets the reading order of the whole inbox at once. The client sends every
// unused article id in the order it wants; anything else is rejected, so a
// stale inbox (an article saved from the extension meanwhile) reorders
// nothing rather than something wrong.
export const reorderInbox: ReorderInbox<{ ids: number[] }, void> = async ({ ids }, context) => {
  if (!context.user) throw new HttpError(401);
  const unused = await context.entities.Article.findMany({
    where: { userId: context.user.id, episodeId: null },
    select: { id: true },
  });
  const expected = new Set(unused.map((a) => a.id));
  if (ids.length !== expected.size || !ids.every((id) => expected.has(id))) {
    throw new HttpError(409, "The inbox changed. Reload and try again.");
  }
  await Promise.all(
    ids.map((id, position) => context.entities.Article.update({ where: { id }, data: { position } })),
  );
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

// Gives up on an episode that is taking too long. The job keeps running
// until its current OpenAI call returns, then sees the row is no longer in
// flight and discards its work; the articles are back in the inbox at once.
export const cancelEpisode: CancelEpisode<{ id: number }, void> = async ({ id }, context) => {
  if (!context.user) throw new HttpError(401);
  const episode = await context.entities.Episode.findFirst({ where: { id, userId: context.user.id } });
  if (!episode) throw new HttpError(404, "Episode not found.");
  const changed = await failEpisode(id, "Cancelled.", context.entities);
  if (!changed) throw new HttpError(400, "This episode is not being generated.");
};

// Removes a finished or failed episode and its audio. Its articles go back
// to the inbox on their own: the schema nulls their episode on delete, and
// they keep their reading order. An episode still generating is cancelled
// first, from the same page, so this refuses it rather than racing the job.
export const deleteEpisode: DeleteEpisode<{ id: number }, void> = async ({ id }, context) => {
  if (!context.user) throw new HttpError(401);
  const episode = await context.entities.Episode.findFirst({ where: { id, userId: context.user.id } });
  if (!episode) throw new HttpError(404, "Episode not found.");
  if (episode.status === "pending" || episode.status === "generating") {
    throw new HttpError(400, "Cancel the episode before deleting it.");
  }
  // Articles first, so they are back in the inbox even if the audio delete
  // fails; the row is removed last.
  await context.entities.Article.updateMany({
    where: { episodeId: id },
    data: { episodeId: null, startSeconds: null },
  });
  if (episode.audioKey) {
    try {
      await deleteEpisodeAudio(episode.audioKey);
    } catch (err) {
      console.warn(`[deleteEpisode] Could not delete audio ${episode.audioKey}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  await context.entities.Episode.delete({ where: { id } });
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
