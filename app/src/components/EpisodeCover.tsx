import { AudioLines } from "lucide-react";
import { cn } from "../lib/utils";
import { Favicon } from "./SourceIcon";

// Cover art is a mosaic of the source sites' favicons, edge to edge, over a
// gradient. The gradient hues come from a hash of the title, so an episode
// always gets the same backdrop without us storing or generating an image.
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const MAX_TILES = 4;

export function EpisodeCover({
  seed,
  sources,
  className,
}: {
  seed: string;
  // Source article URLs, in episode order. Only the first four are shown.
  sources: string[];
  className?: string;
}) {
  const h = hash(seed);
  // Stay in the warm half of the wheel so covers sit alongside the amber accent.
  const hueA = 25 + (h % 65);
  const hueB = hueA + 20 + ((h >> 8) % 45);
  const angle = (h >> 16) % 360;

  // An odd count gets a placeholder tile so the grid stays full.
  const tiles: (string | null)[] = sources.slice(0, MAX_TILES);
  if (tiles.length % 2 === 1) tiles.push(null);

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-xl", className)}
      style={{
        backgroundImage: `linear-gradient(${angle}deg, oklch(0.74 0.17 ${hueA}), oklch(0.38 0.12 ${hueB}))`,
      }}
    >
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
              <Favicon key={`${i}-${url}`} url={url} className="size-full text-lg font-bold text-white/90" />
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
      <AudioLines className="size-1/2 text-black/35" strokeWidth={1.5} />
    </div>
  );
}
