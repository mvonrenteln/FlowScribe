import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { getSegmentById, useSegmentIndexById } from "@/lib/store";
import type { SeekMeta, Segment, TranscriptStore } from "@/lib/store/types";
import { getWordIndexForTime } from "@/lib/utils/wordIndexCache";

export { getWordIndexForTime } from "@/lib/utils/wordIndexCache";

import { useScrollAndSelection } from "./useScrollAndSelection";

export interface SegmentHandlers {
  onSelect: () => void;
  onSelectOnly?: () => void;
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
  addLexiconSessionIgnore: TranscriptStore["addLexiconSessionIgnore"];
  selectChapterForSegment: TranscriptStore["selectChapterForSegment"];
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
  addLexiconSessionIgnore,
  selectChapterForSegment,
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
  const mergeHandlerCacheRef = useRef<Map<string, { prev: () => void; next: () => void }>>(
    new Map(),
  );
  const filteredSegmentsRef = useRef(filteredSegments);
  const filteredIndexByIdRef = useRef(new Map<string, number>());
  const segmentIndexByIdRef = useRef(new Map<string, number>());
  const mergeSegmentsRef = useRef(mergeSegments);
  const setSelectedSegmentIdRef = useRef(setSelectedSegmentId);

  const getSelectedSegmentIndex = useCallback(() => {
    return filteredIndexByIdRef.current.get(selectedSegmentId ?? "") ?? -1;
  }, [selectedSegmentId]);

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
    const index = getWordIndexForTime(words, currentTime);
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
    return getWordIndexForTime(activeSegment.words, currentTime);
  }, [activeSegment, currentTime]);

  useEffect(() => {
    filteredSegmentsRef.current = filteredSegments;
    filteredIndexByIdRef.current = new Map(
      filteredSegments.map((segment, index) => [segment.id, index]),
    );
  }, [filteredSegments]);

  const segmentIndexById = useSegmentIndexById();
  useEffect(() => {
    segmentIndexByIdRef.current = segmentIndexById;
  }, [segmentIndexById]);

  useEffect(() => {
    mergeSegmentsRef.current = mergeSegments;
    setSelectedSegmentIdRef.current = setSelectedSegmentId;
  }, [mergeSegments, setSelectedSegmentId]);

  const segmentHandlers = useMemo(() => {
    // Defensive: ensure handlerCacheRef.current is initialized (HMR/dev can cause transient undefined)
    if (!handlerCacheRef.current) handlerCacheRef.current = new Map<string, SegmentHandlers>();
    const currentIds = new Set(segments.map((s) => s.id));
    for (const id of Array.from(handlerCacheRef.current.keys())) {
      if (!currentIds.has(id)) {
        handlerCacheRef.current.delete(id);
      }
    }
    for (const id of Array.from(mergeHandlerCacheRef.current.keys())) {
      if (!currentIds.has(id)) {
        mergeHandlerCacheRef.current.delete(id);
      }
    }

    const segmentIndexById = new Map(segments.map((segment, idx) => [segment.id, idx]));
    const filteredIndexById = new Map(
      filteredSegments.map((segment, index) => [segment.id, index]),
    );
    const getMergeHandlers = (segmentId: string) => {
      let handlers = mergeHandlerCacheRef.current.get(segmentId);
      if (!handlers) {
        handlers = {
          prev: () => {
            const filteredIndex = filteredIndexByIdRef.current.get(segmentId);
            if (filteredIndex === undefined || filteredIndex <= 0) return;
            const previous = filteredSegmentsRef.current[filteredIndex - 1];
            if (!previous) return;
            const indexA = segmentIndexByIdRef.current.get(previous.id);
            const indexB = segmentIndexByIdRef.current.get(segmentId);
            if (indexA === undefined || indexB === undefined) return;
            if (Math.abs(indexA - indexB) !== 1) return;
            const mergedId = mergeSegmentsRef.current(previous.id, segmentId);
            if (mergedId) setSelectedSegmentIdRef.current(mergedId);
          },
          next: () => {
            const filteredIndex = filteredIndexByIdRef.current.get(segmentId);
            if (filteredIndex === undefined) return;
            const next = filteredSegmentsRef.current[filteredIndex + 1];
            if (!next) return;
            const indexA = segmentIndexByIdRef.current.get(segmentId);
            const indexB = segmentIndexByIdRef.current.get(next.id);
            if (indexA === undefined || indexB === undefined) return;
            if (Math.abs(indexA - indexB) !== 1) return;
            const mergedId = mergeSegmentsRef.current(segmentId, next.id);
            if (mergedId) setSelectedSegmentIdRef.current(mergedId);
          },
        };
        mergeHandlerCacheRef.current.set(segmentId, handlers);
      }
      return handlers;
    };

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
            const current = getSegmentById(segment.id);
            if (current) {
              setSelectedSegmentId(current.id);
              seekToTime(current.start, { source: "transcript", action: "segment_click" });
            }
          },
          onSelectOnly: () => {
            const current = getSegmentById(segment.id);
            if (current) {
              setSelectedSegmentId(current.id);
            }
          },
          onTextChange: (text: string) => {
            // Check if segment belongs to chapter with rewrite
            // Use memoized selectChapterForSegment instead of O(n²) findIndex loops
            const chapter = selectChapterForSegment(segment.id);
            if (chapter?.rewrittenText) {
              toast({
                title: "Rewritten text is based on older content",
                description: "Consider regenerating the rewrite.",
              });
            }
            updateSegmentText(segment.id, text);
          },
          onSpeakerChange: (speaker: string) => updateSegmentSpeaker(segment.id, speaker),
          onSplit: (wordIndex: number) => handleSplitSegment(segment.id, wordIndex),
          onConfirm: () => confirmSegment(segment.id),
          onToggleBookmark: () => toggleSegmentBookmark(segment.id),
          onIgnoreLexiconMatch: (term: string, value: string) =>
            addLexiconSessionIgnore(term, value),
          onDelete: () => deleteSegment(segment.id),
        };
        handlerCacheRef.current.set(segment.id, handlers);
      }

      const mergeHandlers = getMergeHandlers(segment.id);
      const currentFilteredIndex = filteredIndexById.get(segment.id);
      const canMergePrev =
        currentFilteredIndex !== undefined &&
        currentFilteredIndex > 0 &&
        previousSegment &&
        areAdjacent(previousSegment.id, segment.id);
      const canMergeNext =
        currentFilteredIndex !== undefined &&
        currentFilteredIndex < filteredSegments.length - 1 &&
        nextSegment &&
        areAdjacent(segment.id, nextSegment.id);

      handlers.onMergeWithPrevious = canMergePrev ? mergeHandlers.prev : undefined;
      handlers.onMergeWithNext = canMergeNext ? mergeHandlers.next : undefined;

      return handlers;
    });
  }, [
    addLexiconSessionIgnore,
    confirmSegment,
    deleteSegment,
    filteredSegments,
    handleSplitSegment,
    segments,
    seekToTime,
    setSelectedSegmentId,
    toggleSegmentBookmark,
    updateSegmentSpeaker,
    updateSegmentText,
    selectChapterForSegment,
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
