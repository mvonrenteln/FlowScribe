import { describe, expect, it } from "vitest";
import type { Segment } from "@/lib/store/types";
import { getSegmentTags, hasSegmentTag } from "../segmentTags";

describe("segmentTags utils", () => {
  it("returns empty array for segment with empty tags", () => {
    const segment: Segment = {
      id: "s1",
      speaker: "SPEAKER_00",
      tags: [],
      start: 0,
      end: 1,
      text: "hi",
      words: [],
    };
    const tags = getSegmentTags(segment);
    expect(Array.isArray(tags)).toBe(true);
    expect(tags).toHaveLength(0);
  });

  it("hasSegmentTag returns false when tag missing", () => {
    const segment: Segment = {
      id: "s1",
      speaker: "SPEAKER_00",
      tags: [],
      start: 0,
      end: 1,
      text: "hi",
      words: [],
    };
    expect(hasSegmentTag(segment, "tag1")).toBe(false);
  });

  it("returns existing tags unchanged", () => {
    const segment: Segment = {
      id: "s2",
      speaker: "SPEAKER_00",
      tags: ["a", "b"],
      start: 0,
      end: 1,
      text: "ok",
      words: [],
    };
    const tags = getSegmentTags(segment);
    expect(tags).toEqual(["a", "b"]);
    expect(hasSegmentTag(segment, "a")).toBe(true);
  });
});
