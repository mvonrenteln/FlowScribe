import { useEffect, useRef, useCallback, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import { useTranscriptStore, type Segment, type Speaker } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';

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
      plugins: [regions],
    });

    wavesurferRef.current = ws;

    ws.load(audioUrl);

    ws.on('ready', () => {
      setIsLoading(false);
      setIsReady(true);
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
      <div 
        ref={containerRef} 
        id="waveform"
        className="h-32 rounded-lg bg-card"
        data-testid="waveform-container"
      />
    </div>
  );
}
