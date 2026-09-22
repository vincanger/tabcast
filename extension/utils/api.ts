import type { ExtStatusResponse, ParsedArticle, SaveArticleResponse } from "./types";

// The hosted demo. A fresh install points here, and the popup offers a one
// click way back to it after someone has typed other URLs.
export const DEMO_SERVER_URL = "https://tabcast-server.fly.dev";
export const DEMO_DASHBOARD_URL = "https://tabcast.xyz";

// Where a fresh install points. Set WXT_SERVER_URL and WXT_DASHBOARD_URL at
// build time to bake in your own deployment (or `wasp start` while
// developing, see .env.example). Both stay editable from the popup.
export const DEFAULT_SERVER_URL = import.meta.env.WXT_SERVER_URL || DEMO_SERVER_URL;
export const DEFAULT_DASHBOARD_URL = import.meta.env.WXT_DASHBOARD_URL || DEMO_DASHBOARD_URL;

export type Settings = {
  serverUrl: string;
  dashboardUrl: string;
  sessionId: string | null;
  // The email (or username, on a username-auth instance) shown in the popup.
  account: string | null;
};

const DEFAULTS: Settings = {
  serverUrl: DEFAULT_SERVER_URL,
  dashboardUrl: DEFAULT_DASHBOARD_URL,
  sessionId: null,
  account: null,
};

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored } as Settings;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await browser.storage.local.set(patch);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const settings = await getSettings();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.auth !== false) {
    if (!settings.sessionId) throw new ApiError("Not logged in.", 401);
    headers.Authorization = `Bearer ${settings.sessionId}`;
  }

  const base = settings.serverUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}${path}`, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Non JSON body, fall through with the raw text as the message.
  }

  if (!res.ok) {
    const message =
      (json && typeof json === "object" && "message" in json && typeof json.message === "string"
        ? json.message
        : null) ?? (text || `Request failed with ${res.status}`);
    if (res.status === 401) {
      // The session expired or was revoked. Forget it so the popup shows login.
      await updateSettings({ sessionId: null, account: null });
    }
    throw new ApiError(message, res.status);
  }
  return json as T;
}

// Wasp's built in email auth endpoint. Returns the session id we send as a
// bearer token. An instance switched to usernameAndPassword auth (see the
// comment in app/main.wasp.ts) uses "/auth/username/login" with a body of
// { username, password } instead; change those two lines and the label below.
export async function login(email: string, password: string): Promise<void> {
  const { sessionId } = await request<{ sessionId: string }>("/auth/email/login", {
    body: { email, password },
    auth: false,
  });
  await updateSettings({ sessionId, account: email });
}

export async function logout(): Promise<void> {
  try {
    await request<void>("/auth/logout", { method: "POST" });
  } catch {
    // Clear local state even if the server call fails.
  } finally {
    await updateSettings({ sessionId: null, account: null });
  }
}

export function getStatus(): Promise<ExtStatusResponse> {
  return request<ExtStatusResponse>("/api/ext/status");
}

export function saveArticle(article: ParsedArticle): Promise<SaveArticleResponse> {
  return request<SaveArticleResponse>("/api/ext/articles", { body: article });
}
