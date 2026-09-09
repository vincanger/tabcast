import { AudioLines } from "lucide-react";
import { cn } from "../lib/utils";
import { Favicon } from "./SourceIcon";

// Cover art is a mosaic of the source sites' favicons printed on the paper
// tint: desaturated and multiplied, so a white favicon background disappears
// into the sheet and the marks read as ink.
const MAX_TILES = 4;

export function EpisodeCover({
  sources,
  className,
}: {
  // Source article URLs, in episode order. Only the first four are shown.
  sources: string[];
  className?: string;
}) {
  // An odd count gets a placeholder tile so the grid stays full.
  const tiles: (string | null)[] = sources.slice(0, MAX_TILES);
  if (tiles.length % 2 === 1) tiles.push(null);

  return (
    <div className={cn("relative shrink-0 overflow-hidden border bg-secondary", className)}>
      {tiles.length === 0 ? (
        <Placeholder className="absolute inset-0" />
      ) : (
        <div
          className={cn(
            "absolute inset-0 grid grid-cols-2",
            // Two tiles are tall halves; four make a 2x2.
            tiles.length === 4 && "grid-rows-2",
          )}
        >
          {tiles.map((url, i) =>
            url ? (
              <Favicon
                key={`${i}-${url}`}
                url={url}
                className="size-full font-serif text-lg text-foreground grayscale contrast-125 mix-blend-multiply"
              />
            ) : (
              <Placeholder key={`placeholder-${i}`} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function Placeholder({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <AudioLines className="size-1/2 text-foreground/30" strokeWidth={1.5} />
    </div>
  );
}
