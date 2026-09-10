// Shape sent by the content script and forwarded to POST /api/ext/articles.
export type ParsedArticle = {
  url: string;
  title: string;
  siteName: string | null;
  byline: string | null;
  excerpt: string | null;
  textContent: string;
};

export type ParseResult = { ok: true; article: ParsedArticle } | { ok: false; reason: string };

export type SaveArticleResponse = { result: "created" | "duplicate"; articleId: number };
export type ExtStatusResponse = { username: string | null; unusedCount: number };

// Messages between popup, background, and content script.
export type ContentMessage = { type: "parse-article" };
