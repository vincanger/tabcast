export function StatusBadge({ status }: { status: string }) {
  const label =
    status === "pending"
      ? "Queued"
      : status === "generating"
        ? "Generating"
        : status === "ready"
          ? "Ready"
          : status === "failed"
            ? "Failed"
            : status;
  return <span className={`badge badge-${status}`}>{label}</span>;
}

export function isInFlight(status: string | undefined): boolean {
  return status === "pending" || status === "generating";
}

const POLL_MS = 3000;

// refetchInterval callbacks for react-query v4, which passes the current data
// as the first argument. Poll only while something is generating.
export function pollWhileAnyInFlight(data: { status: string }[] | undefined): number | false {
  return data?.some((e) => isInFlight(e.status)) ? POLL_MS : false;
}

export function pollWhileInFlight(data: { status: string } | undefined): number | false {
  return isInFlight(data?.status) ? POLL_MS : false;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
