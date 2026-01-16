import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import MinimapPlugin from "wavesurfer.js/dist/plugins/minimap.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type Segment, type Speaker, useTranscriptStore } from "@/lib/store";

interface WaveformPlayerProps {
  audioUrl: string | null;
  segments: Segment[];
  speakers: Speaker[];
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  showSpeakerRegions: boolean;
  onTimeUpdate: (time: number) => void;
  onPlayPause: (playing: boolean) => void;
  onDurationChange: (duration: number) => void;
  onSeek: (time: number, meta?: { source?: "waveform" | "programmatic" | "unknown" }) => void;
  onSegmentBoundaryChange?: (segmentId: string, start: number, end: number) => void;
  onReady?: () => void;
}

export function WaveformPlayer({
  audioUrl,
  segments,
  speakers,
  currentTime: _currentTime,
  isPlaying,
  playbackRate,
  showSpeakerRegions,
  onTimeUpdate,
  onPlayPause,
  onDurationChange,
  onSeek,
  onSegmentBoundaryChange,
  onReady,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const minimapRef = useRef<MinimapPlugin | null>(null);
  const hasAudioRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const zoomLevelRef = useRef(zoomLevel);
  const frameRequestRef = useRef<number | null>(null);
  const pendingTimeRef = useRef<number | null>(null);
  const currentTimeRef = useRef(_currentTime);
  const initialSeekAppliedRef = useRef(false);
  const seekRequestTime = useTranscriptStore((state) => state.seekRequestTime);
  const clearSeekRequest = useTranscriptStore((state) => state.clearSeekRequest);

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 500;

  const getZoomStep = (value: number) => {
    if (value <= 10) return 1;
    if (value <= 50) return 5;
    return 25;
  };

  const getSpeakerColor = useCallback(
    (speakerName: string) => {
      const speaker = speakers.find((s) => s.name === speakerName);
      return speaker?.color || "hsl(217, 91%, 48%)";
    },
    [speakers],
  );

  const getWaveColors = useCallback(() => {
    const styles = getComputedStyle(document.documentElement);
    const pick = (name: string) => styles.getPropertyValue(name).trim();
    return {
      waveColor: `hsl(${pick("--wave-color")})`,
      progressColor: `hsl(${pick("--wave-progress")})`,
      cursorColor: `hsl(${pick("--foreground")})`,
      minimapWaveColor: `hsl(${pick("--wave-minimap")})`,
      minimapProgressColor: `hsl(${pick("--wave-minimap-progress")})`,
    };
  }, []);

  const withAlpha = useCallback((color: string, alpha: number) => {
    const trimmed = color.trim();
    if (trimmed.startsWith("hsla(")) return trimmed;
    if (trimmed.startsWith("hsl(")) {
      const inner = trimmed.slice(4, -1).trim();
      if (inner.includes("/")) {
        return `hsl(${inner.replace(/\s*\/\s*.+$/, ` / ${alpha}`)})`;
      }
      if (inner.includes(",")) {
        return `hsla(${inner}, ${alpha})`;
      }
      return `hsl(${inner} / ${alpha})`;
    }
    return color;
  }, []);

  const scheduleTimeUpdate = useCallback(
    (time: number) => {
      pendingTimeRef.current = time;
      if (frameRequestRef.current !== null) return;
      frameRequestRef.current = requestAnimationFrame(() => {
        frameRequestRef.current = null;
        if (pendingTimeRef.current !== null) {
          onTimeUpdate(pendingTimeRef.current);
        }
      });
    },
    [onTimeUpdate],
  );

  const applyWaveColors = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const colors = getWaveColors();
    ws.setOptions({
      waveColor: colors.waveColor,
      progressColor: colors.progressColor,
      cursorColor: colors.cursorColor,
    });

    if (minimapRef.current) {
      minimapRef.current.destroy();
      minimapRef.current = null;
    }

    const minimap = MinimapPlugin.create({
      height: 24,
      waveColor: colors.minimapWaveColor,
      progressColor: colors.minimapProgressColor,
    });
    minimapRef.current = minimap;
    ws.registerPlugin(minimap);
  }, [getWaveColors]);

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    currentTimeRef.current = _currentTime;
  }, [_currentTime]);

  useEffect(() => {
    return () => {
      if (frameRequestRef.current !== null) {
        cancelAnimationFrame(frameRequestRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    setIsLoading(true);
    setIsReady(false);
    initialSeekAppliedRef.current = false;

    // DEV-only: allow disabling regions to run perf A/B tests
    const devDisableRegions =
      import.meta.env.DEV && (globalThis as any).__DEV_DISABLE_REGIONS === true;
    let regions: RegionsPlugin | null = null;
    if (!devDisableRegions) {
      regions = RegionsPlugin.create();
      regionsRef.current = regions;
    } else {
      regionsRef.current = null;
    }
    const colors = getWaveColors();
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: colors.waveColor,
      progressColor: colors.progressColor,
      cursorColor: colors.cursorColor,
      cursorWidth: 2,
      height: 128,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      minPxPerSec: 100,
      hideScrollbar: true,
      autoCenter: false,
      plugins: regions ? [regions] : [],
    });

    wavesurferRef.current = ws;
    applyWaveColors();

    const loadResult = ws.load(audioUrl);
    if (loadResult && typeof (loadResult as Promise<void>).catch === "function") {
      void (loadResult as Promise<void>).catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("WaveSurfer load failed:", error);
      });
    }

    ws.on("error", (error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("WaveSurfer error:", error);
    });

    ws.on("ready", () => {
      setIsLoading(false);
      setIsReady(true);
      hasAudioRef.current = true;
      onReady?.();
      const containerWidth = containerRef.current?.clientWidth || ws.getWrapper()?.clientWidth || 0;
      if (containerWidth > 0) {
        const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, containerWidth / 240));
        setZoomLevel(targetZoom);
        ws.zoom(targetZoom);
      } else {
        ws.zoom(zoomLevelRef.current);
      }
      const duration = ws.getDuration();
      onDurationChange(duration);
      if (!initialSeekAppliedRef.current && currentTimeRef.current > 0 && duration > 0) {
        const clampedTime = Math.max(0, Math.min(duration, currentTimeRef.current));
        ws.setTime(clampedTime);
        initialSeekAppliedRef.current = true;
      }
    });

    ws.on("timeupdate", (time) => {
      scheduleTimeUpdate(time);
    });

    ws.on("play", () => onPlayPause(true));
    ws.on("pause", () => onPlayPause(false));

    const handleSeekEvent = (time?: number) => {
      const nextTime = typeof time === "number" ? time : ws.getCurrentTime();
      onSeek(nextTime, { source: "waveform" });
    };

    ws.on("seeking", handleSeekEvent);
    ws.on("interaction", handleSeekEvent);

    return () => {
      try {
        if (minimapRef.current) {
          minimapRef.current.destroy();
          minimapRef.current = null;
        }
        ws.destroy();
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("WaveSurfer destroy failed:", error);
        }
      }
      hasAudioRef.current = false;
      wavesurferRef.current = null;
      regionsRef.current = null;
    };
  }, [
    audioUrl,
    onDurationChange,
    onPlayPause,
    onSeek,
    onReady,
    applyWaveColors,
    getWaveColors,
    scheduleTimeUpdate,
  ]);

  useEffect(() => {
    if (!wavesurferRef.current) return;
    const observer = new MutationObserver(() => applyWaveColors());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [applyWaveColors]);



  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isReady) return;

    if (isPlaying && !ws.isPlaying()) {
      ws.play();
    } else if (!isPlaying && ws.isPlaying()) {
      ws.pause();
    }
  }, [isPlaying, isReady]);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isReady) return;
    ws.setPlaybackRate(playbackRate);
  }, [isReady, playbackRate]);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isReady || seekRequestTime === null) return;
    const duration = ws.getDuration();
    if (!Number.isFinite(duration) || duration <= 0) return;
    const time = Math.max(0, Math.min(duration, seekRequestTime));
    if (Math.abs(ws.getCurrentTime() - time) <= 0.02) {
      clearSeekRequest();
      return;
    }
    ws.setTime(time);
    clearSeekRequest();
  }, [seekRequestTime, isReady, clearSeekRequest]);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isReady) return;
    if (!hasAudioRef.current) return;
    const duration = ws.getDuration();
    if (!Number.isFinite(duration) || duration <= 0) return;
    try {
      ws.zoom(zoomLevel);
    } catch (error) {
      console.warn("WaveSurfer zoom skipped:", error);
    }
  }, [zoomLevel, isReady]);

  if (!audioUrl) {
    return (
      <div className="h-32 flex items-center justify-center bg-muted rounded-lg border border-dashed">
        <span className="text-muted-foreground text-sm">
          Load an audio file to view the waveform
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 z-10">
          <Skeleton className="h-32 w-full" />
        </div>
      )}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-md bg-card/80 p-1 backdrop-blur pointer-events-auto">
        <Button
          size="icon"
          variant="ghost"
          className="text-foreground"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setZoomLevel((prev) => Math.max(MIN_ZOOM, prev - getZoomStep(prev)));
          }}
          disabled={!audioUrl || zoomLevel <= MIN_ZOOM}
          aria-label="Zoom out"
          data-testid="button-zoom-out"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-foreground"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setZoomLevel((prev) => Math.min(MAX_ZOOM, prev + getZoomStep(prev)));
          }}
          disabled={!audioUrl || zoomLevel >= MAX_ZOOM}
          aria-label="Zoom in"
          data-testid="button-zoom-in"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={containerRef}
        id="waveform"
        className="h-32 rounded-lg bg-card"
        data-testid="waveform-container"
      />
    </div>
  );
}
