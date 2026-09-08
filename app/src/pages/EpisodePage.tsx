import { Link, useParams } from "react-router";
import { getEpisode, useQuery } from "wasp/client/operations";
import { StatusBadge, formatDuration, isInFlight, pollWhileInFlight } from "../components/episode";

export function EpisodePage() {
  const { id } = useParams<{ id: string }>();
  const episodeId = Number(id);

  const { data: episode, isLoading, error } = useQuery(
    getEpisode,
    { id: episodeId },
    { enabled: Number.isInteger(episodeId), refetchInterval: pollWhileInFlight },
  );

  if (!Number.isInteger(episodeId)) return <p className="notice error">Invalid episode id.</p>;
  if (isLoading) return <p className="muted">Loading…</p>;
  if (error) return <p className="notice error">{error.message}</p>;
  if (!episode) return null;

  const inFlight = isInFlight(episode.status);

  return (
    <article>
      <p className="muted small">
        <Link to="/episodes">← All episodes</Link>
      </p>
      <h2>{episode.title}</h2>
      <p className="muted small">
        {new Date(episode.createdAt).toLocaleString()} · target {episode.targetMinutes} min
        {episode.durationSeconds ? ` · about ${formatDuration(episode.durationSeconds)}` : ""}{" "}
        <StatusBadge status={episode.status} />
      </p>

      {inFlight && (
        <p className="notice">
          {episode.status === "pending" ? "Queued…" : "Writing the script and recording the narration…"}{" "}
          This page refreshes on its own.
        </p>
      )}
      {episode.status === "failed" && (
        <p className="notice error">Generation failed: {episode.error ?? "unknown error"}.</p>
      )}
      {episode.status === "ready" && episode.audioUrl && (
        <audio className="player" controls preload="metadata" src={episode.audioUrl} />
      )}

      <section className="card">
        <h3>Sources</h3>
        <ul className="sources">
          {episode.articles.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noreferrer noopener">
                {a.title}
              </a>
              <span className="muted small"> · {a.siteName ?? new URL(a.url).hostname}</span>
            </li>
          ))}
        </ul>
      </section>

      {episode.script && (
        <section className="card">
          <h3>Script</h3>
          <div className="script">
            {episode.script.split(/\n\s*\n/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
