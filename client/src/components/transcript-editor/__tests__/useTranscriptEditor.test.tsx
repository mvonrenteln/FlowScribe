import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTranscriptStore } from "@/lib/store";
import { useTranscriptEditor } from "../useTranscriptEditor";

const resetStore = () => {
  useTranscriptStore.setState({
    audioFile: null,
    audioUrl: null,
    audioRef: null,
    transcriptRef: null,
    sessionKey: "audio:none|transcript:none",
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

  it("exposes merge handlers only for adjacent segments", () => {
    useTranscriptStore.setState({
      segments: [
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
          start: 1,
          end: 2,
          text: "Welt",
          words: [{ word: "Welt", start: 1, end: 2 }],
        },
        {
          id: "segment-3",
          speaker: "SPEAKER_00",
          start: 3,
          end: 4,
          text: "Servus",
          words: [{ word: "Servus", start: 3, end: 4 }],
        },
      ],
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
      selectedSegmentId: "segment-2",
    });

    const { result } = renderHook(() => useTranscriptEditor());
    const handlers = result.current.transcriptListProps.segmentHandlers;

    expect(handlers[1]?.onMergeWithPrevious).toBeDefined();
    expect(handlers[1]?.onMergeWithNext).toBeDefined();
    expect(handlers[0]?.onMergeWithPrevious).toBeUndefined();
    expect(handlers[2]?.onMergeWithNext).toBeUndefined();
  });

  it("preserves playback position when splitting while playing", () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
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

    const { result } = renderHook(() => useTranscriptEditor());
    const splitHandler = result.current.transcriptListProps.segmentHandlers[0]?.onSplit;

    act(() => {
      splitHandler?.(1);
    });

    const state = useTranscriptStore.getState();
    expect(state.currentTime).toBeCloseTo(1.2, 5);
    expect(state.seekRequestTime).toBeNull();
    expect(state.segments).toHaveLength(2);
  });
});
