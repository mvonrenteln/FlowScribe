import { useState } from 'react';
import { PlaybackControls } from '../PlaybackControls';

export default function PlaybackControlsExample() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(45.5);
  const duration = 180;

  return (
    <div className="p-4 bg-card rounded-lg">
      <PlaybackControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onSeek={(time) => setCurrentTime(time)}
        onSkipBack={() => setCurrentTime(Math.max(0, currentTime - 5))}
        onSkipForward={() => setCurrentTime(Math.min(duration, currentTime + 5))}
      />
    </div>
  );
}
