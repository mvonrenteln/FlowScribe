import { type Segment, useTranscriptStore } from "@/lib/store";
import type { TranscriptStore } from "@/lib/store/types";

export const createBaseState = (): TranscriptStore => {
  const current = useTranscriptStore.getState();
  return {
    ...current,
    audioFile: null,
    audioUrl: null,
    audioRef: null,
    transcriptRef: null,
    sessionKey: "audio:none|transcript:none",
    sessionKind: "current",
    sessionLabel: null,
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
    spellcheckEnabled: false,
    spellcheckLanguages: ["de"],
    spellcheckIgnoreWords: [],
    spellcheckCustomEnabled: false,
    spellcheckCustomDictionaries: [],
    spellcheckCustomDictionariesLoaded: false,
    aiSegmentMergeBatchLog: [],
    recentSessions: [],
    confidenceScoresVersion: 0,
  };
};

export const sampleSegments: Segment[] = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    start: 0,
    end: 1.2,
    text: "Hallo Welt",
    words: [
      { word: "Hallo", start: 0, end: 0.6 },
      { word: "Welt", start: 0.6, end: 1.2 },
    ],
    tags: [],
  },
  {
    id: "seg-2",
    speaker: "SPEAKER_01",
    start: 1.2,
    end: 2.6,
    text: "Guten Morgen",
    words: [
      { word: "Guten", start: 1.2, end: 1.9 },
      { word: "Morgen", start: 1.9, end: 2.6 },
    ],
    tags: [],
  },
];

export const resetStore = () => {
  useTranscriptStore.setState(createBaseState());
  window.localStorage.clear();
};
