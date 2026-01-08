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
