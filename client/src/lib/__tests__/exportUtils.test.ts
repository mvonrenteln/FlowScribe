import { describe, expect, it } from "vitest";
import { buildJSONExport } from "../exportUtils";

describe("buildJSONExport", () => {
  it("replaces tag ids with names in exported segments", () => {
    const tags: Tag[] = [
      { id: "t1", name: "Interviewer", color: "#fff" },
      { id: "t2", name: "Guest", color: "#000" },
    ];

    const segments: Segment[] = [
      {
        id: "s1",
        speaker: "A",
        tags: ["t1"],
        start: 0,
        end: 1,
        text: "hello",
        words: [],
      },
      {
        id: "s2",
        speaker: "B",
        tags: ["t2", "unknown"],
        start: 1,
        end: 2,
        text: "world",
        words: [],
      },
    ];

    const exported = buildJSONExport(segments, tags);

    expect(exported.segments[0].tags).toEqual(["Interviewer"]);
    expect(exported.segments[1].tags).toEqual(["Guest", "unknown"]);
    // Other fields preserved
    expect(exported.segments[0].text).toBe("hello");
    expect(exported.segments[1].speaker).toBe("B");
  });
});
