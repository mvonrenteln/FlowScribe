import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Speaker } from "@/lib/store/types";
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
    const speakers: Speaker[] = [];

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
        confidenceScoresVersion: 0,
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

  it("filters with NOT tags - excludes segments with the NOT tag", () => {
    const segments = normalizeSegments([
      makeSegment("s1"),
      makeSegment("s2", ["t1"]),
      makeSegment("s3", ["t2"]),
      makeSegment("s4", ["t1", "t2"]),
    ]);
    const speakers: Speaker[] = [];

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
        confidenceScoresVersion: 0,
        setHighlightLowConfidence: () => {},
        setManualConfidenceThreshold: () => {},
      }),
    );

    // initially all segments present
    expect(result.current.filteredSegments.length).toBe(4);

    // set NOT filter to t1 -> excludes s2 and s4 (they have t1)
    act(() => {
      result.current.setFilterNotTagIds(["t1"]);
    });
    expect(result.current.filteredSegments.length).toBe(2);
    expect(result.current.filteredSegments.map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  it("filters with multiple NOT tags - excludes segments with any of the NOT tags", () => {
    const segments = normalizeSegments([
      makeSegment("s1"),
      makeSegment("s2", ["t1"]),
      makeSegment("s3", ["t2"]),
      makeSegment("s4", ["t1", "t2"]),
    ]);
    const speakers: Speaker[] = [];

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
        confidenceScoresVersion: 0,
        setHighlightLowConfidence: () => {},
        setManualConfidenceThreshold: () => {},
      }),
    );

    // set NOT filter to t1 and t2 -> only s1 remains (no tags)
    act(() => {
      result.current.setFilterNotTagIds(["t1", "t2"]);
    });
    expect(result.current.filteredSegments.length).toBe(1);
    expect(result.current.filteredSegments[0].id).toBe("s1");
  });

  it("combines normal and NOT tag filters correctly", () => {
    const segments = normalizeSegments([
      makeSegment("s1"),
      makeSegment("s2", ["t1"]),
      makeSegment("s3", ["t2"]),
      makeSegment("s4", ["t1", "t2"]),
      makeSegment("s5", ["t1", "t3"]),
    ]);
    const speakers: Speaker[] = [];

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
        confidenceScoresVersion: 0,
        setHighlightLowConfidence: () => {},
        setManualConfidenceThreshold: () => {},
      }),
    );

    // filter for t1 (normal) AND NOT t2
    // -> segments must have t1 AND must not have t2
    // -> s2 and s5 qualify (s4 has both t1 and t2, so it's excluded)
    act(() => {
      result.current.setFilterTagIds(["t1"]);
      result.current.setFilterNotTagIds(["t2"]);
    });
    expect(result.current.filteredSegments.length).toBe(2);
    expect(result.current.filteredSegments.map((s) => s.id).sort()).toEqual(["s2", "s5"]);
  });

  it("clears NOT tag filters when clearFilters is called", () => {
    const segments = normalizeSegments([makeSegment("s1"), makeSegment("s2", ["t1"])]);
    const speakers: Speaker[] = [];

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
        confidenceScoresVersion: 0,
        setHighlightLowConfidence: () => {},
        setManualConfidenceThreshold: () => {},
      }),
    );

    act(() => {
      result.current.setFilterNotTagIds(["t1"]);
    });
    expect(result.current.filteredSegments.length).toBe(1); // only s1

    act(() => {
      result.current.clearFilters();
    });
    expect(result.current.filterNotTagIds).toEqual([]);
    expect(result.current.filteredSegments.length).toBe(2); // both segments
  });
});
