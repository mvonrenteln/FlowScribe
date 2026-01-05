import { useCallback, useMemo, useState } from "react";
import type { Segment, Speaker, TranscriptStore } from "@/lib/store/types";
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
  setSelectedSegmentId: TranscriptStore["setSelectedSegmentId"];
  setCurrentTime: TranscriptStore["setCurrentTime"];
  setIsPlaying: TranscriptStore["setIsPlaying"];
  requestSeek: TranscriptStore["requestSeek"];
  onShowExport: () => void;
  onShowShortcuts: () => void;
  onShowSettings: () => void;
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
  setSelectedSegmentId,
  setCurrentTime,
  setIsPlaying,
  requestSeek,
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
    (time: number) => {
      setCurrentTime(time);
      requestSeek(time);
    },
    [requestSeek, setCurrentTime],
  );

  const handleSkipBack = useCallback(() => {
    requestSeek(Math.max(0, currentTime - 5));
  }, [currentTime, requestSeek]);

  const handleSkipForward = useCallback(() => {
    requestSeek(Math.min(duration, currentTime + 5));
  }, [currentTime, duration, requestSeek]);

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
    updateSegmentSpeaker,
    getSelectedSegmentIndex,
    mergeSegments,
    toggleSegmentBookmark,
    confirmSegment,
    deleteSegment,
    setEditRequestId: (id) => setEditRequestId(id),
    requestSeek,
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
    setPlaybackRate,
    handlePlayPause,
    handleSkipBack,
    handleSkipForward,
    getSelectedSegmentIndex,
    handleSeekInternal: handleSeek,
  };
};

export type TranscriptPlaybackState = ReturnType<typeof useTranscriptPlayback>;
