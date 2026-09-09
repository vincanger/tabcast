import { useState } from "react";
import { cn } from "../lib/utils";

// The site's own favicon, falling back to a monogram. Served straight from the
// source domain so the dashboard does not hand a reading list to a third party
// favicon service.
export function Favicon({ url, className }: { url: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const host = safeHost(url);

  return (
    <span className={cn("flex items-center justify-center", className)}>
      {failed ? (
        <span className="font-semibold uppercase">{host.replace(/^www\./, "").charAt(0)}</span>
      ) : (
        <img
          src={`https://${host}/favicon.ico`}
          alt=""
          loading="lazy"
          className="size-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

// Favicon in a bordered tile, used next to article links.
export function SourceIcon({ url, className }: { url: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted",
        className,
      )}
    >
      <Favicon url={url} className="size-5 text-sm text-muted-foreground" />
    </div>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "?";
  }
}
