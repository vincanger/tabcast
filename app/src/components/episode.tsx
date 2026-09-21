import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Queued", className: "border-rubric text-rubric" },
  generating: { label: "Live", className: "border-rubric text-rubric" },
  ready: { label: "Ready", className: "" },
  failed: { label: "Failed", className: "border-destructive text-destructive" },
};

// A small caps kicker with a hairline border, like a section tag in print.
export function StatusBadge({ status }: { status: string }) {
  const { label, className } = STATUS[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={cn("kicker h-5 px-1.5", className)}>
      {label}
    </Badge>
  );
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
