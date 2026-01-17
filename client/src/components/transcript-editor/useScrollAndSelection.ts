import { useCallback, useEffect, useMemo, useRef } from "react";
import { mark, time } from "@/lib/logging";
import type { Segment } from "@/lib/store";
import type { SeekMeta } from "@/lib/store/types";
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
  seekToTime: (time: number, meta: SeekMeta) => void;
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
  seekToTime,
  setIsPlaying,
}: UseScrollAndSelectionOptions) {
  const transcriptListRef = useRef<HTMLDivElement>(null);
  const lastScrollRef = useRef<{ id: string; at: number } | null>(null);
  const lastTargetElementRef = useRef<HTMLElement | null>(null);
  const lastContainerRef = useRef<HTMLDivElement | null>(null);

  const activeSegment = useMemo(() => {
    if (!segments.length) return undefined;
    let low = 0;
    let high = segments.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const seg = segments[mid];
      if (currentTime < seg.start) {
        high = mid - 1;
      } else if (currentTime > seg.end) {
        low = mid + 1;
      } else {
        return seg;
      }
    }

    return undefined;
  }, [currentTime, segments]);

  const filteredSegmentIds = useMemo(
    () => new Set(filteredSegments.map((segment) => segment.id)),
    [filteredSegments],
  );

  const isActiveSegmentVisible = useMemo(() => {
    if (!activeSegment) return false;
    return filteredSegmentIds.has(activeSegment.id);
  }, [activeSegment, filteredSegmentIds]);

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
  const lastIsPlayingRef = useRef(isPlaying);
  const lastVisibilityCheckRef = useRef<number>(0);

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
    (
      segmentId: string,
      target: HTMLElement | null,
      options: { block: ScrollLogicalPosition; behavior: ScrollBehavior },
    ) => {
      const container = transcriptListRef.current;
      if (!container) return;
      const targetElement =
        target && container.contains(target)
          ? target
          : container.querySelector<HTMLElement>(`[data-segment-id="${segmentId}"]`);
      if (!targetElement) return;

      const now = globalThis.performance?.now?.() ?? Date.now();
      const last = lastScrollRef.current;

      // Stricter throttling for same-segment scrolling
      if (last?.id === segmentId && now - last.at < 500) {
        return;
      }

      lastScrollRef.current = { id: segmentId, at: now };
      mark("scroll-effect-start", { segmentId, behavior: options.behavior });
      requestAnimationFrame(() => {
        time(
          "scroll-effect",
          () => targetElement.scrollIntoView({ block: options.block, behavior: options.behavior }),
          { segmentId, behavior: options.behavior },
        );
        mark("scroll-effect-end", { segmentId, behavior: options.behavior });
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

    // Detect play state change (pause → play)
    const justResumed = isPlaying && !lastIsPlayingRef.current;
    lastIsPlayingRef.current = isPlaying;

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

    // Throttle heavy scroll/visibility checks during playback to at most ~4Hz.
    // Still allow immediate scrolls for important events (seek / resume / target change).
    const nowMs = Date.now();
    const isWithinThrottleWindow = isPlaying && nowMs - lastVisibilityCheckRef.current < 250;
    const isSameTarget = scrollTargetId !== null && scrollTargetId === lastTargetIdRef.current;
    const canSkipHeavyWork =
      isWithinThrottleWindow &&
      !isSeeking &&
      !justResumed &&
      (scrollTargetId === null || isSameTarget);
    if (canSkipHeavyWork) return;
    lastVisibilityCheckRef.current = nowMs;

    const container = transcriptListRef.current;

    if (container !== lastContainerRef.current) {
      lastContainerRef.current = container;
      lastTargetElementRef.current = null;
    }

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

    const cachedTarget =
      lastTargetElementRef.current &&
      lastTargetElementRef.current.dataset.segmentId === scrollTargetId &&
      container?.contains(lastTargetElementRef.current)
        ? lastTargetElementRef.current
        : null;

    const resolvedTarget =
      cachedTarget ||
      container?.querySelector<HTMLElement>(`[data-segment-id="${scrollTargetId}"]`);

    if (!cachedTarget) {
      lastTargetElementRef.current = resolvedTarget ?? null;
    }

    if (isSeeking) {
      // Always scroll on manual seek to re-center
      shouldScroll = true;
    } else if (justResumed) {
      // Always scroll when resuming playback (pause → play transition)
      // This ensures we snap back to the active segment after user scrolled away
      shouldScroll = true;
    } else if (targetIdChanged) {
      // Always scroll when the target segment changes (boundary hit)
      shouldScroll = true;
    } else if (isPlaying) {
      // During playback of the same segment, only scroll if it's no longer visible (snap back)
      if (resolvedTarget && !isElementVisible(resolvedTarget, container)) {
        shouldScroll = true;
      }
    } else if (!isInteracting && !isPlaying) {
      // If we are paused and not interacting, ensure the target is visible.
      // This handles initial load, "snap back" after pausing, or stale selections.
      if (resolvedTarget && !isElementVisible(resolvedTarget, container)) {
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

    scrollSegmentIntoView(scrollTargetId, resolvedTarget ?? null, {
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
      seekToTime(nextSegment.start, { source: "system", action: "restrict_playback" });
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
    seekToTime,
    setIsPlaying,
    setSelectedSegmentId,
  ]);

  return { transcriptListRef, activeSegment, isActiveSegmentVisible };
}
