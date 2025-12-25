import { PlaybackControls } from "../PlaybackControls";
import { WaveformPlayer } from "../WaveformPlayer";
import type { TranscriptEditorState } from "./useTranscriptEditor";

type PlaybackPaneProps = TranscriptEditorState["playbackPaneProps"];

export function PlaybackPane({ waveformProps, playbackControlsProps }: PlaybackPaneProps) {
  return (
    <div className="p-4 space-y-4 border-b bg-card">
      <WaveformPlayer {...waveformProps} />
      <PlaybackControls {...playbackControlsProps} />
    </div>
  );
}
