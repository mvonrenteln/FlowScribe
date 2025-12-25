import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Segment } from "@/lib/store";
import { getEmptyStateMessage, useFiltersAndLexicon } from "../useFiltersAndLexicon";
import { useScrollAndSelection } from "../useScrollAndSelection";

describe("useFiltersAndLexicon", () => {
  const baseSegments: Segment[] = [
    {
      id: "segment-1",
      speaker: "SPEAKER_00",
      start: 0,
      end: 1,
      text: "Hallo",
      words: [{ word: "Hallo", start: 0, end: 1 }],
    },
    {
      id: "segment-2",
      speaker: "SPEAKER_00",
      start: 2,
      end: 3,
      text: "Welt",
      words: [{ word: "Welt", start: 2, end: 3 }],
    },
  ];

  it("returns lexicon matches and filters segments", () => {
    const spellcheckMatches = new Map<string, Map<number, unknown>>();
    const { result } = renderHook(() =>
      useFiltersAndLexicon({
        segments: baseSegments,
        speakers: [],
        lexiconEntries: [{ term: "Hallo", variants: [], falsePositives: [] }],
        lexiconThreshold: 0.8,
        lexiconHighlightUnderline: false,
        lexiconHighlightBackground: false,
        spellcheckEnabled: false,
        spellcheckMatchesBySegment: spellcheckMatches,
      }),
    );

    expect(result.current.lexiconMatchesBySegment.get("segment-1")?.get(0)?.term).toBe("Hallo");

    act(() => result.current.setFilterLexicon(true));
    expect(result.current.filteredSegments).toHaveLength(1);
    expect(result.current.filteredSegments[0]?.id).toBe("segment-1");
  });

  it("filters by spellcheck matches and computes empty state", () => {
    const spellcheckMatches = new Map<string, Map<number, unknown>>([
      ["segment-2", new Map([[0, {}]])],
    ]);
    const { result } = renderHook(() =>
      useFiltersAndLexicon({
        segments: baseSegments,
        speakers: [],
        lexiconEntries: [],
        lexiconThreshold: 0.8,
        lexiconHighlightUnderline: false,
        lexiconHighlightBackground: false,
        spellcheckEnabled: true,
        spellcheckMatchesBySegment: spellcheckMatches,
      }),
    );

    act(() => result.current.setFilterSpellcheck(true));
    expect(result.current.filteredSegments).toHaveLength(1);
    expect(result.current.filteredSegments[0]?.id).toBe("segment-2");

    const emptyState = getEmptyStateMessage({
      segments: baseSegments,
      filterSpellcheck: true,
      filterLowConfidence: false,
      activeSpeakerName: "Speaker One",
    });
    expect(emptyState.title).toMatch(/No spelling issues/i);
  });
});

describe("useScrollAndSelection", () => {
  const segments: Segment[] = [
    {
      id: "segment-1",
      speaker: "SPEAKER_00",
      start: 0,
      end: 1,
      text: "Hallo",
      words: [{ word: "Hallo", start: 0, end: 1 }],
    },
    {
      id: "segment-2",
      speaker: "SPEAKER_00",
      start: 2,
      end: 3,
      text: "Servus",
      words: [{ word: "Servus", start: 2, end: 3 }],
    },
  ];

  it("seeks to the next filtered segment during restricted playback", async () => {
    const setSelectedSegmentId = vi.fn();
    const requestSeek = vi.fn();
    const setIsPlaying = vi.fn();

    renderHook(() =>
      useScrollAndSelection({
        segments,
        currentTime: 0.5,
        selectedSegmentId: null,
        isPlaying: true,
        isTranscriptEditing: () => false,
        activeSpeakerName: undefined,
        filteredSegments: [segments[1]],
        restrictPlaybackToFiltered: true,
        lowConfidenceThreshold: 0.2,
        setSelectedSegmentId,
        requestSeek,
        setIsPlaying,
      }),
    );

    await waitFor(() => {
      expect(requestSeek).toHaveBeenCalledWith(2);
      expect(setSelectedSegmentId).toHaveBeenCalledWith("segment-2");
    });
    expect(setIsPlaying).not.toHaveBeenCalled();
  });

  it("keeps the active segment selected when visible", async () => {
    const setSelectedSegmentId = vi.fn();
    const requestSeek = vi.fn();
    const setIsPlaying = vi.fn();
    const activeSegment = segments[0];

    renderHook(() =>
      useScrollAndSelection({
        segments,
        currentTime: 0.5,
        selectedSegmentId: null,
        isPlaying: false,
        isTranscriptEditing: () => false,
        activeSpeakerName: undefined,
        filteredSegments: segments,
        restrictPlaybackToFiltered: false,
        lowConfidenceThreshold: 0.2,
        setSelectedSegmentId,
        requestSeek,
        setIsPlaying,
      }),
    );

    await waitFor(() => {
      expect(setSelectedSegmentId).toHaveBeenCalledWith(activeSegment.id);
    });
  });
});
