import cors from "cors";
import * as z from "zod";
import { HttpError, type MiddlewareConfigFn } from "wasp/server";
import type { ExtStatusApi, SaveArticleApi } from "wasp/server/api";

// The extension calls these endpoints from its service worker. Chrome skips
// CORS for hosts listed in the extension's host_permissions, but we allow
// extension origins explicitly so the popup can call them too.
export const extApiMiddleware: MiddlewareConfigFn = (config) => {
  config.set(
    "cors",
    cors({
      origin: (origin, callback) => {
        const allowed = !origin || origin.startsWith("chrome-extension://");
        callback(null, allowed);
      },
    }),
  );
  return config;
};

const MAX_TEXT_CHARS = 200_000;

const saveArticleBody = z.object({
  url: z.string().url(),
  title: z.string().trim().min(1).max(500),
  siteName: z.string().trim().max(200).optional().nullable(),
  byline: z.string().trim().max(300).optional().nullable(),
  excerpt: z.string().trim().max(2000).optional().nullable(),
  textContent: z.string().trim().min(200, "Not enough article text found on this page."),
});

export type SaveArticleBody = z.infer<typeof saveArticleBody>;
export type SaveArticleResponse = { result: "created" | "duplicate"; articleId: number };

export const saveArticleApi: SaveArticleApi<never, SaveArticleResponse, SaveArticleBody> = async (
  req,
  res,
  context,
) => {
  if (!context.user) throw new HttpError(401);

  const parsed = saveArticleBody.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid article.");
  }
  const body = parsed.data;
  const url = normalizeUrl(body.url);
  const textContent = body.textContent.slice(0, MAX_TEXT_CHARS);

  const existing = await context.entities.Article.findUnique({
    where: { userId_url: { userId: context.user.id, url } },
    select: { id: true },
  });
  if (existing) {
    res.json({ result: "duplicate", articleId: existing.id });
    return;
  }

  const article = await context.entities.Article.create({
    data: {
      userId: context.user.id,
      url,
      title: body.title,
      siteName: body.siteName ?? null,
      byline: body.byline ?? null,
      excerpt: body.excerpt ?? null,
      textContent,
      wordCount: countWords(textContent),
    },
    select: { id: true },
  });
  res.status(201).json({ result: "created", articleId: article.id });
};

export type ExtStatusResponse = { username: string | null; unusedCount: number };

export const extStatusApi: ExtStatusApi<never, ExtStatusResponse> = async (_req, res, context) => {
  if (!context.user) throw new HttpError(401);
  const unusedCount = await context.entities.Article.count({
    where: { userId: context.user.id, episodeId: null },
  });
  res.json({ username: context.user.identities.username?.id ?? null, unusedCount });
};

// Strip fragments and common tracking params so the same article saved from
// two links counts as one.
function normalizeUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || key === "fbclid" || key === "gclid" || key === "ref") {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
