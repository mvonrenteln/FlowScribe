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
    const setCurrentTime = vi.fn();
    const requestSeek = vi.fn();

    const navigate = createSegmentNavigator(segmentById, {
      setSelectedSegmentId,
      setCurrentTime,
      requestSeek,
    });

    expect(navigate("seg-1")).toBe(true);
    expect(setSelectedSegmentId).toHaveBeenCalledWith("seg-1");
    expect(setCurrentTime).toHaveBeenCalledWith(12.5);
    expect(requestSeek).toHaveBeenCalledWith(12.5);
  });

  it("returns false when the segment is missing", () => {
    const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
    const setSelectedSegmentId = vi.fn();
    const setCurrentTime = vi.fn();
    const requestSeek = vi.fn();

    const navigate = createSegmentNavigator(segmentById, {
      setSelectedSegmentId,
      setCurrentTime,
      requestSeek,
    });

    expect(navigate("missing")).toBe(false);
    expect(setSelectedSegmentId).not.toHaveBeenCalled();
    expect(setCurrentTime).not.toHaveBeenCalled();
    expect(requestSeek).not.toHaveBeenCalled();
  });
});
