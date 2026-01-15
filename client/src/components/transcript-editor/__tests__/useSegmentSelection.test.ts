import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useTranscriptStore } from "@/lib/store";
import { useSegmentSelection } from "../useSegmentSelection";

const baseSegment = {
  speaker: "SPEAKER_00",
  text: "Hello",
  words: [{ word: "Hello", start: 0, end: 1 }],
};

const resetStore = () => {
  useTranscriptStore.setState({
    audioFile: null,
    audioUrl: null,
    audioRef: null,
    transcriptRef: null,
    sessionKey: "audio:none|transcript:none",
    baseSessionKey: null,
    segments: [],
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

describe("useSegmentSelection", () => {
  beforeEach(() => {
    resetStore();
  });

  it("exposes merge handlers only for adjacent segments", () => {
    const segments = [
      { ...baseSegment, id: "segment-1", tags: [], start: 0, end: 1 },
      { ...baseSegment, id: "segment-2", tags: [], start: 1, end: 2 },
      { ...baseSegment, id: "segment-3", tags: [], start: 3, end: 4 },
    ];

    const { result } = renderHook(() =>
      useSegmentSelection({
        segments,
        filteredSegments: segments,
        currentTime: 0,
        isPlaying: false,
        selectedSegmentId: "segment-2",
        setSelectedSegmentId: useTranscriptStore.getState().setSelectedSegmentId,
        setCurrentTime: useTranscriptStore.getState().setCurrentTime,
        setIsPlaying: useTranscriptStore.getState().setIsPlaying,
        requestSeek: useTranscriptStore.getState().requestSeek,
        clearSeekRequest: useTranscriptStore.getState().clearSeekRequest,
        splitSegment: useTranscriptStore.getState().splitSegment,
        confirmSegment: useTranscriptStore.getState().confirmSegment,
        toggleSegmentBookmark: useTranscriptStore.getState().toggleSegmentBookmark,
        deleteSegment: useTranscriptStore.getState().deleteSegment,
        updateSegmentText: useTranscriptStore.getState().updateSegmentText,
        updateSegmentSpeaker: useTranscriptStore.getState().updateSegmentSpeaker,
        mergeSegments: useTranscriptStore.getState().mergeSegments,
        addLexiconFalsePositive: useTranscriptStore.getState().addLexiconFalsePositive,
        filterLowConfidence: false,
        activeSpeakerName: null,
        lowConfidenceThreshold: null,
        isTranscriptEditing: () => false,
      }),
    );

    const handlers = result.current.segmentHandlers;

    expect(handlers[1]?.onMergeWithPrevious).toBeDefined();
    expect(handlers[1]?.onMergeWithNext).toBeDefined();
    expect(handlers[0]?.onMergeWithPrevious).toBeUndefined();
    expect(handlers[2]?.onMergeWithNext).toBeUndefined();
  });

  it("preserves playback position when splitting while playing", () => {
    const segments = [
      {
        ...baseSegment,
        id: "segment-1",
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
    ];

    useTranscriptStore.setState({
      segments,
      currentTime: 1.2,
      isPlaying: true,
      seekRequestTime: null,
    });
    const { result } = renderHook(() =>
      useSegmentSelection({
        segments,
        filteredSegments: segments,
        currentTime: 1.2,
        isPlaying: true,
        selectedSegmentId: "segment-1",
        setSelectedSegmentId: useTranscriptStore.getState().setSelectedSegmentId,
        setCurrentTime: useTranscriptStore.getState().setCurrentTime,
        setIsPlaying: useTranscriptStore.getState().setIsPlaying,
        requestSeek: useTranscriptStore.getState().requestSeek,
        clearSeekRequest: useTranscriptStore.getState().clearSeekRequest,
        splitSegment: useTranscriptStore.getState().splitSegment,
        confirmSegment: useTranscriptStore.getState().confirmSegment,
        toggleSegmentBookmark: useTranscriptStore.getState().toggleSegmentBookmark,
        deleteSegment: useTranscriptStore.getState().deleteSegment,
        updateSegmentText: useTranscriptStore.getState().updateSegmentText,
        updateSegmentSpeaker: useTranscriptStore.getState().updateSegmentSpeaker,
        mergeSegments: useTranscriptStore.getState().mergeSegments,
        addLexiconFalsePositive: useTranscriptStore.getState().addLexiconFalsePositive,
        filterLowConfidence: false,
        activeSpeakerName: null,
        lowConfidenceThreshold: null,
        isTranscriptEditing: () => false,
      }),
    );

    act(() => {
      result.current.segmentHandlers[0]?.onSplit?.(1);
    });

    const state = useTranscriptStore.getState();
    expect(state.currentTime).toBeCloseTo(1.2, 5);
    expect(state.seekRequestTime).toBeNull();
    expect(state.segments).toHaveLength(2);
  });
});
