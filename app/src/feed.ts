import { ARTICLE_ORDER } from "./lib/articleOrder";
import { HttpError, config } from "wasp/server";
import type { FeedApi, FeedAudioApi, FeedChaptersApi } from "wasp/server/api";
import type { Article, Episode } from "wasp/entities";
import { getSignedAudioUrl } from "./lib/s3";
import { chaptersFor } from "./shared/chapters";

// Podcast apps cannot log in, so the feed and its audio are guarded by a secret
// token in the URL instead of a session. Anyone holding the URL can listen;
// rotating the token is how a user revokes it.

export function feedUrl(token: string): string {
  return `${config.serverUrl}/api/feed/${token}`;
}

function audioUrl(token: string, episodeId: number): string {
  return `${feedUrl(token)}/episodes/${episodeId}/audio.mp3`;
}

function chaptersUrl(token: string, episodeId: number): string {
  return `${feedUrl(token)}/episodes/${episodeId}/chapters.json`;
}

// Served by the client, which is where Wasp puts static files.
const ARTWORK_URL = `${config.frontendUrl}/podcast-artwork.png`;

type FeedArticle = Pick<Article, "title" | "url" | "siteName" | "byline" | "startSeconds">;
type FeedEpisode = Episode & { articles: FeedArticle[] };

const ARTICLE_SELECT = {
  title: true,
  url: true,
  siteName: true,
  byline: true,
  startSeconds: true,
} as const;

export const feedApi: FeedApi<{ token: string }, string> = async (req, res, context) => {
  const user = await context.entities.User.findUnique({
    where: { feedToken: req.params.token },
    select: { id: true },
  });
  if (!user) throw new HttpError(404);

  const episodes = await context.entities.Episode.findMany({
    where: { userId: user.id, status: "ready", audioKey: { not: null } },
    orderBy: { createdAt: "desc" },
    include: { articles: { select: ARTICLE_SELECT, orderBy: ARTICLE_ORDER } },
  });

  res.set("Content-Type", "application/rss+xml; charset=utf-8");
  res.send(buildFeed(req.params.token, episodes));
};

// Redirects to a short lived signed URL, so the bucket stays private and S3
// keeps handling range requests for the podcast app.
export const feedAudioApi: FeedAudioApi<{ token: string; id: string }, never> = async (
  req,
  res,
  context,
) => {
  const episodeId = Number(req.params.id);
  if (!Number.isInteger(episodeId)) throw new HttpError(404);

  const user = await context.entities.User.findUnique({
    where: { feedToken: req.params.token },
    select: { id: true },
  });
  if (!user) throw new HttpError(404);

  const episode = await context.entities.Episode.findFirst({
    where: { id: episodeId, userId: user.id, status: "ready" },
    select: { audioKey: true },
  });
  if (!episode?.audioKey) throw new HttpError(404);

  res.redirect(302, await getSignedAudioUrl(episode.audioKey));
};

// Podcasting 2.0 chapters, which Apple Podcasts and most other apps read from
// the item's podcast:chapters tag.
type ChaptersBody = {
  version: string;
  chapters: { startTime: number; title: string; url?: string }[];
};

export const feedChaptersApi: FeedChaptersApi<{ token: string; id: string }, ChaptersBody> = async (
  req,
  res,
  context,
) => {
  const episodeId = Number(req.params.id);
  if (!Number.isInteger(episodeId)) throw new HttpError(404);

  const user = await context.entities.User.findUnique({
    where: { feedToken: req.params.token },
    select: { id: true },
  });
  if (!user) throw new HttpError(404);

  const episode = await context.entities.Episode.findFirst({
    where: { id: episodeId, userId: user.id, status: "ready" },
    select: { articles: { select: ARTICLE_SELECT, orderBy: ARTICLE_ORDER } },
  });
  if (!episode) throw new HttpError(404);

  res.set("Content-Type", "application/json+chapters; charset=utf-8");
  res.send({
    version: "1.2.0",
    chapters: chaptersFor(episode.articles).map((c) => ({
      startTime: c.startSeconds,
      title: c.title,
      ...(c.url ? { url: c.url } : {}),
    })),
  });
};

function buildFeed(token: string, episodes: FeedEpisode[]): string {
  const items = episodes.map((e) => feedItem(token, e)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>Tabcast</title>
    <link>${escapeXml(config.frontendUrl)}</link>
    <atom:link href="${escapeXml(feedUrl(token))}" rel="self" type="application/rss+xml"/>
    <description>Narrated digests of the articles you saved.</description>
    <language>en</language>
    <itunes:author>Tabcast</itunes:author>
    <itunes:image href="${escapeXml(ARTWORK_URL)}"/>
    <itunes:category text="News"/>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
${items}
  </channel>
</rss>
`;
}

function feedItem(token: string, e: FeedEpisode): string {
  const count = e.articles.length;
  const sources = e.articles
    .map((a) => {
      const who = [a.byline, a.siteName].filter(Boolean).join(", ");
      return `<li><a href="${escapeXml(a.url)}">${escapeXml(a.title)}</a>${
        who ? ` — ${escapeXml(who)}` : ""
      }</li>`;
    })
    .join("");
  // Timestamps in the notes are the third way apps find chapters, and the one
  // that needs nothing but the text. Apple wants a 00:00 entry.
  const chapters = chaptersFor(e.articles);
  const timestamps = chapters.length
    ? `<p>${chapters.map((c) => `${formatTimestamp(c.startSeconds)} ${escapeXml(c.title)}`).join("<br/>")}</p>`
    : "";
  const notes = `<p>A narrated digest of ${count} saved article${count === 1 ? "" : "s"}.</p><ul>${sources}</ul>${timestamps}`;
  const duration = e.durationSeconds ? `\n      <itunes:duration>${e.durationSeconds}</itunes:duration>` : "";
  const chaptersTag =
    chapters.length > 0
      ? `\n      <podcast:chapters url="${escapeXml(chaptersUrl(token, e.id))}" type="application/json+chapters"/>`
      : "";

  return `    <item>
      <title>${escapeXml(e.title)}</title>
      <guid isPermaLink="false">article-to-podcast-episode-${e.id}</guid>
      <pubDate>${(e.completedAt ?? e.createdAt).toUTCString()}</pubDate>
      <description>${cdata(notes)}</description>
      <enclosure url="${escapeXml(audioUrl(token, e.id))}" length="${e.audioBytes ?? 0}" type="audio/mpeg"/>${duration}${chaptersTag}
      <itunes:explicit>false</itunes:explicit>
    </item>`;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The only sequence that can break out of a CDATA section is its own terminator.
function cdata(html: string): string {
  return `<![CDATA[${html.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}
