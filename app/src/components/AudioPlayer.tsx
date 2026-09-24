import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { Download, Loader2, Pause, Play } from "lucide-react";
import { Button } from "./ui/button";
import { IconSwap } from "./IconSwap";
import { cn } from "../lib/utils";
import type { Chapter } from "../shared/chapters";

const BARS = 72;

// Cycled by the speed button, starting from 1x.
const SPEEDS = [1, 1.25, 1.5, 2, 0.75];

// The bars are decorative. A real waveform meant downloading and decoding the
// whole file (tens of megabytes for a long episode) before the first bar drew,
// and that download fought the player for bandwidth, so pressing play sat
// silent for ten seconds or more. These are seeded from the title, so an
// episode always looks the same and costs nothing.
function useWaveform(seed: string): number[] {
  return useMemo(() => {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const out: number[] = [];
    for (let i = 0; i < BARS; i++) {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      // Mostly mid-height with the occasional spike, like speech.
      const r = ((h >>> 0) % 1000) / 1000;
      out.push(0.35 + 0.65 * r * r);
    }
    return out;
  }, [seed]);
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Lets the page seek the player, for example from a source's start time.
export type AudioPlayerHandle = { seek: (seconds: number) => void };

export function AudioPlayer({
  src,
  title,
  chapters = [],
  ref,
}: {
  src: string;
  title: string;
  chapters?: Chapter[];
  ref?: Ref<AudioPlayerHandle>;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const peaks = useWaveform(title);
  const trackRef = useRef<HTMLDivElement>(null);
  // How many bars fit: each needs at least 2px plus the 2px gap, so a 320px
  // phone gets a few dozen and a desktop gets all 72.
  const [bars, setBars] = useState(BARS);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setBars(Math.max(16, Math.min(BARS, Math.floor(entry.contentRect.width / 4))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [playing, setPlaying] = useState(false);
  // True between asking for audio and hearing it: the first play, and any
  // later stall. The play button shows a spinner so a slow start reads as
  // loading rather than a dead click.
  const [buffering, setBuffering] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const speed = SPEEDS[speedIndex];
  const progress = duration > 0 ? current / duration : 0;
  const currentChapter = chapters.filter((c) => c.startSeconds <= current).at(-1);

  useImperativeHandle(ref, () => ({
    seek(seconds: number) {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = seconds;
      void audio.play();
    },
  }));

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  function seekTo(fraction: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = fraction * audio.duration;
  }

  function cycleSpeed() {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  }

  // The audio host already has to allow cross origin reads for the waveform
  // decode above, so fetching the file again as a blob adds no new requirement
  // and gives the saved file a real name instead of the object key.
  async function download() {
    setDownloading(true);
    try {
      const blob = await (await fetch(src)).blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${slugify(title)}.mp3`;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      // Fall back to letting the browser open the URL directly.
      window.open(src, "_blank", "noopener");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex items-center gap-4 border bg-secondary p-4">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          setBuffering(true);
        }}
        onPlaying={() => setBuffering(false)}
        onWaiting={() => setBuffering(true)}
        onPause={() => {
          setPlaying(false);
          setBuffering(false);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          e.currentTarget.playbackRate = speed;
        }}
        onEnded={() => setPlaying(false)}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="flex size-12 shrink-0 items-center justify-center bg-primary text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {buffering ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <IconSwap
            active={playing}
            className="size-5"
            activeIcon={<Pause className="size-5 fill-current" />}
            inactiveIcon={<Play className="size-5 translate-x-px fill-current" />}
          />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="relative">
        <div
          ref={trackRef}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-valuetext={`${formatTime(current)} of ${formatTime(duration)}`}
          tabIndex={0}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekTo((e.clientX - rect.left) / rect.width);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") seekTo(Math.min(1, progress + 0.05));
            if (e.key === "ArrowLeft") seekTo(Math.max(0, progress - 0.05));
            if (e.key === "Home") seekTo(0);
            if (e.key === "End") seekTo(1);
          }}
          className="flex h-12 cursor-pointer items-center gap-[2px]"
        >
          {Array.from({ length: bars }, (_, i) => {
            // Sample the fixed peak buckets down to however many bars fit.
            const height = peaks[Math.floor((i * BARS) / bars)];
            const played = i / bars < progress;
            return (
              <span
                key={i}
                style={{ height: `${height * 100}%` }}
                className={cn("flex-1 transition-colors", played ? "bg-rubric" : "bg-foreground/25")}
              />
            );
          })}
        </div>
        {duration > 0 &&
          chapters
            .filter((c) => c.startSeconds > 0)
            .map((c) => (
              <span
                key={c.startSeconds}
                aria-hidden
                className="pointer-events-none absolute inset-y-1 w-px bg-foreground/60"
                style={{ left: `${(c.startSeconds / duration) * 100}%` }}
              />
            ))}
        </div>
        <div className="kicker mt-1 flex items-baseline justify-between gap-3 tabular-nums">
          <span>{formatTime(current)}</span>
          {currentChapter && (
            <span className="min-w-0 truncate text-foreground">{currentChapter.title}</span>
          )}
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={cycleSpeed}
          aria-label={`Playback speed ${speed}x, click to change`}
          className="kicker w-14 tabular-nums"
        >
          {speed}&times;
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={download}
          disabled={downloading}
          aria-label="Download episode"
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "episode"
  );
}
