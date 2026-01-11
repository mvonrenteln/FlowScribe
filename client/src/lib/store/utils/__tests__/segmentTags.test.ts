import { describe, expect, it } from "vitest";
import { getSegmentTags, hasSegmentTag } from "../segmentTags";

describe("segmentTags utils", () => {
  it("returns empty array for segment without tags", () => {
    const segment: Partial<any> = { id: "s1", text: "hi", words: [] };
    const tags = getSegmentTags(segment as any);
    expect(Array.isArray(tags)).toBe(true);
    expect(tags).toHaveLength(0);
  });

  it("hasSegmentTag returns false for missing tags", () => {
    const segment: Partial<any> = { id: "s1", text: "hi", words: [] };
    expect(hasSegmentTag(segment as any, "tag1")).toBe(false);
  });

  it("returns existing tags unchanged", () => {
    const segment: Partial<any> = { id: "s2", text: "ok", words: [], tags: ["a", "b"] };
    const tags = getSegmentTags(segment as any);
    expect(tags).toEqual(["a", "b"]);
    expect(hasSegmentTag(segment as any, "a")).toBe(true);
  });
});
