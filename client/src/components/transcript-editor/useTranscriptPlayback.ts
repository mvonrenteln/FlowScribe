import { useCallback, useMemo, useState } from "react";
import type { SeekMeta, Segment, Speaker, Tag, TranscriptStore } from "@/lib/store/types";
import { useNavigationHotkeys } from "./useNavigationHotkeys";

interface UseTranscriptPlaybackParams {
  isTranscriptEditing: () => boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  filteredSegments: Segment[];
  selectedSegmentId: string | null;
  segments: Segment[];
  speakers: Speaker[];
  tags: Tag[];
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
  handleSplitAtCurrentWord: () => void;
  canSplitAtCurrentWord: boolean;
  selectPreviousSegment: () => void;
  selectNextSegment: () => void;
  mergeSegments: TranscriptStore["mergeSegments"];
  toggleSegmentBookmark: TranscriptStore["toggleSegmentBookmark"];
  confirmSegment: TranscriptStore["confirmSegment"];
  deleteSegment: TranscriptStore["deleteSegment"];
  updateSegmentSpeaker: TranscriptStore["updateSegmentSpeaker"];
  toggleTagOnSegment: TranscriptStore["toggleTagOnSegment"];
  setSelectedSegmentId: TranscriptStore["setSelectedSegmentId"];
  setIsPlaying: TranscriptStore["setIsPlaying"];
  seekToTime: TranscriptStore["seekToTime"];
  onShowExport: () => void;
  onShowShortcuts: () => void;
  onShowSettings: () => void;
  onShowGlossary: () => void;
  onRunDefaultAIRevision: () => void;
  onOpenAIRevisionMenu: () => void;
  onOpenAISegmentMerge: () => void;
  setEditRequestId: (id: string | null) => void;
  onClearSpeakerFilter: () => void;
  hasAudioSource: boolean;
}

export const useTranscriptPlayback = ({
  isTranscriptEditing,
  isPlaying,
  currentTime,
  duration,
  filteredSegments,
  selectedSegmentId,
  segments,
  speakers,
  tags,
  canUndo,
  canRedo,
  undo,
  redo,
  handleSplitAtCurrentWord,
  canSplitAtCurrentWord,
  selectPreviousSegment,
  selectNextSegment,
  mergeSegments,
  toggleSegmentBookmark,
  confirmSegment,
  deleteSegment,
  updateSegmentSpeaker,
  toggleTagOnSegment,
  setSelectedSegmentId,
  setIsPlaying,
  seekToTime,
  onShowExport,
  onShowShortcuts,
  onShowSettings,
  onRunDefaultAIRevision,
  onOpenAIRevisionMenu,
  onOpenAISegmentMerge,
  setEditRequestId,
  onClearSpeakerFilter,
  hasAudioSource,
}: UseTranscriptPlaybackParams) => {
  const [playbackRate, setPlaybackRate] = useState(1);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying, setIsPlaying]);

  const handleSeek = useCallback(
    (time: number, meta?: SeekMeta) => {
      seekToTime(time, meta ?? { source: "transcript", action: "controls" });
    },
    [seekToTime],
  );

  const handleWaveformSeek = useCallback(
    (time: number) => {
      seekToTime(time, { source: "waveform" });
    },
    [seekToTime],
  );

  const handleSkipBack = useCallback(() => {
    seekToTime(currentTime - 5, { source: "transcript", action: "controls" });
  }, [currentTime, seekToTime]);

  const handleSkipForward = useCallback(() => {
    seekToTime(currentTime + 5, { source: "transcript", action: "controls" });
  }, [currentTime, seekToTime]);

  const getSelectedSegmentIndex = useCallback(() => {
    return filteredSegments.findIndex((s) => s.id === selectedSegmentId);
  }, [filteredSegments, selectedSegmentId]);

  useNavigationHotkeys({
    isTranscriptEditing,
    handleSkipBack,
    handleSkipForward,
    handleSeek,
    duration,
    currentTime,
    handlePlayPause,
    setSelectedSegmentId,
    clearSpeakerFilter: onClearSpeakerFilter,
    selectedSegmentId,
    segments,
    speakers,
    tags,
    updateSegmentSpeaker,
    toggleTagOnSegment,
    getSelectedSegmentIndex,
    mergeSegments,
    toggleSegmentBookmark,
    confirmSegment,
    deleteSegment,
    setEditRequestId: (id) => setEditRequestId(id),
    seekToTime,
    setIsPlaying,
    handleSplitAtCurrentWord,
    canUndo,
    canRedo,
    undo,
    redo,
    selectPreviousSegment,
    selectNextSegment,
    onShowExport,
    onShowShortcuts,
    onShowSettings,
    onRunDefaultAIRevision,
    onOpenAIRevisionMenu,
    onOpenAISegmentMerge,
  });

  const playbackControlsProps = useMemo(
    () => ({
      isPlaying,
      currentTime,
      duration,
      playbackRate,
      onPlaybackRateChange: setPlaybackRate,
      onPlayPause: handlePlayPause,
      onSeek: handleSeek,
      onSkipBack: handleSkipBack,
      onSkipForward: handleSkipForward,
      onSplitAtCurrentWord: handleSplitAtCurrentWord,
      canSplitAtCurrentWord,
      disabled: !hasAudioSource,
    }),
    [
      canSplitAtCurrentWord,
      currentTime,
      duration,
      handlePlayPause,
      handleSeek,
      handleSkipBack,
      handleSkipForward,
      handleSplitAtCurrentWord,
      isPlaying,
      playbackRate,
      hasAudioSource,
    ],
  );

  return {
    playbackControlsProps,
    playbackRate,
    handleSeek,
    handleWaveformSeek,
    setPlaybackRate,
    handlePlayPause,
    handleSkipBack,
    handleSkipForward,
    getSelectedSegmentIndex,
    handleSeekInternal: handleSeek,
  };
};

export type TranscriptPlaybackState = ReturnType<typeof useTranscriptPlayback>;
