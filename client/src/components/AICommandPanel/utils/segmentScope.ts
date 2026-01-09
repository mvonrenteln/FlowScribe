import type { Segment } from "@/lib/store/types";

export function buildSegmentIndex(segments: Segment[]): Map<string, Segment> {
  return new Map(segments.map((segment) => [segment.id, segment]));
}

export function getScopedSegmentIds(
  segmentById: Map<string, Segment>,
  filteredSegmentIds: string[],
  excludeConfirmed: boolean,
): string[] {
  return filteredSegmentIds.filter((segmentId) => {
    const segment = segmentById.get(segmentId);
    if (!segment) return false;
    return !excludeConfirmed || !segment.confirmed;
  });
}

export function getIsFiltered(segments: Segment[], filteredSegmentIds: string[]): boolean {
  return filteredSegmentIds.length < segments.length;
}

export function getConsecutiveSegmentIds(
  segments: Segment[],
  scopedSegmentIds: string[],
): string[] {
  if (segments.length === 0 || scopedSegmentIds.length === 0) {
    return [];
  }

  const scopedSet = new Set(scopedSegmentIds);
  const orderedScopedIds = segments.filter((segment) => scopedSet.has(segment.id)).map((s) => s.id);
  const indexById = new Map(segments.map((segment, index) => [segment.id, index]));

  return orderedScopedIds.filter((segmentId, index) => {
    const currentIndex = indexById.get(segmentId);
    if (currentIndex === undefined) {
      return false;
    }

    const previousId = orderedScopedIds[index - 1];
    const nextId = orderedScopedIds[index + 1];
    const previousIndex = previousId ? indexById.get(previousId) : undefined;
    const nextIndex = nextId ? indexById.get(nextId) : undefined;

    return (
      (previousIndex !== undefined && currentIndex - previousIndex === 1) ||
      (nextIndex !== undefined && nextIndex - currentIndex === 1)
    );
  });
}
