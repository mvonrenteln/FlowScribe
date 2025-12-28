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

  const activeSegment = segments.find((s) => currentTime >= s.start && currentTime <= s.end);
  const isActiveSegmentVisible = useMemo(() => {
    if (!activeSegment) return false;
    if (!activeSpeakerName) return true;
    return filteredSegments.some((segment) => segment.id === activeSegment.id);
  }, [activeSegment, activeSpeakerName, filteredSegments]);

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
    isPlaying,
    isTranscriptEditing,
    selectedSegmentId,
    setSelectedSegmentId,
  ]);

  const lastInteractionTimeRef = useRef(0);
  const lastSelectedIdRef = useRef<string | null>(null);
  const lastActiveIdRef = useRef<string | null>(null);
  const lastTargetIdRef = useRef<string | null>(null);

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

      // Check if it's already in a reasonable position to avoid micro-adjustments
      // but only for smooth (auto) scrolling during playback
      if (options.behavior === "smooth") {
        const rect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const isVisible = rect.top >= containerRect.top + 100 && rect.bottom <= containerRect.bottom - 100;
        if (isVisible) return;
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

    let scrollTargetId: string | null = null;

    if (isPlaying) {
      scrollTargetId = activeSegment?.id ?? null;
    } else {
      // In pause mode: if user recently interacted (keys/mouse), follow selection.
      // Otherwise (initial load, clicking wave), follow active segment.
      if (isInteracting && selectedSegmentId) {
        scrollTargetId = selectedSegmentId;
      } else {
        scrollTargetId = activeSegment?.id ?? selectedSegmentId ?? null;
      }
    }

    // Update tracking refs (kept for other logic if needed)
    lastSelectedIdRef.current = selectedSegmentId;
    lastActiveIdRef.current = activeSegment?.id ?? null;

    if (!scrollTargetId) {
      lastTargetIdRef.current = null;
      return;
    }

    // Skip auto-scroll if it's the SAME target and we are still interacting (prevents stutter)
    if (isInteracting && scrollTargetId === lastTargetIdRef.current) {
      return;
    }

    // Update last target tracker
    lastTargetIdRef.current = scrollTargetId;

    if (isPlaying && !isActiveSegmentVisible) return;

    scrollSegmentIntoView(scrollTargetId, {
      block: "center",
      behavior: isPlaying ? "smooth" : "auto",
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

  return { transcriptListRef, activeSegment, isActiveSegmentVisible };
}
