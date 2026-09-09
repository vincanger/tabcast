import type { ComponentProps } from "react";
import { Badge } from "./ui/badge";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Queued", variant: "outline" },
  generating: { label: "Generating", variant: "secondary" },
  ready: { label: "Ready", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const { label, variant } = STATUS[status] ?? { label: status, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
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
