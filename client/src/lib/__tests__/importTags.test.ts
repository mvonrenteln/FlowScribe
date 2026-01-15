import { describe, it, expect, beforeEach } from "vitest";
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
        { id: "s2", speaker: "B", start: 1, end: 2, text: "two", words: [], tags: ["beta", "alpha"] },
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
});
