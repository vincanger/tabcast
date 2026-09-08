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
        byline: parsed.byline ?? null,
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
