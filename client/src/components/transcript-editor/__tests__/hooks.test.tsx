import { act, renderHook, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
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

  it("treats glossary variants as uncertain matches", () => {
    const segments: Segment[] = [
      {
        id: "segment-variant",
        speaker: "SPEAKER_00",
        start: 0,
        end: 1,
        text: "bluebird",
        words: [{ word: "bluebird", start: 0, end: 1 }],
      },
    ];

    const { result } = renderHook(() =>
      useFiltersAndLexicon({
        segments,
        speakers: [],
        lexiconEntries: [{ term: "hydrogen", variants: ["bluebird"], falsePositives: [] }],
        lexiconThreshold: 0.9,
        lexiconHighlightUnderline: false,
        lexiconHighlightBackground: false,
        spellcheckEnabled: false,
        spellcheckMatchesBySegment: new Map(),
      }),
    );

    const match = result.current.lexiconMatchesBySegment.get("segment-variant")?.get(0);
    expect(match?.term).toBe("hydrogen");
    expect(match?.score).toBeLessThan(1);
    expect(result.current.lexiconLowScoreMatchCount).toBe(1);

    act(() => result.current.setFilterLexiconLowScore(true));
    expect(result.current.filteredSegments).toHaveLength(1);
    expect(result.current.filteredSegments[0]?.id).toBe("segment-variant");
  });

  it("matches glossary variants case-insensitively", () => {
    const segments: Segment[] = [
      {
        id: "segment-variant-case",
        speaker: "SPEAKER_00",
        start: 0,
        end: 1,
        text: "BLUEBIRD",
        words: [{ word: "BLUEBIRD", start: 0, end: 1 }],
      },
    ];

    const { result } = renderHook(() =>
      useFiltersAndLexicon({
        segments,
        speakers: [],
        lexiconEntries: [{ term: "hydrogen", variants: ["bluebird"], falsePositives: [] }],
        lexiconThreshold: 0.9,
        lexiconHighlightUnderline: false,
        lexiconHighlightBackground: false,
        spellcheckEnabled: false,
        spellcheckMatchesBySegment: new Map(),
      }),
    );

    const match = result.current.lexiconMatchesBySegment.get("segment-variant-case")?.get(0);
    expect(match?.term).toBe("hydrogen");
    expect(result.current.lexiconLowScoreMatchCount).toBe(1);
  });

  it("matches glossary variants when punctuation trails the word", () => {
    const segments: Segment[] = [
      {
        id: "segment-variant-punct",
        speaker: "SPEAKER_00",
        start: 0,
        end: 1,
        text: "bluebird,",
        words: [{ word: "bluebird,", start: 0, end: 1 }],
      },
    ];

    const { result } = renderHook(() =>
      useFiltersAndLexicon({
        segments,
        speakers: [],
        lexiconEntries: [{ term: "hydrogen", variants: ["bluebird"], falsePositives: [] }],
        lexiconThreshold: 0.9,
        lexiconHighlightUnderline: false,
        lexiconHighlightBackground: false,
        spellcheckEnabled: false,
        spellcheckMatchesBySegment: new Map(),
      }),
    );

    const match = result.current.lexiconMatchesBySegment.get("segment-variant-punct")?.get(0);
    expect(match?.term).toBe("hydrogen");
    expect(result.current.lexiconLowScoreMatchCount).toBe(1);
  });

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

  it("scrolls to the active segment when selection is stale", async () => {
    const setSelectedSegmentId = vi.fn();
    const requestSeek = vi.fn();
    const setIsPlaying = vi.fn();
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const rafSpy = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      });

    const { result, rerender } = renderHook((props) => useScrollAndSelection(props), {
      initialProps: {
        segments,
        currentTime: 2.4,
        selectedSegmentId: "segment-1",
        isPlaying: false,
        isTranscriptEditing: () => false,
        activeSpeakerName: undefined,
        filteredSegments: segments,
        restrictPlaybackToFiltered: false,
        lowConfidenceThreshold: 0.2,
        setSelectedSegmentId,
        requestSeek,
        setIsPlaying,
      },
    });

    const container = document.createElement("div");
    const segment1 = document.createElement("div");
    segment1.dataset.segmentId = "segment-1";
    const segment2 = document.createElement("div");
    segment2.dataset.segmentId = "segment-2";
    container.appendChild(segment1);
    container.appendChild(segment2);

    act(() => {
      const transcriptListRef = result.current
        .transcriptListRef as MutableRefObject<HTMLElement | null>;
      transcriptListRef.current = container;
    });
    rerender({
      segments,
      currentTime: 2.4,
      selectedSegmentId: "segment-1",
      isPlaying: false,
      isTranscriptEditing: () => false,
      activeSpeakerName: undefined,
      filteredSegments: segments,
      restrictPlaybackToFiltered: false,
      lowConfidenceThreshold: 0.2,
      setSelectedSegmentId,
      requestSeek,
      setIsPlaying,
    });

    expect(scrollIntoView).toHaveBeenCalled();

    const [firstInstance] = scrollIntoView.mock.instances as HTMLElement[];
    expect(firstInstance?.dataset.segmentId).toBe("segment-2");

    rafSpy.mockRestore();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });
});
