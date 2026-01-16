import { describe, expect, it, vi } from "vitest";
import type { Segment } from "@/lib/store/types";
import { createSegmentNavigator } from "../utils/segmentNavigator";

const segments: Segment[] = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    start: 12.5,
    end: 14,
    text: "Hello",
    words: [],
  },
];

describe("createSegmentNavigator", () => {
  it("navigates to a known segment", () => {
    const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
    const setSelectedSegmentId = vi.fn();
    const seekToTime = vi.fn();

    const navigate = createSegmentNavigator(segmentById, {
      setSelectedSegmentId,
      seekToTime,
    });

    expect(navigate("seg-1")).toBe(true);
    expect(setSelectedSegmentId).toHaveBeenCalledWith("seg-1");
    expect(seekToTime).toHaveBeenCalledWith(12.5, { source: "ai_navigation" });
  });

  it("returns false when the segment is missing", () => {
    const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
    const setSelectedSegmentId = vi.fn();
    const seekToTime = vi.fn();

    const navigate = createSegmentNavigator(segmentById, {
      setSelectedSegmentId,
      seekToTime,
    });

    expect(navigate("missing")).toBe(false);
    expect(setSelectedSegmentId).not.toHaveBeenCalled();
    expect(seekToTime).not.toHaveBeenCalled();
  });
});
