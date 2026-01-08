import type { Segment } from "@/lib/store/types";

interface SegmentNavigatorActions {
  setSelectedSegmentId: (segmentId: string) => void;
  setCurrentTime: (time: number) => void;
  requestSeek: (time: number) => void;
}

export function createSegmentNavigator(
  segmentById: Map<string, Segment>,
  actions: SegmentNavigatorActions,
) {
  return (segmentId: string) => {
    const segment = segmentById.get(segmentId);
    if (!segment) return false;

    actions.setSelectedSegmentId(segmentId);
    actions.setCurrentTime(segment.start);
    actions.requestSeek(segment.start);
    return true;
  };
}
