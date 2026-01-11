import { describe, expect, it } from "vitest";
import type { Segment } from "@/lib/store/types";
import { buildSegmentIndex, getIsFiltered, getScopedSegmentIds } from "../utils/segmentScope";

const segments: Segment[] = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    tags: [],
    start: 0,
    end: 1,
    text: "Hello",
    words: [],
    confirmed: true,
  },
  {
    id: "seg-2",
    speaker: "SPEAKER_01",
    tags: [],
    start: 1,
    end: 2,
    text: "World",
    words: [],
    confirmed: false,
  },
];

describe("segment scope helpers", () => {
  it("builds an index for fast lookup", () => {
    const segmentById = buildSegmentIndex(segments);

    expect(segmentById.get("seg-1")?.text).toBe("Hello");
    expect(segmentById.get("seg-2")?.speaker).toBe("SPEAKER_01");
  });

  it("filters missing segments and confirmed segments when excluded", () => {
    const segmentById = buildSegmentIndex(segments);
    const scoped = getScopedSegmentIds(segmentById, ["seg-1", "seg-2", "missing"], true);

    expect(scoped).toEqual(["seg-2"]);
  });

  it("keeps confirmed segments when excludeConfirmed is false", () => {
    const segmentById = buildSegmentIndex(segments);
    const scoped = getScopedSegmentIds(segmentById, ["seg-1", "seg-2"], false);

    expect(scoped).toEqual(["seg-1", "seg-2"]);
  });

  it("treats filtered ids shorter than segments as filtered", () => {
    expect(getIsFiltered(segments, ["seg-1"])).toBe(true);
  });

  it("treats equal lengths as unfiltered", () => {
    expect(getIsFiltered(segments, ["seg-1", "seg-2"])).toBe(false);
  });
});
