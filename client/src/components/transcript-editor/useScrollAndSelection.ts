import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Segment } from "@/lib/store";
import { isElementVisible } from "./visibility";

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
  activeSpeakerName: _activeSpeakerName,
  filteredSegments,
  restrictPlaybackToFiltered,
  lowConfidenceThreshold,
  setSelectedSegmentId,
  requestSeek,
  setIsPlaying,
}: UseScrollAndSelectionOptions) {
  const transcriptListRef = useRef<HTMLDivElement>(null);
  const lastScrollRef = useRef<{ id: string; at: number } | null>(null);

  const activeSegment = segments.find((s) => currentTime >= s.start && currentTime <= s.end);
  const isActiveSegmentVisible = useMemo(() => {
    if (!activeSegment) return false;
    // Check if the segment is in the filtered list
    return filteredSegments.some((segment) => segment.id === activeSegment.id);
  }, [activeSegment, filteredSegments]);

  // Sync selection during playback or when time changes manually
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

  const lastInteractionTimeRef = useRef(0);
  const lastSelectedIdRef = useRef<string | null>(null);
  const lastActiveIdRef = useRef<string | null>(null);
  const lastTargetIdRef = useRef<string | null>(null);
  const lastTimeRef = useRef(currentTime);

  useEffect(() => {
    const handleInteraction = () => {
      lastInteractionTimeRef.current = Date.now();
    };
    window.addEventListener("mousedown", handleInteraction, { capture: true, passive: true });
    window.addEventListener("wheel", handleInteraction, { capture: true, passive: true });
    window.addEventListener("keydown", handleInteraction, { capture: true, passive: true });
    return () => {
      window.removeEventListener("mousedown", handleInteraction);
      window.removeEventListener("wheel", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, []);

  const scrollSegmentIntoView = useCallback(
    (segmentId: string, options: { block: ScrollLogicalPosition; behavior: ScrollBehavior }) => {
      const container = transcriptListRef.current;
      if (!container) return;
      const target = container.querySelector<HTMLElement>(`[data-segment-id="${segmentId}"]`);
      if (!target) return;

      const now = globalThis.performance?.now?.() ?? Date.now();
      const last = lastScrollRef.current;

      // Stricter throttling for same-segment scrolling
      if (last?.id === segmentId && now - last.at < 500) {
        return;
      }

      lastScrollRef.current = { id: segmentId, at: now };
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: options.block, behavior: options.behavior });
      });
    },
    [],
  );

  useEffect(() => {
    if (isTranscriptEditing()) return;

    const now = Date.now();
    const isInteracting = now - lastInteractionTimeRef.current < 2000;

    // Detect "seek" (significant jump in time)
    const timeDiff = Math.abs(currentTime - lastTimeRef.current);
    const isSeeking = timeDiff > 1.5; // Threshold for considering it a manual jump/seek
    lastTimeRef.current = currentTime;

    // Determine the ideal segment to show.
    // If we have an active segment, use it.
    // If we are in a gap (silence), find the next upcoming visible segment.
    let targetSegment = activeSegment || null;
    if (!targetSegment && filteredSegments.length > 0) {
      targetSegment = filteredSegments.find((s) => s.start > currentTime) || null;
    }

    // During playback, always follow the active (or next) segment.
    // In pause mode, prefer selection if interacting, else active/next.
    const scrollTargetId = isPlaying
      ? (targetSegment?.id ?? null)
      : isInteracting && selectedSegmentId
        ? selectedSegmentId
        : (targetSegment?.id ?? selectedSegmentId ?? null);

    if (!scrollTargetId) {
      lastTargetIdRef.current = null;
      return;
    }

    const targetIdChanged = scrollTargetId !== lastTargetIdRef.current;

    // Determine behavior
    // Manual seeks or jumps always use instantaneous "auto" behavior
    const behavior = isSeeking ? "auto" : isPlaying ? "smooth" : "auto";

    // Decision: Should we actually execute the scroll?
    let shouldScroll = false;

    if (isSeeking) {
      // Always scroll on manual seek to re-center
      shouldScroll = true;
    } else if (targetIdChanged) {
      // Always scroll when the target segment changes (boundary hit)
      shouldScroll = true;
    } else if (isPlaying) {
      // During playback of the same segment, only scroll if it's no longer visible (snap back)
      const container = transcriptListRef.current;
      const target = container?.querySelector<HTMLElement>(`[data-segment-id="${scrollTargetId}"]`);
      if (target && !isElementVisible(target, container)) {
        shouldScroll = true;
      }
    } else if (!isInteracting && !isPlaying) {
      // If we are paused and not interacting, ensure the target is visible.
      // This handles initial load, "snap back" after pausing, or stale selections.
      const container = transcriptListRef.current;
      const target = container?.querySelector<HTMLElement>(`[data-segment-id="${scrollTargetId}"]`);
      if (target && !isElementVisible(target, container)) {
        shouldScroll = true;
      }
    }

    if (!shouldScroll) {
      lastTargetIdRef.current = scrollTargetId;
      return;
    }

    // Update tracking refs
    lastTargetIdRef.current = scrollTargetId;
    lastSelectedIdRef.current = selectedSegmentId;
    lastActiveIdRef.current = activeSegment?.id ?? null;

    scrollSegmentIntoView(scrollTargetId, {
      block: "center",
      behavior,
    });
  }, [
    activeSegment,
    currentTime,
    isPlaying,
    isTranscriptEditing,
    scrollSegmentIntoView,
    selectedSegmentId,
    filteredSegments,
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

  return { transcriptListRef, activeSegment, isActiveSegmentVisible };
}
