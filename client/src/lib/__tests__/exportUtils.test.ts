import { describe, expect, it } from "vitest";
import type { Chapter } from "@/types/chapter";
import { buildJSONExport, buildTXTExport } from "../exportUtils";
import type { Segment, Tag } from "../store/types";

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

  it("exports tag metadata and maps chapter tags to names", () => {
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
    ];
    const chapters: Chapter[] = [
      {
        id: "c1",
        title: "Intro",
        startSegmentId: "s1",
        endSegmentId: "s1",
        segmentCount: 1,
        createdAt: 123,
        source: "manual",
        tags: ["t2", "unknown"],
      },
    ];

    const exported = buildJSONExport(segments, tags, chapters);

    expect(exported.tags).toEqual([
      { name: "Interviewer", color: "#fff" },
      { name: "Guest", color: "#000" },
    ]);
    expect(exported.chapters?.[0]?.tags).toEqual(["Guest", "unknown"]);
  });
});

describe("buildTXTExport", () => {
  const tags: Tag[] = [{ id: "t1", name: "Host", color: "#fff" }];
  const segments: Segment[] = [
    {
      id: "s1",
      speaker: "A",
      tags: ["t1"],
      start: 0,
      end: 5,
      text: "First segment.",
      words: [],
    },
    {
      id: "s2",
      speaker: "B",
      tags: [],
      start: 5,
      end: 10,
      text: "Second segment.",
      words: [],
    },
  ];
  const chapters: Chapter[] = [
    {
      id: "c1",
      title: "Intro",
      summary: "Short intro summary.",
      startSegmentId: "s1",
      endSegmentId: "s2",
      segmentCount: 2,
      createdAt: 1,
      source: "manual",
      rewrittenText: "Rewritten intro text.",
    },
  ];

  it("exports plain segment text by default without chapter heading or summary", () => {
    const exported = buildTXTExport(segments, segments, tags, chapters);

    expect(exported).toContain("[0:00] A (Host): First segment.");
    expect(exported).toContain("[0:05] B: Second segment.");
    expect(exported).not.toContain("# Intro");
    expect(exported).not.toContain("Short intro summary.");
  });

  it("includes chapter heading and summary when both options are enabled", () => {
    const exported = buildTXTExport(segments, segments, tags, chapters, {
      includeChapterHeadings: true,
      includeChapterSummaries: true,
    });

    expect(exported).toContain("# Intro");
    expect(exported).toContain("Short intro summary.");
    expect(exported).toContain("[0:00] A (Host): First segment.");
  });

  it("includes only chapter summary when summary option is enabled alone", () => {
    const exported = buildTXTExport(segments, segments, tags, chapters, {
      includeChapterSummaries: true,
    });

    expect(exported).toContain("Short intro summary.");
    expect(exported).not.toContain("# Intro");
    expect(exported).toContain("[0:00] A (Host): First segment.");
  });

  it("uses rewritten text without forcing chapter heading and summary", () => {
    const exported = buildTXTExport(segments, segments, tags, chapters, {
      useRewrittenText: true,
    });

    expect(exported).toContain("Rewritten intro text.");
    expect(exported).not.toContain("# Intro");
    expect(exported).not.toContain("Short intro summary.");
  });
});
