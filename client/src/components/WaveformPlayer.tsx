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
  showSpeakerRegions: boolean;
  onTimeUpdate: (time: number) => void;
  onPlayPause: (playing: boolean) => void;
  onDurationChange: (duration: number) => void;
  onSeek: (time: number) => void;
  onSegmentBoundaryChange?: (segmentId: string, start: number, end: number) => void;
}

export function WaveformPlayer({
  audioUrl,
  segments,
  speakers,
  currentTime: _currentTime,
  isPlaying,
  showSpeakerRegions,
  onTimeUpdate,
  onPlayPause,
  onDurationChange,
  onSeek,
  onSegmentBoundaryChange,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const minimapRef = useRef<MinimapPlugin | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
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
    if (!containerRef.current || !audioUrl) return;

    setIsLoading(true);
    setIsReady(false);

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;
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
      plugins: [regions],
    });

    wavesurferRef.current = ws;
    applyWaveColors();

    ws.load(audioUrl);

    ws.on("ready", () => {
      setIsLoading(false);
      setIsReady(true);
      const containerWidth = containerRef.current?.clientWidth || ws.getWrapper()?.clientWidth || 0;
      if (containerWidth > 0) {
        const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, containerWidth / 240));
        setZoomLevel(targetZoom);
        ws.zoom(targetZoom);
      } else {
        ws.zoom(zoomLevel);
      }
      onDurationChange(ws.getDuration());
    });

    ws.on("timeupdate", (time) => {
      onTimeUpdate(time);
    });

    ws.on("play", () => onPlayPause(true));
    ws.on("pause", () => onPlayPause(false));

    ws.on("seeking", (time) => {
      onSeek(time);
    });

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
      wavesurferRef.current = null;
      regionsRef.current = null;
    };
  }, [
    audioUrl,
    onDurationChange,
    onTimeUpdate,
    onPlayPause,
    onSeek,
    applyWaveColors,
    getWaveColors,
  ]);

  useEffect(() => {
    if (!wavesurferRef.current) return;
    const observer = new MutationObserver(() => applyWaveColors());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [applyWaveColors]);

  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions || !isReady) return;

    regions.clearRegions();

    if (!showSpeakerRegions) return;

    segments.forEach((segment) => {
      const color = getSpeakerColor(segment.speaker);
      const region = regions.addRegion({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        color: color.replace(")", ", 0.2)").replace("hsl", "hsla"),
        drag: false,
        resize: true,
      });

      if (region.element) {
        region.element.classList.add("ws-region");
        region.element.style.border = "0";
        region.element.style.boxShadow = "none";
        region.element.style.outline = "none";
        region.element.style.borderLeft = "0";
        region.element.style.borderRight = "0";
        region.element.querySelectorAll(".wavesurfer-handle").forEach((handle) => {
          (handle as HTMLElement).style.background = "transparent";
        });
      }

      region.on("update-end", () => {
        if (onSegmentBoundaryChange) {
          onSegmentBoundaryChange(segment.id, region.start, region.end);
        }
      });
    });
  }, [segments, speakers, isReady, showSpeakerRegions, getSpeakerColor, onSegmentBoundaryChange]);

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
    if (!ws || !isReady || seekRequestTime === null) return;
    const duration = ws.getDuration();
    if (!Number.isFinite(duration) || duration <= 0) return;
    const time = Math.max(0, Math.min(duration, seekRequestTime));
    ws.setTime(time);
    clearSeekRequest();
  }, [seekRequestTime, isReady, clearSeekRequest]);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isReady) return;
    ws.zoom(zoomLevel);
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
