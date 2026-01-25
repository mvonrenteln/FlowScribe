import { describe, expect, it } from "vitest";
import {
  buildSegmentIndexMap,
  getChapterRangeIndices,
  normalizeChapterCounts,
} from "@/lib/store/utils/chapters";

describe("chapters utils when segments order changes", () => {
  it("normalizes chapter counts to 0 when start > end due to reorder", () => {
    type SimpleSeg = { id: string; start: number };
    type SimpleChapter = {
      id: string;
      startSegmentId: string;
      endSegmentId: string;
      segmentCount?: number;
    };

    const s1: SimpleSeg = { id: "s1", start: 0 };
    const s2: SimpleSeg = { id: "s2", start: 1 };
    const chapter: SimpleChapter = {
      id: "c1",
      startSegmentId: "s1",
      endSegmentId: "s2",
      segmentCount: 2,
    };

    // original order
    let segments = [s1, s2];
    let indexById = buildSegmentIndexMap(segments);
    let range = getChapterRangeIndices(chapter, indexById);
    expect(range).toEqual({ startIndex: 0, endIndex: 1 });

    let normalized = normalizeChapterCounts([chapter], indexById);
    expect(normalized[0].segmentCount).toBe(2);

    // reorder segments (simulate timing change)
    segments = [s2, s1];
    indexById = buildSegmentIndexMap(segments);
    range = getChapterRangeIndices(chapter, indexById);
    expect(range).toBeNull();

    normalized = normalizeChapterCounts([chapter], indexById);
    expect(normalized[0].segmentCount).toBe(0);
  });
});
