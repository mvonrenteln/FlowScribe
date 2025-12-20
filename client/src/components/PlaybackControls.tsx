import {
  FastForward,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  disabled?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
}

export function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onSkipBack,
  onSkipForward,
  disabled = false,
}: PlaybackControlsProps) {
  const [isMuted, setIsMuted] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button
        size="icon"
        variant="ghost"
        onClick={onSkipBack}
        disabled={disabled}
        data-testid="button-skip-back"
        aria-label="Skip back 5 seconds"
      >
        <SkipBack className="h-4 w-4" />
      </Button>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => onSeek(Math.max(0, currentTime - 1))}
        disabled={disabled}
        data-testid="button-rewind"
        aria-label="Rewind 1 second"
      >
        <Rewind className="h-4 w-4" />
      </Button>

      <Button
        size="icon"
        variant="default"
        onClick={onPlayPause}
        disabled={disabled}
        data-testid="button-play-pause"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => onSeek(Math.min(duration, currentTime + 1))}
        disabled={disabled}
        data-testid="button-fast-forward"
        aria-label="Fast forward 1 second"
      >
        <FastForward className="h-4 w-4" />
      </Button>

      <Button
        size="icon"
        variant="ghost"
        onClick={onSkipForward}
        disabled={disabled}
        data-testid="button-skip-forward"
        aria-label="Skip forward 5 seconds"
      >
        <SkipForward className="h-4 w-4" />
      </Button>

      <div className="flex-1 mx-4">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={([value]) => onSeek(value)}
          disabled={disabled}
          data-testid="slider-timeline"
          aria-label="Timeline"
        />
      </div>

      <span
        className="text-xs font-mono tabular-nums text-muted-foreground min-w-[80px]"
        data-testid="text-current-time"
      >
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => setIsMuted(!isMuted)}
        disabled={disabled}
        data-testid="button-mute"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}
