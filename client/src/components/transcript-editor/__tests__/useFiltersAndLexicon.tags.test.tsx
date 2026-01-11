import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { normalizeSegments } from "@/lib/transcript/normalizeTranscript";
import { useFiltersAndLexicon } from "../useFiltersAndLexicon";

const makeSegment = (id: string, tags?: string[]) => ({
  id,
  text: "hello",
  words: [],
  speaker: "sp1",
  bookmarked: false,
  confirmed: false,
  start: 0,
  end: 1,
  tags,
});

describe("useFiltersAndLexicon tag filtering", () => {
  it("filters correctly when segments lack tags field", () => {
    const segments = normalizeSegments([makeSegment("s1"), makeSegment("s2", ["t1"])]);
    const speakers: unknown[] = [];

    const { result } = renderHook(() =>
      useFiltersAndLexicon({
        segments,
        speakers,
        lexiconEntries: [],
        lexiconThreshold: 0.5,
        lexiconHighlightUnderline: false,
        lexiconHighlightBackground: false,
        spellcheckEnabled: false,
        spellcheckMatchesBySegment: new Map(),
        highlightLowConfidence: false,
        manualConfidenceThreshold: null,
        setHighlightLowConfidence: () => {},
        setManualConfidenceThreshold: () => {},
      }),
    );

    // initially no tag filter -> both segments present
    expect(result.current.filteredSegments.length).toBe(2);

    // set tag filter to t1 -> only second segment remains
    act(() => {
      result.current.setFilterTagIds(["t1"]);
    });
    expect(result.current.filteredSegments.length).toBe(1);
    expect(result.current.filteredSegments[0].id).toBe("s2");
  });
});
