import { useState } from "react";
import { Link } from "react-router";
import {
  deleteArticle,
  generateEpisode,
  getEpisodes,
  getInbox,
  useQuery,
} from "wasp/client/operations";
import { DEFAULT_MINUTES, MAX_MINUTES, MIN_MINUTES } from "../shared/constants";
import { isInFlight, pollWhileAnyInFlight } from "../components/episode";

export function InboxPage() {
  const inbox = useQuery(getInbox);
  const episodes = useQuery(getEpisodes, undefined, {
    // Poll while an episode is being generated so the banner updates.
    refetchInterval: pollWhileAnyInFlight,
  });

  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inFlight = episodes.data?.find((e) => isInFlight(e.status));
  const latestFailed = episodes.data?.[0]?.status === "failed" ? episodes.data[0] : null;
  const articles = inbox.data ?? [];
  const canGenerate = articles.length > 0 && !inFlight && !busy;

  async function onGenerate() {
    setError(null);
    setBusy(true);
    try {
      await generateEpisode({ targetMinutes: minutes });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    setError(null);
    try {
      await deleteArticle({ id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the article.");
    }
  }

  return (
    <>
      <section className="card generate">
        <div className="generate-row">
          <label htmlFor="minutes">
            Target length: <strong>{minutes} min</strong>
          </label>
          <input
            id="minutes"
            type="range"
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            value={minutes}
            disabled={!!inFlight}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
          <button className="primary" disabled={!canGenerate} onClick={onGenerate}>
            {busy ? "Starting…" : `Generate episode from ${articles.length} article${articles.length === 1 ? "" : "s"}`}
          </button>
        </div>
        {inFlight && (
          <p className="notice">
            Generating your episode… this usually takes a minute or two.{" "}
            <Link to={`/episodes/${inFlight.id}`}>Watch progress</Link>.
          </p>
        )}
        {!inFlight && latestFailed && (
          <p className="notice error">
            The last episode failed: {latestFailed.error ?? "unknown error"}. Your articles are back in
            the inbox.
          </p>
        )}
        {error && <p className="notice error">{error}</p>}
      </section>

      <section>
        <h2>Inbox</h2>
        {inbox.isLoading && <p className="muted">Loading…</p>}
        {inbox.error && <p className="notice error">{inbox.error.message}</p>}
        {!inbox.isLoading && articles.length === 0 && (
          <p className="muted">
            Nothing saved yet. Click the extension icon on any article to save it here.
          </p>
        )}
        <ul className="list">
          {articles.map((a) => (
            <li key={a.id} className="row">
              <div className="grow">
                <a href={a.url} target="_blank" rel="noreferrer noopener" className="title">
                  {a.title}
                </a>
                <div className="muted small">
                  {a.siteName ?? new URL(a.url).hostname} · {a.wordCount.toLocaleString()} words ·{" "}
                  {formatDate(a.savedAt)}
                </div>
              </div>
              <button className="link danger" onClick={() => onDelete(a.id)} disabled={!!inFlight}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
