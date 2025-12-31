import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Segment } from "@/lib/store";
import { useFiltersAndLexicon } from "../useFiltersAndLexicon";

// Base confidence props for all tests
const confidenceProps = {
  highlightLowConfidence: false,
  manualConfidenceThreshold: null,
  setHighlightLowConfidence: vi.fn(),
  setManualConfidenceThreshold: vi.fn(),
};

describe("Search Logic in useFiltersAndLexicon", () => {
  const segments: Segment[] = [
    {
      id: "seg-unicode",
      speaker: "SPEAKER_00",
      start: 0,
      end: 1,
      text: "Müller", // NFC by default in JS string literals usually
      words: [{ word: "Müller", start: 0, end: 1 }],
    },
    {
      id: "seg-punct",
      speaker: "SPEAKER_00",
      start: 2,
      end: 3,
      text: "The bluebird.",
      words: [
        { word: "The", start: 2, end: 2.5 },
        { word: "bluebird.", start: 2.5, end: 3 },
      ],
    },
    {
      id: "seg-split",
      speaker: "SPEAKER_00",
      start: 4,
      end: 5,
      text: "blue - bird", // Text has spaces
      words: [
        { word: "blue", start: 4, end: 4.5 },
        { word: "bird", start: 4.5, end: 5 },
      ],
    },
    {
      id: "seg-desync",
      speaker: "SPEAKER_00",
      start: 6,
      end: 7,
      text: "Some corrupted text",
      words: [
        { word: "Actually", start: 6, end: 6.5 },
        { word: "Hidden", start: 6.5, end: 7 },
      ],
    },
  ];

  const defaultProps = {
    segments,
    speakers: [],
    lexiconEntries: [],
    lexiconThreshold: 0.8,
    lexiconHighlightUnderline: false,
    lexiconHighlightBackground: false,
    spellcheckEnabled: false,
    spellcheckMatchesBySegment: new Map(),
    ...confidenceProps,
  };

  it("finds exact matches", () => {
    const { result } = renderHook(() => useFiltersAndLexicon(defaultProps));

    act(() => {
      result.current.setSearchQuery("Müller");
    });

    expect(result.current.filteredSegments).toHaveLength(1);
    expect(result.current.filteredSegments[0].id).toBe("seg-unicode");
  });

  it("finds case-insensitive matches", () => {
    const { result } = renderHook(() => useFiltersAndLexicon(defaultProps));

    act(() => {
      result.current.setSearchQuery("müller");
    });

    expect(result.current.filteredSegments).toHaveLength(1);
    expect(result.current.filteredSegments[0].id).toBe("seg-unicode");
  });

  it("finds matches with punctuation in text but not in query", () => {
    const { result } = renderHook(() => useFiltersAndLexicon(defaultProps));

    act(() => {
      result.current.setSearchQuery("bluebird");
    });

    expect(result.current.filteredSegments).toContainEqual(
      expect.objectContaining({ id: "seg-punct" }),
    );
  });

  it("finds matches in words array even if text is different (robustness)", () => {
    const { result } = renderHook(() => useFiltersAndLexicon(defaultProps));

    act(() => {
      result.current.setSearchQuery("Hidden");
    });

    expect(result.current.filteredSegments).toHaveLength(1);
    expect(result.current.filteredSegments[0].id).toBe("seg-desync");
  });

  it("finds matches using Regex", () => {
    const { result } = renderHook(() => useFiltersAndLexicon(defaultProps));

    act(() => {
      result.current.setIsRegexSearch(true);
      result.current.setSearchQuery("blue.*bird");
    });

    // Should match "The bluebird." and "blue - bird"
    expect(result.current.filteredSegments).toHaveLength(2);
    const ids = result.current.filteredSegments.map((s) => s.id);
    expect(ids).toContain("seg-punct");
    expect(ids).toContain("seg-split");
  });

  it("handles invalid regex gracefully", () => {
    const { result } = renderHook(() => useFiltersAndLexicon(defaultProps));

    act(() => {
      result.current.setIsRegexSearch(true);
      result.current.setSearchQuery("[invalid");
    });

    // Should return all segments or none?
    // Implementation: if (!regex) return true; -> ALL segments
    expect(result.current.filteredSegments).toHaveLength(segments.length);
  });

  it("handles Unicode normalization (NFC)", () => {
    const { result } = renderHook(() => useFiltersAndLexicon(defaultProps));

    // Decomposed u + umlaut
    const decomposed = "u\u0308";

    act(() => {
      result.current.setSearchQuery(`M${decomposed}ller`);
    });

    expect(result.current.filteredSegments).toHaveLength(1);
    expect(result.current.filteredSegments[0].id).toBe("seg-unicode");
  });
});
