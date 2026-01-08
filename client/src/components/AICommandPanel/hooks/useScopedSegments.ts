import { useMemo } from "react";
import type { Segment } from "@/lib/store/types";
import { buildSegmentIndex, getIsFiltered, getScopedSegmentIds } from "../utils/segmentScope";

interface UseScopedSegmentsOptions {
  segments: Segment[];
  filteredSegmentIds: string[];
  excludeConfirmed: boolean;
}

export function useScopedSegments({
  segments,
  filteredSegmentIds,
  excludeConfirmed,
}: UseScopedSegmentsOptions) {
  const segmentById = useMemo(() => buildSegmentIndex(segments), [segments]);

  const scopedSegmentIds = useMemo(
    () => getScopedSegmentIds(segmentById, filteredSegmentIds, excludeConfirmed),
    [segmentById, filteredSegmentIds, excludeConfirmed],
  );

  const isFiltered = useMemo(
    () => getIsFiltered(segments, filteredSegmentIds),
    [segments, filteredSegmentIds],
  );

  return { segmentById, scopedSegmentIds, isFiltered };
}
