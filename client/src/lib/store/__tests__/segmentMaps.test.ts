import { describe, expect, test } from "vitest";
import {
  getSegmentById,
  getSegmentIndexById,
  getSegmentMaps,
  useTranscriptStore,
} from "@/lib/store";

describe("segment maps selector", () => {
  test("getSegmentById / index reflect store state and invalidate on change", () => {
    const s1 = { id: "a", start: 0 } as unknown as Segment;
    const s2 = { id: "b", start: 1 } as unknown as Segment;
    // set initial segments
    useTranscriptStore.setState({ segments: [s1, s2] });

    const byId = getSegmentById("b");
    expect(byId).toBeDefined();
    expect(byId?.id).toBe("b");

    const indexMap = getSegmentIndexById();
    expect(indexMap.get("b")).toBe(1);

    // reorder segments (new array identity) should update maps
    useTranscriptStore.setState({ segments: [s2, s1] });
    const byId2 = getSegmentById("b");
    expect(byId2).toBeDefined();
    expect(byId2?.id).toBe("b");
    const indexMap2 = getSegmentIndexById();
    expect(indexMap2.get("b")).toBe(0);

    // also test getSegmentMaps returns both maps
    const maps = getSegmentMaps();
    expect(maps.indexById.get("a")).toBe(1);
    expect(maps.segmentById.get("a")).toBeDefined();
  });
});
