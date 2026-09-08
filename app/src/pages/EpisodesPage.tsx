import { Link } from "react-router";
import { getEpisodes, useQuery } from "wasp/client/operations";
import { StatusBadge, formatDuration, pollWhileAnyInFlight } from "../components/episode";

export function EpisodesPage() {
  const { data: episodes, isLoading, error } = useQuery(getEpisodes, undefined, {
    refetchInterval: pollWhileAnyInFlight,
  });

  return (
    <section>
      <h2>Episodes</h2>
      {isLoading && <p className="muted">Loading…</p>}
      {error && <p className="notice error">{error.message}</p>}
      {episodes && episodes.length === 0 && (
        <p className="muted">
          No episodes yet. <Link to="/">Generate one from your inbox</Link>.
        </p>
      )}
      <ul className="list">
        {episodes?.map((e) => (
          <li key={e.id} className="row">
            <div className="grow">
              <Link to={`/episodes/${e.id}`} className="title">
                {e.title}
              </Link>
              <div className="muted small">
                {new Date(e.createdAt).toLocaleString()} · {e.articleCount} article
                {e.articleCount === 1 ? "" : "s"} · target {e.targetMinutes} min
                {e.durationSeconds ? ` · ${formatDuration(e.durationSeconds)}` : ""}
              </div>
            </div>
            <StatusBadge status={e.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}
