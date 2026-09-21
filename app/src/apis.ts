import cors from "cors";
import * as z from "zod";
import { HttpError, config, type MiddlewareConfigFn, type PrismaClient } from "wasp/server";
import type { ExtStatusApi, SaveArticleApi, ShortcutSaveApi } from "wasp/server/api";

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
  const saved = await saveArticle(context.user.id, req.body, context.entities.Article);
  res.status(saved.result === "created" ? 201 : 200).json(saved);
};

// The iOS Shortcut cannot hold a session, so the user's save token in the URL
// identifies them instead. Same body as the extension; Safari Reader supplies
// the same fields Readability does. Replies in plain text so the Shortcut can
// show it in a notification as is.
export function saveUrl(token: string): string {
  return `${config.serverUrl}/api/save/${token}`;
}

export const shortcutSaveApi: ShortcutSaveApi<{ token: string }, string, SaveArticleBody> = async (
  req,
  res,
  context,
) => {
  const user = await context.entities.User.findUnique({
    where: { saveToken: req.params.token },
    select: { id: true },
  });
  if (!user) throw new HttpError(404);
  const saved = await saveArticle(user.id, req.body, context.entities.Article);
  res
    .status(saved.result === "created" ? 201 : 200)
    .type("text/plain")
    .send(saved.result === "created" ? `Saved: ${saved.title}` : `Already saved: ${saved.title}`);
};

async function saveArticle(
  userId: number,
  rawBody: unknown,
  Article: PrismaClient["article"],
): Promise<SaveArticleResponse & { title: string }> {
  const parsed = saveArticleBody.safeParse(rawBody);
  if (!parsed.success) {
    // Name the field, since the Shortcut user only sees this text.
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    throw new HttpError(400, issue ? `${where}${issue.message}` : "Invalid article.");
  }
  const body = parsed.data;
  const url = normalizeUrl(body.url);
  const textContent = body.textContent.slice(0, MAX_TEXT_CHARS);

  const existing = await Article.findUnique({
    where: { userId_url: { userId, url } },
    select: { id: true, title: true },
  });
  if (existing) return { result: "duplicate", articleId: existing.id, title: existing.title };

  const article = await Article.create({
    data: {
      userId,
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
  return { result: "created", articleId: article.id, title: body.title };
}

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
