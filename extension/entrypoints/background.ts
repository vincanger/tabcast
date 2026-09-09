import { ApiError, getSettings, saveArticle } from "@/utils/api";
import type { ContentMessage, ParseResult } from "@/utils/types";

type BadgeKind = "saved" | "duplicate" | "error" | "busy";

const BADGES: Record<BadgeKind, { text: string; color: string }> = {
  busy: { text: "…", color: "#6b6b6b" },
  saved: { text: "✓", color: "#1f8a4c" },
  duplicate: { text: "•", color: "#2f5bea" },
  error: { text: "!", color: "#c0392b" },
};

const BADGE_CLEAR_MS = 3000;

export default defineBackground(() => {
  // Clicking the toolbar icon saves the page. The popup is only attached when
  // the user is logged out, so the click reaches us otherwise.
  browser.action.onClicked.addListener((tab) => {
    if (tab.id !== undefined) void handleSave(tab.id);
  });

  // Keep the popup attachment in sync with login state.
  void syncPopup();
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && "sessionId" in changes) void syncPopup();
  });

  // While logged in the click saves, so the popup is reachable from the
  // icon's right-click menu instead.
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: "open-dashboard",
      title: "Open dashboard",
      contexts: ["action"],
    });
    browser.contextMenus.create({
      id: "open-popup",
      title: "Account and settings",
      contexts: ["action"],
    });
  });
  browser.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId === "open-dashboard") {
      const { dashboardUrl } = await getSettings();
      await browser.tabs.create({ url: dashboardUrl });
    } else if (info.menuItemId === "open-popup") {
      await browser.tabs.create({ url: browser.runtime.getURL("/popup.html") });
    }
  });
});

async function syncPopup() {
  const { sessionId } = await getSettings();
  await browser.action.setPopup({ popup: sessionId ? "" : "popup.html" });
}

async function handleSave(tabId: number) {
  await setBadge(tabId, "busy");
  try {
    const parsed = await parseTab(tabId);
    if (!parsed.ok) throw new Error(parsed.reason);

    const result = await saveArticle(parsed.article);
    await browser.action.setTitle({ tabId, title: "" });
    await setBadge(tabId, result.result === "created" ? "saved" : "duplicate", BADGE_CLEAR_MS);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Could not save this page.";
    console.warn("[article-to-podcast] save failed:", err);
    await setBadge(tabId, "error", BADGE_CLEAR_MS);
    // The badge alone cannot say what went wrong, so put the reason on the
    // icon's tooltip until the next save.
    await browser.action.setTitle({ tabId, title: `Not saved: ${reason}` });
    if (err instanceof ApiError && err.status === 401) {
      // Session is gone. Re-attach the popup so the next click shows login.
      await syncPopup();
      await browser.action.openPopup().catch(() => {});
    }
  }
}

async function parseTab(tabId: number): Promise<ParseResult> {
  const message: ContentMessage = { type: "parse-article" };
  try {
    return await browser.tabs.sendMessage(tabId, message);
  } catch {
    // The content script is missing on tabs opened before the extension was
    // installed or reloaded. Inject it once and retry.
    await browser.scripting.executeScript({
      target: { tabId },
      files: ["/content-scripts/content.js"],
    });
    return browser.tabs.sendMessage(tabId, message);
  }
}

async function setBadge(tabId: number, kind: BadgeKind, clearAfterMs?: number) {
  const { text, color } = BADGES[kind];
  await browser.action.setBadgeBackgroundColor({ tabId, color });
  await browser.action.setBadgeText({ tabId, text });
  if (clearAfterMs) {
    setTimeout(() => {
      browser.action.setBadgeText({ tabId, text: "" }).catch(() => {});
    }, clearAfterMs);
  }
}
