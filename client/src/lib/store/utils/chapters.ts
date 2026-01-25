import type { Chapter } from "@/types/chapter";
import type { Segment } from "../types";

/**
 * Build a lookup map for segment positions to avoid repeated scans.
 */
export const buildSegmentIndexMap = (segments: Segment[]) =>
  new Map(segments.map((segment, index) => [segment.id, index]));

// Memoized variant keyed by the segments array identity to avoid rebuilding
// the Map in hot render paths. Uses a WeakMap so cached entries don't
// prevent GC for discarded segment arrays.
const _segmentMapCache = new WeakMap<Segment[], Map<string, number>>();
export const memoizedBuildSegmentIndexMap = (segments: Segment[]) => {
  const cached = _segmentMapCache.get(segments);
  if (cached) return cached;
  const next = buildSegmentIndexMap(segments);
  _segmentMapCache.set(segments, next);
  return next;
};

/**
 * Returns the segment index range for a chapter or null if invalid.
 */
export const getChapterRangeIndices = (
  chapter: Chapter,
  indexById: Map<string, number>,
): { startIndex: number; endIndex: number } | null => {
  const startIndex = indexById.get(chapter.startSegmentId);
  const endIndex = indexById.get(chapter.endSegmentId);
  if (startIndex === undefined || endIndex === undefined) return null;
  if (startIndex > endIndex) return null;
  return { startIndex, endIndex };
};

/**
 * Sort chapters by their start segment position.
 */
export const sortChaptersByStart = (chapters: Chapter[], indexById: Map<string, number>) =>
  [...chapters].sort((a, b) => {
    const aIndex = indexById.get(a.startSegmentId);
    const bIndex = indexById.get(b.startSegmentId);
    if (aIndex === undefined && bIndex === undefined) return 0;
    if (aIndex === undefined) return 1;
    if (bIndex === undefined) return -1;
    return aIndex - bIndex;
  });

/**
 * Returns true when no chapter ranges overlap.
 */
export const hasOverlappingChapters = (
  chapters: Chapter[],
  indexById: Map<string, number>,
): boolean => {
  const sorted = sortChaptersByStart(chapters, indexById);
  let lastEndIndex = -1;
  for (const chapter of sorted) {
    const range = getChapterRangeIndices(chapter, indexById);
    if (!range) return true;
    if (range.startIndex <= lastEndIndex) return true;
    lastEndIndex = range.endIndex;
  }
  return false;
};

/**
 * Recalculate segment counts for chapters based on their range.
 */
export const normalizeChapterCounts = (
  chapters: Chapter[],
  indexById: Map<string, number>,
): Chapter[] =>
  chapters.map((chapter) => {
    const range = getChapterRangeIndices(chapter, indexById);
    if (!range) {
      return { ...chapter, segmentCount: 0 };
    }
    return { ...chapter, segmentCount: range.endIndex - range.startIndex + 1 };
  });
