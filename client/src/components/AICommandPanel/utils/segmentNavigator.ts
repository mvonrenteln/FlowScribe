import type { Segment } from "@/lib/store/types";

interface SegmentNavigatorActions {
  setSelectedSegmentId: (segmentId: string) => void;
  seekToTime: (time: number, meta?: { source?: string }) => void;
}

export function createSegmentNavigator(
  segmentById: Map<string, Segment>,
  actions: SegmentNavigatorActions,
) {
  return (segmentId: string) => {
    const segment = segmentById.get(segmentId);
    if (!segment) return false;

    actions.setSelectedSegmentId(segmentId);
    actions.seekToTime(segment.start, { source: "ai_navigation" });
    return true;
  };
}
