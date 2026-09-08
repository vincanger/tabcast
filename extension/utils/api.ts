import type { ExtStatusResponse, ParsedArticle, SaveArticleResponse } from "./types";

// Defaults match `wasp start`. Both are editable from the popup.
export const DEFAULT_SERVER_URL = "http://localhost:3001";
export const DEFAULT_DASHBOARD_URL = "http://localhost:3000";

export type Settings = {
  serverUrl: string;
  dashboardUrl: string;
  sessionId: string | null;
  email: string | null;
};

const DEFAULTS: Settings = {
  serverUrl: DEFAULT_SERVER_URL,
  dashboardUrl: DEFAULT_DASHBOARD_URL,
  sessionId: null,
  email: null,
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
      await updateSettings({ sessionId: null, email: null });
    }
    throw new ApiError(message, res.status);
  }
  return json as T;
}

// Wasp's built in email auth endpoint. Returns the session id we send as a bearer token.
export async function login(email: string, password: string): Promise<void> {
  const { sessionId } = await request<{ sessionId: string }>("/auth/email/login", {
    body: { email, password },
    auth: false,
  });
  await updateSettings({ sessionId, email });
}

export async function logout(): Promise<void> {
  try {
    await request<void>("/auth/logout", { method: "POST" });
  } catch {
    // Clear local state even if the server call fails.
  } finally {
    await updateSettings({ sessionId: null, email: null });
  }
}

export function getStatus(): Promise<ExtStatusResponse> {
  return request<ExtStatusResponse>("/api/ext/status");
}

export function saveArticle(article: ParsedArticle): Promise<SaveArticleResponse> {
  return request<SaveArticleResponse>("/api/ext/articles", { body: article });
}
