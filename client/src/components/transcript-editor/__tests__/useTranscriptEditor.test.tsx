import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTranscriptStore } from "@/lib/store";
import { useTranscriptEditor } from "../useTranscriptEditor";

vi.mock("../useNavigationHotkeys", () => ({
  useNavigationHotkeys: vi.fn(),
}));

vi.mock("@/lib/audioHandleStorage", () => ({
  loadAudioHandle: vi.fn().mockResolvedValue(null),
  queryAudioHandlePermission: vi.fn().mockResolvedValue(false),
}));

const resetStore = () => {
  useTranscriptStore.setState({
    audioFile: null,
    audioUrl: null,
    audioRef: null,
    transcriptRef: null,
    sessionKey: "audio:none|transcript:none",
    baseSessionKey: null,
    segments: [],
    speakers: [],
    selectedSegmentId: null,
    currentTime: 0,
    isPlaying: false,
    duration: 0,
    seekRequestTime: null,
    history: [],
    historyIndex: -1,
    isWhisperXFormat: false,
    lexiconEntries: [],
    lexiconThreshold: 0.82,
    lexiconHighlightUnderline: false,
    lexiconHighlightBackground: false,
    highlightLowConfidence: false,
    manualConfidenceThreshold: null,
    spellcheckEnabled: false,
    spellcheckLanguages: ["de"],
    spellcheckIgnoreWords: [],
    spellcheckCustomEnabled: false,
    spellcheckCustomDictionaries: [],
    spellcheckCustomDictionariesLoaded: false,
    recentSessions: [],
  });
};

describe("useTranscriptEditor", () => {
  beforeEach(() => {
    resetStore();
  });

  it("exposes merge handlers only for adjacent segments", async () => {
    act(() => {
      useTranscriptStore.setState({
        segments: [
          {
            id: "segment-1",
            speaker: "SPEAKER_00",
            tags: [],
            start: 0,
            end: 1,
            text: "Hallo",
            words: [{ word: "Hallo", start: 0, end: 1 }],
          },
          {
            id: "segment-2",
            speaker: "SPEAKER_00",
            tags: [],
            start: 1,
            end: 2,
            text: "Welt",
            words: [{ word: "Welt", start: 1, end: 2 }],
          },
          {
            id: "segment-3",
            speaker: "SPEAKER_00",
            tags: [],
            start: 3,
            end: 4,
            text: "Servus",
            words: [{ word: "Servus", start: 3, end: 4 }],
          },
        ],
        speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
        selectedSegmentId: "segment-2",
      });
    });

    const { result } = renderHook(() => useTranscriptEditor());
    await waitFor(() => {
      expect(result.current.transcriptListProps).toBeTruthy();
    });
    const handlers = result.current.transcriptListProps.segmentHandlers;

    expect(handlers[1]?.onMergeWithPrevious).toBeDefined();
    expect(handlers[1]?.onMergeWithNext).toBeDefined();
    expect(handlers[0]?.onMergeWithPrevious).toBeUndefined();
    expect(handlers[2]?.onMergeWithNext).toBeUndefined();
  });

  it("preserves playback position when splitting while playing", async () => {
    act(() => {
      useTranscriptStore.setState({
        segments: [
          {
            id: "segment-1",
            speaker: "SPEAKER_00",
            tags: [],
            start: 0,
            end: 3,
            text: "Hallo Welt Heute",
            words: [
              { word: "Hallo", start: 0, end: 1 },
              { word: "Welt", start: 1, end: 2 },
              { word: "Heute", start: 2, end: 3 },
            ],
          },
        ],
        currentTime: 1.2,
        isPlaying: true,
        seekRequestTime: null,
      });
    });

    const { result } = renderHook(() => useTranscriptEditor());
    await waitFor(() => {
      expect(result.current.transcriptListProps).toBeTruthy();
    });
    const splitHandler = result.current.transcriptListProps.segmentHandlers[0]?.onSplit;

    act(() => {
      splitHandler?.(1);
    });

    const state = useTranscriptStore.getState();
    expect(state.currentTime).toBeCloseTo(1.2, 5);
    expect(state.seekRequestTime).toBeNull();
    expect(state.segments).toHaveLength(2);
  });

  it("selects the first search match segment", async () => {
    act(() => {
      useTranscriptStore.setState({
        segments: [
          {
            id: "segment-1",
            speaker: "SPEAKER_00",
            tags: [],
            start: 0,
            end: 1,
            text: "Hallo Welt",
            words: [{ word: "Hallo", start: 0, end: 0.5 }],
          },
          {
            id: "segment-2",
            speaker: "SPEAKER_00",
            tags: [],
            start: 1,
            end: 2,
            text: "Servus",
            words: [{ word: "Servus", start: 1, end: 2 }],
          },
        ],
        selectedSegmentId: null,
      });
    });

    const { result } = renderHook(() => useTranscriptEditor());
    await waitFor(() => {
      expect(result.current.filterPanelProps).toBeTruthy();
    });

    act(() => {
      result.current.filterPanelProps.onSearchQueryChange("Hallo");
    });

    expect(useTranscriptStore.getState().selectedSegmentId).toBe("segment-1");
  });
});
