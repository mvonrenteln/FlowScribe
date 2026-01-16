import { act, renderHook, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Segment } from "@/lib/store";
import { getEmptyStateMessage, useFiltersAndLexicon } from "../useFiltersAndLexicon";
import { useScrollAndSelection } from "../useScrollAndSelection";

// Base confidence props for all tests
const confidenceProps = {
  highlightLowConfidence: false,
  manualConfidenceThreshold: null,
  setHighlightLowConfidence: vi.fn(),
  setManualConfidenceThreshold: vi.fn(),
};

describe("useFiltersAndLexicon", () => {
  const baseSegments: Segment[] = [
    {
      id: "segment-1",
      speaker: "SPEAKER_00",
      start: 0,
      end: 1,
      text: "Hallo",
      words: [{ word: "Hallo", start: 0, end: 1 }],
      tags: [],
    },
    {
      id: "segment-2",
      speaker: "SPEAKER_00",
      start: 2,
      end: 3,
      text: "Welt",
      words: [{ word: "Welt", start: 2, end: 3 }],
      tags: [],
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
        tags: [],
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
        ...confidenceProps,
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
        tags: [],
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
        ...confidenceProps,
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
        tags: [],
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
        ...confidenceProps,
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
        ...confidenceProps,
      }),
    );

    expect(result.current.lexiconMatchesBySegment.get("segment-1")?.get(0)?.term).toBe("Hallo");

    act(() => result.current.setFilterLexicon(true));
    expect(result.current.filteredSegments).toHaveLength(1);
    expect(result.current.filteredSegments[0]?.id).toBe("segment-1");
  });

  it("excludes confirmed segments from lexicon matches", () => {
    const segments: Segment[] = [
      {
        id: "segment-confirmed",
        speaker: "SPEAKER_00",
        start: 0,
        end: 1,
        text: "Hallo",
        words: [{ word: "Hallo", start: 0, end: 1 }],
        confirmed: true,
      },
      {
        id: "segment-open",
        speaker: "SPEAKER_00",
        start: 2,
        end: 3,
        text: "Hallo",
        words: [{ word: "Hallo", start: 2, end: 3 }],
      },
    ];

    const { result } = renderHook(() =>
      useFiltersAndLexicon({
        segments,
        speakers: [],
        lexiconEntries: [{ term: "Hallo", variants: [], falsePositives: [] }],
        lexiconThreshold: 0.8,
        lexiconHighlightUnderline: false,
        lexiconHighlightBackground: false,
        spellcheckEnabled: false,
        spellcheckMatchesBySegment: new Map(),
        ...confidenceProps,
      }),
    );

    expect(result.current.lexiconMatchesBySegment.has("segment-confirmed")).toBe(false);
    expect(result.current.lexiconMatchCount).toBe(1);

    act(() => result.current.setFilterLexicon(true));
    expect(result.current.filteredSegments).toHaveLength(1);
    expect(result.current.filteredSegments[0]?.id).toBe("segment-open");
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
        ...confidenceProps,
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
      tags: [],
    },
    {
      id: "segment-2",
      speaker: "SPEAKER_00",
      start: 2,
      end: 3,
      text: "Servus",
      words: [{ word: "Servus", start: 2, end: 3 }],
      tags: [],
    },
  ];

  it("seeks to the next filtered segment during restricted playback", async () => {
    const setSelectedSegmentId = vi.fn();
    const seekToTime = vi.fn();
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
        seekToTime,
        setIsPlaying,
      }),
    );

    await waitFor(() => {
      expect(seekToTime).toHaveBeenCalledWith(2, { source: "system", action: "restrict_playback" });
      expect(setSelectedSegmentId).toHaveBeenCalledWith("segment-2");
    });
    expect(setIsPlaying).not.toHaveBeenCalled();
  });

  it("keeps the active segment selected when visible", async () => {
    const setSelectedSegmentId = vi.fn();
    const seekToTime = vi.fn();
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
        seekToTime,
        setIsPlaying,
      }),
    );

    await waitFor(() => {
      expect(setSelectedSegmentId).toHaveBeenCalledWith(activeSegment.id);
    });
  });

  it("scrolls to the active segment when selection is stale", async () => {
    const setSelectedSegmentId = vi.fn();
    const seekToTime = vi.fn();
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
        seekToTime,
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
      seekToTime,
      setIsPlaying,
    });

    expect(scrollIntoView).toHaveBeenCalled();

    const [firstInstance] = scrollIntoView.mock.instances as HTMLElement[];
    expect(firstInstance?.dataset.segmentId).toBe("segment-2");

    rafSpy.mockRestore();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("scrolls during playback even if visibility check is strict", async () => {
    const setSelectedSegmentId = vi.fn();
    const seekToTime = vi.fn();
    const setIsPlaying = vi.fn();
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      },
    );

    const { result, rerender } = renderHook((props) => useScrollAndSelection(props), {
      initialProps: {
        segments,
        currentTime: 0.5,
        selectedSegmentId: "segment-1",
        isPlaying: true,
        isTranscriptEditing: () => false,
        activeSpeakerName: undefined,
        filteredSegments: segments,
        restrictPlaybackToFiltered: false,
        lowConfidenceThreshold: 0.2,
        setSelectedSegmentId,
        seekToTime,
        setIsPlaying,
      },
    });

    const container = document.createElement("div");
    const segment2 = document.createElement("div");
    segment2.dataset.segmentId = "segment-2";
    container.appendChild(segment2);

    const viewport = document.createElement("div");
    viewport.appendChild(container);

    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 100,
      height: 100,
    } as DOMRect);
    vi.spyOn(segment2, "getBoundingClientRect").mockReturnValue({
      top: 150,
      bottom: 200,
      height: 50,
    } as DOMRect);

    act(() => {
      const transcriptListRef = result.current
        .transcriptListRef as MutableRefObject<HTMLElement | null>;
      transcriptListRef.current = container;
    });

    rerender({
      segments,
      currentTime: 2.5,
      selectedSegmentId: "segment-1",
      isPlaying: true,
      isTranscriptEditing: () => false,
      activeSpeakerName: undefined,
      filteredSegments: segments,
      restrictPlaybackToFiltered: false,
      lowConfidenceThreshold: 0.2,
      setSelectedSegmentId,
      seekToTime,
      setIsPlaying,
    });

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    vi.restoreAllMocks();
  });

  it("scrolls to the next segment when in a silent gap during playback", async () => {
    const setSelectedSegmentId = vi.fn();
    const seekToTime = vi.fn();
    const setIsPlaying = vi.fn();
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      },
    );

    const { result, rerender } = renderHook((props) => useScrollAndSelection(props), {
      initialProps: {
        segments,
        currentTime: 0.5,
        selectedSegmentId: "segment-1",
        isPlaying: true,
        isTranscriptEditing: () => false,
        activeSpeakerName: undefined,
        filteredSegments: segments,
        restrictPlaybackToFiltered: false,
        lowConfidenceThreshold: 0.2,
        setSelectedSegmentId,
        seekToTime,
        setIsPlaying,
      },
    });

    const container = document.createElement("div");
    const segment2 = document.createElement("div");
    segment2.dataset.segmentId = "segment-2";
    container.appendChild(segment2);

    act(() => {
      const transcriptListRef = result.current
        .transcriptListRef as MutableRefObject<HTMLElement | null>;
      transcriptListRef.current = container;
    });

    rerender({
      segments,
      currentTime: 1.5,
      selectedSegmentId: "segment-1",
      isPlaying: true,
      isTranscriptEditing: () => false,
      activeSpeakerName: undefined,
      filteredSegments: segments,
      restrictPlaybackToFiltered: false,
      lowConfidenceThreshold: 0.2,
      setSelectedSegmentId,
      seekToTime,
      setIsPlaying,
    });

    await waitFor(() => {
      const [firstInstance] = scrollIntoView.mock.instances as HTMLElement[];
      expect(firstInstance?.dataset.segmentId).toBe("segment-2");
    });

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    vi.restoreAllMocks();
  });

  it("forces a jump (auto) scroll when a significant time seek is detected", async () => {
    const setSelectedSegmentId = vi.fn();
    const seekToTime = vi.fn();
    const setIsPlaying = vi.fn();
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      },
    );

    const { result, rerender } = renderHook((props) => useScrollAndSelection(props), {
      initialProps: {
        segments,
        currentTime: 0.5,
        selectedSegmentId: "segment-1",
        isPlaying: true,
        isTranscriptEditing: () => false,
        activeSpeakerName: undefined,
        filteredSegments: segments,
        restrictPlaybackToFiltered: false,
        lowConfidenceThreshold: 0.2,
        setSelectedSegmentId,
        seekToTime,
        setIsPlaying,
      },
    });

    const container = document.createElement("div");
    const segment2 = document.createElement("div");
    segment2.dataset.segmentId = "segment-2";
    container.appendChild(segment2);

    // Viewport and segment are mocked such that segment2 is already visible
    // but because it's a SEEK (0.5 -> 2.5), we expect it to scroll anyway (with "auto")
    const viewport = document.createElement("div");
    viewport.appendChild(container);
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 100,
      height: 100,
    } as DOMRect);
    vi.spyOn(segment2, "getBoundingClientRect").mockReturnValue({
      top: 30,
      bottom: 70,
      height: 40,
    } as DOMRect);

    act(() => {
      const transcriptListRef = result.current
        .transcriptListRef as MutableRefObject<HTMLElement | null>;
      transcriptListRef.current = container;
    });

    // Manual seek: 0.5 -> 2.5
    rerender({
      segments,
      currentTime: 2.5,
      selectedSegmentId: "segment-1",
      isPlaying: true,
      isTranscriptEditing: () => false,
      activeSpeakerName: undefined,
      filteredSegments: segments,
      restrictPlaybackToFiltered: false,
      lowConfidenceThreshold: 0.2,
      setSelectedSegmentId,
      seekToTime,
      setIsPlaying,
    });

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
      const options = scrollIntoView.mock.calls[0][0];
      expect(options.behavior).toBe("auto");
    });

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    vi.restoreAllMocks();
  });
});

