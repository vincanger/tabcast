import { Readability } from "@mozilla/readability";
import type { ContentMessage, ParseResult } from "@/utils/types";

// Runs on every page and waits to be asked. Parsing happens on demand so the
// script does nothing until the user clicks the toolbar icon.
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    browser.runtime.onMessage.addListener((message: ContentMessage, _sender, sendResponse) => {
      if (message?.type !== "parse-article") return;
      sendResponse(parseCurrentPage());
      return true;
    });
  },
});

function parseCurrentPage(): ParseResult {
  try {
    // Readability mutates the DOM it is given, so work on a clone.
    const clone = document.cloneNode(true) as Document;
    const parsed = new Readability(clone).parse();
    if (!parsed || !parsed.textContent) {
      return { ok: false, reason: "No article found on this page." };
    }
    const textContent = parsed.textContent.replace(/\s+\n/g, "\n").trim();
    return {
      ok: true,
      article: {
        url: canonicalUrl(),
        title: (parsed.title || document.title || "Untitled").trim(),
        siteName: parsed.siteName ?? null,
        // Read metadata off the live document; Readability only looks at a few
        // byline patterns and misses Substack, X, and most newsletter templates.
        byline: findByline(parsed.byline, canonicalUrl()),
        excerpt: parsed.excerpt ?? null,
        textContent,
      },
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Could not parse this page." };
  }
}

function canonicalUrl(): string {
  const link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const href = link?.href;
  return href && href.startsWith("http") ? href : location.href;
}

// Tried in order, first usable value wins.
function findByline(
  readabilityByline: string | null | undefined,
  url: string,
): string | null {
  const candidates: (string | null | undefined)[] = [
    readabilityByline,
    jsonLdAuthor(),
    meta('meta[name="author"]'),
    meta('meta[property="article:author"]'),
    meta('meta[name="citation_author"]'),
    document.querySelector('[rel="author"]')?.textContent,
    document.querySelector('[itemprop="author"] [itemprop="name"], [itemprop="author"]')
      ?.textContent,
    meta('meta[name="twitter:creator"]'),
    // Nothing in the markup named an author, so fall back to the URL.
    authorFromUrl(url),
  ];

  for (const candidate of candidates) {
    const cleaned = cleanByline(candidate);
    if (cleaned) return cleaned;
  }
  return null;
}

function meta(selector: string): string | null {
  return document.querySelector<HTMLMetaElement>(selector)?.content ?? null;
}

function cleanByline(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.replace(/\s+/g, " ").replace(/^by\s+/i, "").trim();
  if (!value) return null;
  // article:author is often a profile URL rather than a name. An @handle is
  // still a useful attribution, so only plain URLs are rejected.
  if (/^https?:\/\//i.test(value)) return null;
  if (value.length > 120) return null;
  return value;
}

function jsonLdAuthor(): string | null {
  const blocks = document.querySelectorAll<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  );
  for (const block of blocks) {
    try {
      const found = findAuthor(JSON.parse(block.textContent ?? ""));
      if (found) return found;
    } catch {
      // Malformed JSON-LD is common. Skip the block and try the next one.
    }
  }
  return null;
}

function findAuthor(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findAuthor(item);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;

  const obj = node as Record<string, unknown>;
  const name = authorName(obj.author);
  if (name) return name;

  // Publishers nest the article inside these containers.
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage"]) {
    const found = findAuthor(obj[key]);
    if (found) return found;
  }
  return null;
}

function authorName(author: unknown): string | null {
  if (typeof author === "string") return author;
  if (Array.isArray(author)) {
    const names = author.map(authorName).filter((n): n is string => Boolean(n));
    return names.length > 0 ? names.join(", ") : null;
  }
  if (author && typeof author === "object") {
    const name = (author as Record<string, unknown>).name;
    if (typeof name === "string") return name;
  }
  return null;
}

// Some platforms put the author in the URL and nowhere else useful. On X the
// handle in the path is the author, so it beats leaving the byline empty.
function authorFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");
  const segments = parsed.pathname.split("/").filter(Boolean);

  if (host === "x.com" || host === "twitter.com") {
    const handle = segments[0];
    if (handle && !RESERVED_X_PATHS.has(handle.toLowerCase())) return `@${handle}`;
  }

  // Substack and other newsletter hosts put the publication in the subdomain.
  const subdomain = parsed.hostname.split(".")[0];
  if (host.endsWith(".substack.com") && subdomain && subdomain !== "www") return subdomain;

  return null;
}

const RESERVED_X_PATHS = new Set([
  "home",
  "explore",
  "notifications",
  "messages",
  "search",
  "i",
  "settings",
  "compose",
]);
