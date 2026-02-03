import type { Chapter } from "@/types/chapter";
import type { Segment } from "../types";

/**
 * Build a lookup map for segment positions to avoid repeated scans.
 */
export const buildSegmentIndexMap = (segments: Segment[]) =>
  new Map(segments.map((segment, index) => [segment.id, index]));

/**
 * Memoized variant of `buildSegmentIndexMap` keyed by the `segments` array
 * identity. This is important for hot render paths where callers frequently
 * request the index map — avoiding a rebuild (and a linear scan of the
 * segments array) can save a lot of CPU on large transcripts.
 *
 * Implementation notes:
 * - The cache is keyed by the exact `segments` array reference, so callers
 *   must use the same array identity for caching to work (this is the case
 *   for our store selectors which return the store's `segments` array).
 * - It uses a `WeakMap` so entries do not prevent the garbage collector from
 *   reclaiming discarded segment arrays (avoid memory leaks during reloads).
 * - Prefer calling the exported `memoizedBuildSegmentIndexMap` rather than
 *   re-running `buildSegmentIndexMap` directly when performance matters.
 */
const _segmentMapCache = new WeakMap<Segment[], Map<string, number>>();
export const memoizedBuildSegmentIndexMap = (segments: Segment[]) => {
  const cached = _segmentMapCache.get(segments);
  if (cached) return cached;
  const next = buildSegmentIndexMap(segments);
  _segmentMapCache.set(segments, next);
  return next;
};

// Build both index and object maps together. Useful for callers that need
// both lookups and want a single cached object keyed by the `segments`
// array identity so invalidation is automatic when the array changes.
type SegmentMaps = {
  indexById: Map<string, number>;
  segmentById: Map<string, Segment>;
};

/**
 * Combined, memoized map object providing both `indexById` and
 * `segmentById` lookups. Many callers need both maps together; building
 * them once and returning a single cached object reduces duplicated work.
 *
 * This cache follows the same identity-based WeakMap strategy as above and
 * is intentionally internal to this module. Public helpers such as
 * `useSegmentMaps` / `getSegmentMaps` in the store layer rely on this
 * function to provide a stable, memoized view of the segment maps.
 *
 * Important usage guidance:
 * - Callers that only need one of the maps should still prefer the
 *   store-provided selectors (`useSegmentIndexById`, `useSegmentMaps`) so
 *   the cache is reused consistently.
 * - Because the cache keys by array identity, the cache will automatically
 *   invalidate when the store replaces the `segments` array.
 */
const _segmentMapsCache = new WeakMap<Segment[], SegmentMaps>();
export const memoizedBuildSegmentMaps = (segments: Segment[]): SegmentMaps => {
  const cached = _segmentMapsCache.get(segments);
  if (cached) return cached;
  const indexById = buildSegmentIndexMap(segments);
  const segmentById = new Map(segments.map((s) => [s.id, s]));
  const next = { indexById, segmentById } as const;
  _segmentMapsCache.set(segments, next);
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

/**
 * Recompute chapter end boundaries so each chapter ends where the next begins.
 * Returns chapters ordered by their start segment position.
 */
export const recomputeChapterRangesFromStarts = (
  chapters: Chapter[],
  segments: Segment[],
  indexById: Map<string, number>,
): Chapter[] => {
  if (chapters.length === 0) return [];
  const ordered = sortChaptersByStart(chapters, indexById);
  return ordered.map((chapter, index) => {
    const startIndex = indexById.get(chapter.startSegmentId);
    if (startIndex === undefined) {
      return { ...chapter, segmentCount: 0 };
    }
    const nextChapter = ordered[index + 1];
    const nextStartIndex = nextChapter ? indexById.get(nextChapter.startSegmentId) : undefined;
    if (nextStartIndex !== undefined && nextStartIndex <= startIndex) {
      return { ...chapter, segmentCount: 0 };
    }
    const resolvedEndIndex =
      nextStartIndex !== undefined
        ? Math.max(startIndex, nextStartIndex - 1)
        : Math.max(startIndex, segments.length - 1);
    const endSegmentId = segments[resolvedEndIndex]?.id ?? chapter.endSegmentId;
    const segmentCount = resolvedEndIndex - startIndex + 1;
    return {
      ...chapter,
      endSegmentId,
      segmentCount,
    };
  });
};
