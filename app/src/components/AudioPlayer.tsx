import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Pause, Play } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

const BARS = 72;

// Cycled by the speed button, starting from 1x.
const SPEEDS = [1, 1.25, 1.5, 2, 0.75];

// Decode the episode audio once to draw a real waveform. If the fetch or decode
// fails (CORS on the audio host, an unsupported file) the player still works and
// falls back to flat bars.
function useWaveform(url: string): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPeaks(null);

    (async () => {
      try {
        const bytes = await (await fetch(url)).arrayBuffer();
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(bytes);
        await ctx.close();

        const samples = decoded.getChannelData(0);
        const bucket = Math.floor(samples.length / BARS);
        const out: number[] = [];
        for (let i = 0; i < BARS; i++) {
          let peak = 0;
          for (let j = 0; j < bucket; j++) {
            const v = Math.abs(samples[i * bucket + j]);
            if (v > peak) peak = v;
          }
          out.push(peak);
        }
        const max = Math.max(...out, 0.0001);
        if (!cancelled) setPeaks(out.map((v) => v / max));
      } catch {
        if (!cancelled) setPeaks(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return peaks;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ src, title }: { src: string; title: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const peaks = useWaveform(src);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const speed = SPEEDS[speedIndex];

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

  const progress = duration > 0 ? current / duration : 0;

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

  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
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
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        {playing ? (
          <Pause className="size-5 fill-current" />
        ) : (
          <Play className="size-5 translate-x-px fill-current" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekTo((e.clientX - rect.left) / rect.width);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") seekTo(Math.min(1, progress + 0.05));
            if (e.key === "ArrowLeft") seekTo(Math.max(0, progress - 0.05));
          }}
          className="flex h-12 cursor-pointer items-center gap-[2px] focus-visible:outline-none"
        >
          {Array.from({ length: BARS }, (_, i) => {
            const height = peaks ? 0.15 + peaks[i] * 0.85 : 0.25;
            const played = i / BARS < progress;
            return (
              <span
                key={i}
                style={{ height: `${height * 100}%` }}
                className={cn(
                  "flex-1 rounded-full transition-colors",
                  played ? "bg-primary" : "bg-muted-foreground/30",
                  !peaks && "animate-pulse",
                )}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground">
          <span>{formatTime(current)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={cycleSpeed}
          aria-label={`Playback speed ${speed}x, click to change`}
          className="w-14 tabular-nums"
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
