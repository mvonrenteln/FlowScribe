import { useCallback, useMemo, useRef } from "react";
import { useTranscriptStore } from "@/lib/store";
import type { SeekMeta, Segment, TranscriptStore } from "@/lib/store/types";
import { useScrollAndSelection } from "./useScrollAndSelection";

export interface SegmentHandlers {
  onSelect: () => void;
  onTextChange: (text: string) => void;
  onSpeakerChange: (speaker: string) => void;
  onSplit: (wordIndex: number) => void;
  onConfirm: () => void;
  onToggleBookmark: () => void;
  onIgnoreLexiconMatch?: (term: string, value: string) => void;
  onMergeWithPrevious?: () => void;
  onMergeWithNext?: () => void;
  onDelete: () => void;
}

interface UseSegmentSelectionParams {
  segments: Segment[];
  filteredSegments: Segment[];
  currentTime: number;
  isPlaying: boolean;
  selectedSegmentId: string | null;
  setSelectedSegmentId: TranscriptStore["setSelectedSegmentId"];
  setCurrentTime: TranscriptStore["setCurrentTime"];
  setIsPlaying: TranscriptStore["setIsPlaying"];
  seekToTime: (time: number, meta: SeekMeta) => void;
  clearSeekRequest: TranscriptStore["clearSeekRequest"];
  splitSegment: TranscriptStore["splitSegment"];
  confirmSegment: TranscriptStore["confirmSegment"];
  toggleSegmentBookmark: TranscriptStore["toggleSegmentBookmark"];
  deleteSegment: TranscriptStore["deleteSegment"];
  updateSegmentText: TranscriptStore["updateSegmentText"];
  updateSegmentSpeaker: TranscriptStore["updateSegmentSpeaker"];
  mergeSegments: TranscriptStore["mergeSegments"];
  addLexiconFalsePositive: TranscriptStore["addLexiconFalsePositive"];
  filterLowConfidence: boolean;
  activeSpeakerName: string | null | undefined;
  lowConfidenceThreshold: number | null;
  isTranscriptEditing: () => boolean;
}

