import { beforeEach, describe, expect, it } from "vitest";
import { useTranscriptStore } from "@/lib/store";
import { resetStore } from "./storeTestUtils";

describe("WhisperX import with tags", () => {
  beforeEach(() => {
    resetStore();
  });

  it("creates tags for incoming tag names and maps segment tags to ids", () => {
    const data = {
      segments: [
        { id: "s1", speaker: "A", start: 0, end: 1, text: "one", words: [], tags: ["alpha"] },
        {
          id: "s2",
          speaker: "B",
          start: 1,
          end: 2,
          text: "two",
          words: [],
          tags: ["beta", "alpha"],
        },
      ],
      isWhisperXFormat: true,
    };

    const store = useTranscriptStore.getState();
    store.loadTranscript({ segments: data.segments, isWhisperXFormat: true });

    const state = useTranscriptStore.getState();
    // tags created
    expect(state.tags.length).toBe(2);
    const names = state.tags.map((t) => t.name).sort();
    expect(names).toEqual(["alpha", "beta"].sort());

    // segment tags should reference ids (not names)
    const seg1 = state.segments.find((s) => s.id === "s1");
    const seg2 = state.segments.find((s) => s.id === "s2");
    expect(seg1).toBeDefined();
    expect(seg2).toBeDefined();
    expect(seg1?.tags?.every((t) => state.tags.some((tag) => tag.id === t))).toBe(true);
    expect(seg2?.tags?.every((t) => state.tags.some((tag) => tag.id === t))).toBe(true);
  });

  it("imports tag metadata and maps chapter tags to ids", () => {
    const data = {
      segments: [
        { id: "s1", speaker: "A", start: 0, end: 1, text: "one", words: [], tags: ["alpha"] },
      ],
      tags: [
        { name: "alpha", color: "#111111" },
        { name: "beta", color: "#222222" },
      ],
      chapters: [
        {
          id: "c1",
          title: "Intro",
          startSegmentId: "s1",
          endSegmentId: "s1",
          segmentCount: 1,
          createdAt: 123,
          source: "manual",
          tags: ["beta"],
        },
      ],
      isWhisperXFormat: true,
    };

    const store = useTranscriptStore.getState();
    store.loadTranscript({
      segments: data.segments,
      tags: data.tags,
      chapters: data.chapters,
      isWhisperXFormat: true,
    });

    const state = useTranscriptStore.getState();
    const importedAlpha = state.tags.find((tag) => tag.name === "alpha");
    const importedBeta = state.tags.find((tag) => tag.name === "beta");

    expect(importedAlpha?.color).toBe("#111111");
    expect(importedBeta?.color).toBe("#222222");
    expect(state.chapters).toHaveLength(1);
    expect(state.chapters[0]?.tags).toEqual([importedBeta?.id]);
  });
});
