import { useEffect, useState } from "react";
import {
  DEMO_DASHBOARD_URL,
  DEMO_SERVER_URL,
  getSettings,
  getStatus,
  login,
  logout,
  updateSettings,
  type Settings,
} from "@/utils/api";

type View = { kind: "loading" } | { kind: "login" } | { kind: "status"; username: string | null; unusedCount: number };

function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setError(null);
    const s = await getSettings();
    setSettings(s);
    if (!s.sessionId) {
      setView({ kind: "login" });
      return;
    }
    try {
      const status = await getStatus();
      setView({ kind: "status", ...status });
    } catch (e) {
      // A 401 already cleared the session inside getStatus.
      setError(e instanceof Error ? e.message : "Could not reach the server.");
      setView({ kind: "login" });
    }
  }

  async function onLogin(username: string, password: string) {
    setError(null);
    try {
      await login(username, password);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
    }
  }

  async function onLogout() {
    await logout();
    await refresh();
  }

  async function onSaveSettings(serverUrl: string, dashboardUrl: string) {
    await updateSettings({ serverUrl, dashboardUrl });
    await refresh();
  }

  return (
    <div className="popup">
      <h1>Articles to Podcast</h1>

      {view.kind === "loading" && <p className="muted">Loading…</p>}

      {view.kind === "login" && (
        <>
          <LoginForm onSubmit={onLogin} />
          {error && <p className="error small">{error}</p>}
          <p className="muted small hint">
            No account yet?{" "}
            <a href={`${settings?.dashboardUrl ?? ""}/signup`} target="_blank" rel="noreferrer">
              Sign up in the web app
            </a>
            .
          </p>
        </>
      )}

      {view.kind === "status" && (
        <div className="status">
          <div>
            <div className="count">{view.unusedCount}</div>
            <div className="muted small">
              article{view.unusedCount === 1 ? "" : "s"} waiting for the next episode
            </div>
          </div>
          <p className="muted small hint">
            Click the toolbar icon on any article to save it. Then{" "}
            <a href={settings?.dashboardUrl} target="_blank" rel="noreferrer">
              open the dashboard
            </a>{" "}
            to generate an episode.
          </p>
          <div className="small">
            <span className="muted">{view.username}</span> ·{" "}
            <button className="link" onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      )}

      {settings && (
        <details>
          <summary>Server settings</summary>
          <SettingsForm settings={settings} onSubmit={onSaveSettings} />
        </details>
      )}
    </div>
  );
}

function LoginForm({ onSubmit }: { onSubmit: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(username, password);
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        type="text"
        placeholder="Username"
        value={username}
        autoFocus
        required
        autoComplete="username"
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        required
        onChange={(e) => setPassword(e.target.value)}
      />
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}

function SettingsForm({
  settings,
  onSubmit,
}: {
  settings: Settings;
  onSubmit: (serverUrl: string, dashboardUrl: string) => Promise<void>;
}) {
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [dashboardUrl, setDashboardUrl] = useState(settings.dashboardUrl);
  const hasDemo = Boolean(DEMO_SERVER_URL && DEMO_DASHBOARD_URL);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(serverUrl.trim(), dashboardUrl.trim());
      }}
    >
      <p className="muted small hint">
        Running your own instance? Enter its API server and dashboard URLs.
        {hasDemo && (
          <>
            {" "}
            Or{" "}
            <button
              type="button"
              className="link"
              onClick={() => {
                setServerUrl(DEMO_SERVER_URL);
                setDashboardUrl(DEMO_DASHBOARD_URL);
              }}
            >
              use the hosted demo
            </button>
            .
          </>
        )}
      </p>
      <label className="small muted">
        API server URL
        <input type="url" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} required />
      </label>
      <label className="small muted">
        Dashboard URL
        <input type="url" value={dashboardUrl} onChange={(e) => setDashboardUrl(e.target.value)} required />
      </label>
      <button className="primary" type="submit">
        Save
      </button>
    </form>
  );
}

export default App;
