import {
  FastForward,
  Pause,
  Play,
  Rewind,
  Scissors,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { findFirstIndex } from "@/lib/arrayUtils";

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onSplitAtCurrentWord: () => void;
  canSplitAtCurrentWord: boolean;
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
  playbackRate,
  onPlaybackRateChange,
  onPlayPause,
  onSeek,
  onSkipBack,
  onSkipForward,
  onSplitAtCurrentWord,
  canSplitAtCurrentWord,
  disabled = false,
}: PlaybackControlsProps) {
  const [isMuted, setIsMuted] = useState(false);
  const speedSteps = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const handleSpeedChange = () => {
    const currentIndex = findFirstIndex(speedSteps, (value) => value >= playbackRate - 0.01);
    let nextIndex = currentIndex + 1;
    if (currentIndex < 0) {
      nextIndex = findFirstIndex(speedSteps, (value) => value > 1);
    }
    const nextRate = speedSteps[nextIndex] ?? speedSteps[0];
    onPlaybackRateChange(nextRate);
  };

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
        size="sm"
        variant="ghost"
        onClick={handleSpeedChange}
        disabled={disabled}
        data-testid="button-playback-speed"
        aria-label="Playback speed"
        className="min-w-[48px]"
      >
        {playbackRate.toFixed(2)}x
      </Button>

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

      <Button
        size="icon"
        variant="ghost"
        onClick={onSplitAtCurrentWord}
        disabled={disabled || !canSplitAtCurrentWord}
        data-testid="button-split-current-word"
        aria-label="Split at current word"
      >
        <Scissors className="h-4 w-4" />
      </Button>
    </div>
  );
}