describe("useFiltersAndLexicon - Tag filtering", () => {
  it("filters segments by single tag ID", () => {
    const segments: Segment[] = [
      {
        id: "seg-1",
        speaker: "SPEAKER_00",
        start: 0,
        end: 1,
        text: "Tagged with OOC",
        words: [],
        tags: ["tag-ooc"],
      },
      {
        id: "seg-2",
        speaker: "SPEAKER_00",
        start: 1,
        end: 2,
        text: "No tags",
        words: [],
        tags: [],
      },
      {
        id: "seg-3",
        speaker: "SPEAKER_00",
        start: 2,
        end: 3,
        text: "Tagged with Production",
        words: [],
        tags: ["tag-prod"],
      },
    ];

    const { result } = renderHook(() =>
      useFiltersAndLexicon({
        segments,
        speakers: [],
        lexiconEntries: [],
        lexiconThreshold: 0.8,
        lexiconHighlightUnderline: false,
        lexiconHighlightBackground: false,
        spellcheckEnabled: false,
        spellcheckMatchesBySegment: new Map(),
        ...confidenceProps,
      }),
    );

    act(() => result.current.setFilterTagIds(["tag-ooc"]));

    expect(result.current.filteredSegments).toHaveLength(1);
    expect(result.current.filteredSegments[0].id).toBe("seg-1");
  });

  it("filters segments by multiple tag IDs with OR-logic", () => {
    const segments: Segment[] = [
      {
        id: "seg-1",
        speaker: "SPEAKER_00",
        start: 0,
        end: 1,
        text: "Tagged with OOC",
        words: [],
        tags: ["tag-ooc"],
      },
      {
        id: "seg-2",
        speaker: "SPEAKER_00",
        start: 1,
        end: 2,
        text: "Tagged with Production",
        words: [],
        tags: ["tag-prod"],
      },
      {
        id: "seg-3",
        speaker: "SPEAKER_00",
        start: 2,
        end: 3,
        text: "Tagged with both",
        words: [],
        tags: ["tag-ooc", "tag-prod"],
      },
      {
        id: "seg-4",
        speaker: "SPEAKER_00",
        start: 3,
        end: 4,
        text: "No tags",
        words: [],
        tags: [],
      },
    ];

    const { result } = renderHook(() =>
      useFiltersAndLexicon({
        segments,
        speakers: [],
        lexiconEntries: [],
        lexiconThreshold: 0.8,
        lexiconHighlightUnderline: false,
        lexiconHighlightBackground: false,
        spellcheckEnabled: false,
        spellcheckMatchesBySegment: new Map(),
        ...confidenceProps,
      }),
    );

    // Filter by OOC OR Production (OR-logic)
    act(() => result.current.setFilterTagIds(["tag-ooc", "tag-prod"]));

    expect(result.current.filteredSegments).toHaveLength(3);
    const ids = result.current.filteredSegments.map((s) => s.id);
    expect(ids).toContain("seg-1");
    expect(ids).toContain("seg-2");
    expect(ids).toContain("seg-3");
    expect(ids).not.toContain("seg-4");
  });

  it("filters segments with no tags when filterNoTags is true", () => {
    const segments: Segment[] = [
      {
        id: "seg-1",
        speaker: "SPEAKER_00",
        start: 0,
        end: 1,
        text: "Tagged",
        words: [],
        tags: ["tag-ooc"],
      },
      {
        id: "seg-2",
        speaker: "SPEAKER_00",
        start: 1,
        end: 2,
        text: "No tags",
        words: [],
        tags: [],
      },
      {
        id: "seg-3",
        speaker: "SPEAKER_00",
        start: 2,
        end: 3,
        text: "Also no tags",
        words: [],
        tags: [],
      },
    ];

    const { result } = renderHook(() =>
      useFiltersAndLexicon({
        segments,
        speakers: [],
        lexiconEntries: [],
        lexiconThreshold: 0.8,
        lexiconHighlightUnderline: false,
        lexiconHighlightBackground: false,
        spellcheckEnabled: false,
        spellcheckMatchesBySegment: new Map(),
        ...confidenceProps,
      }),
    );

    act(() => result.current.setFilterNoTags(true));

    expect(result.current.filteredSegments).toHaveLength(2);
    const ids = result.current.filteredSegments.map((s) => s.id);
    expect(ids).toContain("seg-2");
    expect(ids).toContain("seg-3");
    expect(ids).not.toContain("seg-1");
  });

  it("clears tag filters when clearFilters is called", () => {
    const segments: Segment[] = [
      {
        id: "seg-1",
        speaker: "SPEAKER_00",
        start: 0,
        end: 1,
        text: "Tagged",
        words: [],
        tags: ["tag-ooc"],
      },
      {
        id: "seg-2",
        speaker: "SPEAKER_00",
        start: 1,
        end: 2,
        text: "No tags",
        words: [],
        tags: [],
      },
    ];

    const { result } = renderHook(() =>
      useFiltersAndLexicon({
        segments,
        speakers: [],
        lexiconEntries: [],
        lexiconThreshold: 0.8,
        lexiconHighlightUnderline: false,
        lexiconHighlightBackground: false,
        spellcheckEnabled: false,
        spellcheckMatchesBySegment: new Map(),
        ...confidenceProps,
      }),
    );

    act(() => {
      result.current.setFilterTagIds(["tag-ooc"]);
      result.current.setFilterNoTags(true);
    });

    expect(result.current.filterTagIds).toHaveLength(1);
    expect(result.current.filterNoTags).toBe(true);

    act(() => result.current.clearFilters());

    expect(result.current.filterTagIds).toHaveLength(0);
    expect(result.current.filterNoTags).toBe(false);
    expect(result.current.filteredSegments).toHaveLength(2);
  });

  it("combines tag filter with speaker filter", () => {
    const segments: Segment[] = [
      {
        id: "seg-1",
        speaker: "Alice",
        start: 0,
        end: 1,
        text: "Alice with OOC",
        words: [],
        tags: ["tag-ooc"],
      },
      {
        id: "seg-2",
        speaker: "Bob",
        start: 1,
        end: 2,
        text: "Bob with OOC",
        words: [],
        tags: ["tag-ooc"],
      },
      {
        id: "seg-3",
        speaker: "Alice",
        start: 2,
        end: 3,
        text: "Alice without tags",
        words: [],
        tags: [],
      },
    ];

    const speakers = [
      { id: "SPEAKER_00", name: "Alice", color: "#000" },
      { id: "SPEAKER_01", name: "Bob", color: "#111" },
    ];

    const { result } = renderHook(() =>
      useFiltersAndLexicon({
        segments,
        speakers,
        lexiconEntries: [],
        lexiconThreshold: 0.8,
        lexiconHighlightUnderline: false,
        lexiconHighlightBackground: false,
        spellcheckEnabled: false,
        spellcheckMatchesBySegment: new Map(),
        ...confidenceProps,
      }),
    );

    // Filter: Alice AND has OOC tag
    act(() => {
      result.current.setFilterSpeakerId("SPEAKER_00");
      result.current.setFilterTagIds(["tag-ooc"]);
    });

    expect(result.current.filteredSegments).toHaveLength(1);
    expect(result.current.filteredSegments[0].id).toBe("seg-1");
  });
});