export const useSegmentSelection = ({
  segments,
  filteredSegments,
  currentTime,
  isPlaying,
  selectedSegmentId,
  setSelectedSegmentId,
  setCurrentTime,
  setIsPlaying,
  seekToTime,
  clearSeekRequest,
  splitSegment,
  confirmSegment,
  toggleSegmentBookmark,
  deleteSegment,
  updateSegmentText,
  updateSegmentSpeaker,
  mergeSegments,
  addLexiconFalsePositive,
  filterLowConfidence,
  activeSpeakerName,
  lowConfidenceThreshold,
  isTranscriptEditing,
}: UseSegmentSelectionParams) => {
  const { transcriptListRef, activeSegment } = useScrollAndSelection({
    segments,
    currentTime,
    selectedSegmentId,
    isPlaying,
    isTranscriptEditing,
    activeSpeakerName: activeSpeakerName ?? undefined,
    filteredSegments,
    restrictPlaybackToFiltered: filterLowConfidence,
    lowConfidenceThreshold,
    setSelectedSegmentId,
    seekToTime,
    setIsPlaying,
  });

  const handlerCacheRef = useRef<Map<string, SegmentHandlers>>(new Map());

  const getSelectedSegmentIndex = useCallback(() => {
    return filteredSegments.findIndex((s) => s.id === selectedSegmentId);
  }, [filteredSegments, selectedSegmentId]);

  const selectPreviousSegment = useCallback(() => {
    const currentIndex = getSelectedSegmentIndex();
    if (currentIndex > 0) {
      const segment = filteredSegments[currentIndex - 1];
      setSelectedSegmentId(segment.id);
      seekToTime(segment.start, { source: "hotkey", action: "arrow" });
    } else if (currentIndex === -1 && filteredSegments.length > 0) {
      const segment = filteredSegments[filteredSegments.length - 1];
      setSelectedSegmentId(segment.id);
      seekToTime(segment.start, { source: "hotkey", action: "arrow" });
    }
  }, [filteredSegments, getSelectedSegmentIndex, seekToTime, setSelectedSegmentId]);

  const selectNextSegment = useCallback(() => {
    const currentIndex = getSelectedSegmentIndex();
    if (currentIndex < filteredSegments.length - 1) {
      const segment = filteredSegments[currentIndex + 1];
      setSelectedSegmentId(segment.id);
      seekToTime(segment.start, { source: "hotkey", action: "arrow" });
    } else if (currentIndex === -1 && filteredSegments.length > 0) {
      const segment = filteredSegments[0];
      setSelectedSegmentId(segment.id);
      seekToTime(segment.start, { source: "hotkey", action: "arrow" });
    }
  }, [filteredSegments, getSelectedSegmentIndex, seekToTime, setSelectedSegmentId]);

  const getSplitWordIndex = useCallback(() => {
    if (!activeSegment) return null;
    const { words } = activeSegment;
    if (words.length < 2) return null;
    let index = words.findIndex((word) => currentTime >= word.start && currentTime <= word.end);
    if (index === -1) {
      index = words.findIndex((word) => currentTime < word.start);
      if (index === -1) {
        index = words.length - 1;
      }
    }
    if (index <= 0) {
      return words.length > 1 ? 1 : null;
    }
    if (index >= words.length) return null;
    return index;
  }, [activeSegment, currentTime]);

  const handleSplitSegment = useCallback(
    (segmentId: string, wordIndex: number) => {
      const wasPlaying = isPlaying;
      const resumeTime = currentTime;
      splitSegment(segmentId, wordIndex);
      if (wasPlaying) {
        setCurrentTime(resumeTime);
        clearSeekRequest();
      }
    },
    [clearSeekRequest, currentTime, isPlaying, setCurrentTime, splitSegment],
  );

  const handleSplitAtCurrentWord = useCallback(() => {
    const index = getSplitWordIndex();
    if (index === null || !activeSegment) return;
    handleSplitSegment(activeSegment.id, index);
  }, [activeSegment, getSplitWordIndex, handleSplitSegment]);

  const splitWordIndex = getSplitWordIndex();
  const canSplitAtCurrentWord = splitWordIndex !== null;

  const activeSegmentId = activeSegment?.id ?? null;
  const activeWordIndex = useMemo(() => {
    if (!activeSegment) return -1;
    return activeSegment.words.findIndex((w) => currentTime >= w.start && currentTime <= w.end);
  }, [activeSegment, currentTime]);

  const segmentHandlers = useMemo(() => {
    const currentIds = new Set(segments.map((s) => s.id));
    for (const id of Array.from(handlerCacheRef.current.keys())) {
      if (!currentIds.has(id)) {
        handlerCacheRef.current.delete(id);
      }
    }

    const segmentIndexById = new Map(segments.map((segment, idx) => [segment.id, idx]));

    return filteredSegments.map((segment, index) => {
      let handlers = handlerCacheRef.current.get(segment.id) as SegmentHandlers | undefined;

      const previousSegment = filteredSegments[index - 1];
      const nextSegment = filteredSegments[index + 1];

      const areAdjacent = (idA: string, idB: string) => {
        const indexA = segmentIndexById.get(idA);
        const indexB = segmentIndexById.get(idB);
        if (indexA === undefined || indexB === undefined) return false;
        return Math.abs(indexA - indexB) === 1;
      };

      if (!handlers) {
        handlers = {
          onSelect: () => {
            const current = useTranscriptStore.getState().segments.find((s) => s.id === segment.id);
            if (current) {
              setSelectedSegmentId(current.id);
              seekToTime(current.start, { source: "transcript", action: "segment_click" });
            }
          },
          onTextChange: (text: string) => updateSegmentText(segment.id, text),
          onSpeakerChange: (speaker: string) => updateSegmentSpeaker(segment.id, speaker),
          onSplit: (wordIndex: number) => handleSplitSegment(segment.id, wordIndex),
          onConfirm: () => confirmSegment(segment.id),
          onToggleBookmark: () => toggleSegmentBookmark(segment.id),
          onIgnoreLexiconMatch: (term: string, value: string) =>
            addLexiconFalsePositive(term, value),
          onDelete: () => deleteSegment(segment.id),
        };
        handlerCacheRef.current.set(segment.id, handlers);
      }

      handlers.onMergeWithPrevious =
        index > 0 && previousSegment && areAdjacent(previousSegment.id, segment.id)
          ? () => {
              const currentMergedId = mergeSegments(previousSegment.id, segment.id);
              if (currentMergedId) setSelectedSegmentId(currentMergedId);
            }
          : undefined;

      handlers.onMergeWithNext =
        index < filteredSegments.length - 1 &&
        nextSegment &&
        areAdjacent(segment.id, nextSegment.id)
          ? () => {
              const currentMergedId = mergeSegments(segment.id, nextSegment.id);
              if (currentMergedId) setSelectedSegmentId(currentMergedId);
            }
          : undefined;

      return handlers;
    });
  }, [
    addLexiconFalsePositive,
    confirmSegment,
    deleteSegment,
    filteredSegments,
    handleSplitSegment,
    mergeSegments,
    segments,
    seekToTime,
    setSelectedSegmentId,
    toggleSegmentBookmark,
    updateSegmentSpeaker,
    updateSegmentText,
  ]);

  return {
    transcriptListRef,
    activeSegment,
    activeSegmentId,
    activeWordIndex,
    splitWordIndex,
    canSplitAtCurrentWord,
    handleSplitAtCurrentWord,
    segmentHandlers,
    selectPreviousSegment,
    selectNextSegment,
    getSelectedSegmentIndex,
  };
};

export type SegmentSelectionState = ReturnType<typeof useSegmentSelection>;
