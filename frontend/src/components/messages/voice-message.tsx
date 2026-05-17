"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceMessageProps {
  url: string;
  /** True when this is the current user's own message — flips the color theme. */
  isOwn: boolean;
}

/**
 * Industry-standard voice-message player: round play/pause button, scrubbable
 * progress bar, mm:ss elapsed / total. Themed white-on-primary for own bubbles,
 * primary-on-light for received. Built on the native <audio> element so we get
 * caching/streaming for free.
 */
export function VoiceMessage({ url, isOwn }: VoiceMessageProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Pause + reset state when the source URL changes (e.g. message edited).
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.currentTime = 0;
      }
    };
  }, [url]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => {
        // Autoplay rules etc. — surface as paused.
        setIsPlaying(false);
      });
    } else {
      a.pause();
    }
  };

  const onLoaded = () => {
    const a = audioRef.current;
    if (!a) return;
    // Cloudinary sometimes returns Infinity for streamable durations until the
    // user seeks. The duration in <audio> resolves once playback starts.
    if (Number.isFinite(a.duration) && a.duration > 0) {
      setDuration(a.duration);
    }
  };

  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a) return;
    setCurrentTime(a.currentTime);
    // Late-resolved duration (see onLoaded comment).
    if (
      duration === 0 &&
      Number.isFinite(a.duration) &&
      a.duration > 0
    ) {
      setDuration(a.duration);
    }
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const next = Number(e.target.value);
    a.currentTime = next;
    setCurrentTime(next);
  };

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-1 min-w-[220px]",
        isOwn ? "text-white" : "text-secondary-900",
      )}
    >
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={onLoaded}
        onDurationChange={onLoaded}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        className="hidden"
      />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
          isOwn
            ? "bg-white/20 text-white hover:bg-white/30"
            : "bg-primary-600 text-white hover:bg-primary-700",
        )}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="ml-0.5 h-4 w-4" />
        )}
      </button>
      <div className="flex-1">
        <div
          className={cn(
            "relative h-1.5 w-full overflow-hidden rounded-full",
            isOwn ? "bg-white/25" : "bg-secondary-300",
          )}
        >
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-150",
              isOwn ? "bg-white" : "bg-primary-600",
            )}
            style={{ width: `${progress}%` }}
          />
          {/* Scrubber — invisible overlay so the bar above stays the visual. */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={onSeek}
            disabled={!duration}
            aria-label="Seek"
            className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent opacity-0"
          />
        </div>
        <p
          className={cn(
            "mt-1 font-mono text-[11px] tabular-nums",
            isOwn ? "text-white/80" : "text-secondary-500",
          )}
        >
          {fmt(currentTime)} / {fmt(duration)}
        </p>
      </div>
    </div>
  );
}
