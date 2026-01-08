import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Segment } from "@/lib/store/types";
import { useScopedSegments } from "../hooks/useScopedSegments";

const segments: Segment[] = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    start: 0,
    end: 1,
    text: "Hello",
    words: [],
    confirmed: true,
  },
  {
    id: "seg-2",
    speaker: "SPEAKER_01",
    start: 1,
    end: 2,
    text: "World",
    words: [],
    confirmed: false,
  },
];

describe("useScopedSegments", () => {
  it("returns scoped ids and filter state", () => {
    const { result } = renderHook(() =>
      useScopedSegments({
        segments,
        filteredSegmentIds: ["seg-1", "seg-2"],
        excludeConfirmed: true,
      }),
    );

    expect(result.current.scopedSegmentIds).toEqual(["seg-2"]);
    expect(result.current.isFiltered).toBe(false);
    expect(result.current.segmentById.get("seg-1")?.text).toBe("Hello");
  });
});
