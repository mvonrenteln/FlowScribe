import { useEffect, useRef, useCallback, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import { useTranscriptStore, type Segment, type Speaker } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';

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
  currentTime,
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
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 500;

  const getZoomStep = (value: number) => {
    if (value <= 10) return 1;
    if (value <= 50) return 5;
    return 25;
  };

  const getSpeakerColor = useCallback((speakerName: string) => {
    const speaker = speakers.find(s => s.name === speakerName);
    return speaker?.color || 'hsl(217, 91%, 48%)';
  }, [speakers]);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    setIsLoading(true);
    setIsReady(false);

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'hsl(var(--muted-foreground))',
      progressColor: 'hsl(var(--primary))',
      cursorColor: 'hsl(var(--foreground))',
      cursorWidth: 2,
      height: 128,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      minPxPerSec: 100,
      plugins: [regions],
    });

    wavesurferRef.current = ws;

    ws.load(audioUrl);

    ws.on('ready', () => {
      setIsLoading(false);
      setIsReady(true);
      ws.zoom(zoomLevel);
      onDurationChange(ws.getDuration());
    });

    ws.on('timeupdate', (time) => {
      onTimeUpdate(time);
    });

    ws.on('play', () => onPlayPause(true));
    ws.on('pause', () => onPlayPause(false));

    ws.on('seeking', (time) => {
      onSeek(time);
    });

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
      regionsRef.current = null;
    };
  }, [audioUrl, onDurationChange, onTimeUpdate, onPlayPause, onSeek]);

  useEffect(() => {
    if (!regionsRef.current || !isReady) return;

    regionsRef.current.clearRegions();

    if (!showSpeakerRegions) return;

    segments.forEach((segment) => {
      const color = getSpeakerColor(segment.speaker);
      const region = regionsRef.current!.addRegion({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        color: color.replace(')', ', 0.2)').replace('hsl', 'hsla'),
        drag: false,
        resize: true,
      });

      if (region.element) {
        region.element.classList.add('ws-region');
        region.element.style.border = '0';
        region.element.style.boxShadow = 'none';
        region.element.style.outline = 'none';
        region.element.style.borderLeft = '0';
        region.element.style.borderRight = '0';
        region.element.querySelectorAll('.wavesurfer-handle').forEach((handle) => {
          (handle as HTMLElement).style.background = 'transparent';
        });
      }

      region.on('update-end', () => {
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
    if (!ws || !isReady) return;

    const wsTime = ws.getCurrentTime();
    if (Math.abs(wsTime - currentTime) > 0.5) {
      ws.seekTo(currentTime / ws.getDuration());
    }
  }, [currentTime, isReady]);

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
