import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Segment } from "@/lib/store";

interface UseScrollAndSelectionOptions {
  segments: Segment[];
  currentTime: number;
  selectedSegmentId: string | null;
  isPlaying: boolean;
  isTranscriptEditing: () => boolean;
  activeSpeakerName?: string;
  filteredSegments: Segment[];
  restrictPlaybackToFiltered: boolean;
  lowConfidenceThreshold: number | null;
  setSelectedSegmentId: (id: string | null) => void;
  requestSeek: (time: number) => void;
  setIsPlaying: (value: boolean) => void;
}

export function useScrollAndSelection({
  segments,
  currentTime,
  selectedSegmentId,
  isPlaying,
  isTranscriptEditing,
  activeSpeakerName,
  filteredSegments,
  restrictPlaybackToFiltered,
  lowConfidenceThreshold,
  setSelectedSegmentId,
  requestSeek,
  setIsPlaying,
}: UseScrollAndSelectionOptions) {
  const transcriptListRef = useRef<HTMLDivElement>(null);
  const lastScrollRef = useRef<{ id: string; at: number } | null>(null);
  const finalizeScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSegment = segments.find((s) => currentTime >= s.start && currentTime <= s.end);
  const isActiveSegmentVisible = useMemo(() => {
    if (!activeSegment) return false;
    if (!activeSpeakerName) return true;
    return filteredSegments.some((segment) => segment.id === activeSegment.id);
  }, [activeSegment, activeSpeakerName, filteredSegments]);

  useEffect(() => {
    if (isTranscriptEditing()) return;
    if (!activeSegment || !isActiveSegmentVisible) return;
    if (activeSegment.id !== selectedSegmentId) {
      setSelectedSegmentId(activeSegment.id);
    }
  }, [
    activeSegment,
    isActiveSegmentVisible,
    isTranscriptEditing,
    selectedSegmentId,
    setSelectedSegmentId,
  ]);

  const scrollSegmentIntoView = useCallback(
    (segmentId: string, options: { block: ScrollLogicalPosition; behavior: ScrollBehavior }) => {
      const container = transcriptListRef.current;
      if (!container) return;
      const target = container.querySelector<HTMLElement>(`[data-segment-id="${segmentId}"]`);
      if (!target) return;
      const now = globalThis.performance?.now?.() ?? Date.now();
      const last = lastScrollRef.current;
      if (last?.id === segmentId && now - last.at < 250) {
        return;
      }
      lastScrollRef.current = { id: segmentId, at: now };
      if (finalizeScrollTimeoutRef.current) {
        clearTimeout(finalizeScrollTimeoutRef.current);
        finalizeScrollTimeoutRef.current = null;
      }
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: options.block, behavior: options.behavior });
      });
      const viewport = container.parentElement;
      if (!viewport) return;
      const viewportRect = viewport.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (viewportRect.height === 0 || targetRect.height === 0) return;
      const desiredScrollTop =
        viewport.scrollTop +
        (targetRect.top - viewportRect.top) -
        viewport.clientHeight / 2 +
        targetRect.height / 2;
      const distance = Math.abs(desiredScrollTop - viewport.scrollTop);
      const delay = Math.min(800, Math.max(200, distance * 0.5));
      finalizeScrollTimeoutRef.current = setTimeout(() => {
        if (Math.abs(viewport.scrollTop - desiredScrollTop) <= 2) return;
        viewport.scrollTo({ top: desiredScrollTop, behavior: "auto" });
      }, delay);
    },
    [],
  );

  useEffect(() => {
    if (isTranscriptEditing()) return;
    const scrollTargetId = isPlaying
      ? activeSegment?.id
      : (activeSegment?.id ?? selectedSegmentId ?? null);
    if (!scrollTargetId) return;
    if (isPlaying && !isActiveSegmentVisible) return;
    scrollSegmentIntoView(scrollTargetId, {
      block: "center",
      behavior: "smooth",
    });
  }, [
    activeSegment,
    isActiveSegmentVisible,
    isPlaying,
    isTranscriptEditing,
    scrollSegmentIntoView,
    selectedSegmentId,
  ]);

  useEffect(() => {
    if (
      !filteredSegments.length ||
      !isPlaying ||
      !restrictPlaybackToFiltered ||
      lowConfidenceThreshold === null
    )
      return;
    if (!activeSegment || isTranscriptEditing()) return;
    const isWithinFiltered = filteredSegments.some(
      (segment) =>
        activeSegment.id === segment.id &&
        currentTime >= segment.start &&
        currentTime <= segment.end,
    );
    if (isWithinFiltered) return;
    const nextSegment = filteredSegments.find((segment) => segment.start > currentTime);
    if (nextSegment) {
      setSelectedSegmentId(nextSegment.id);
      requestSeek(nextSegment.start);
      return;
    }
    setIsPlaying(false);
  }, [
    activeSegment,
    currentTime,
    filteredSegments,
    isPlaying,
    isTranscriptEditing,
    lowConfidenceThreshold,
    restrictPlaybackToFiltered,
    requestSeek,
    setIsPlaying,
    setSelectedSegmentId,
  ]);

  useEffect(() => {
    return () => {
      if (finalizeScrollTimeoutRef.current) {
        clearTimeout(finalizeScrollTimeoutRef.current);
        finalizeScrollTimeoutRef.current = null;
      }
    };
  }, []);

  return { transcriptListRef, activeSegment, isActiveSegmentVisible };
}
