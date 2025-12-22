import { create } from "zustand";

export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface Segment {
  id: string;
  speaker: string;
  start: number;
  end: number;
  text: string;
  words: Word[];
}

export interface Speaker {
  id: string;
  name: string;
  color: string;
}

interface HistoryState {
  segments: Segment[];
  speakers: Speaker[];
  selectedSegmentId: string | null;
}

interface TranscriptState {
  audioFile: File | null;
  audioUrl: string | null;
  segments: Segment[];
  speakers: Speaker[];
  selectedSegmentId: string | null;
  currentTime: number;
  isPlaying: boolean;
  duration: number;
  seekRequestTime: number | null;
  history: HistoryState[];
  historyIndex: number;
  isWhisperXFormat: boolean;

  setAudioFile: (file: File | null) => void;
  setAudioUrl: (url: string | null) => void;
  loadTranscript: (data: {
    segments: Segment[];
    speakers?: Speaker[];
    isWhisperXFormat?: boolean;
  }) => void;
  setSelectedSegmentId: (id: string | null) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setDuration: (duration: number) => void;
  requestSeek: (time: number) => void;
  clearSeekRequest: () => void;

  updateSegmentText: (id: string, text: string) => void;
  updateSegmentSpeaker: (id: string, speaker: string) => void;
  splitSegment: (id: string, wordIndex: number) => void;
  mergeSegments: (id1: string, id2: string) => string | null;
  updateSegmentTiming: (id: string, start: number, end: number) => void;
  deleteSegment: (id: string) => void;

  renameSpeaker: (oldName: string, newName: string) => void;
  addSpeaker: (name: string) => void;
  mergeSpeakers: (fromName: string, toName: string) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const SPEAKER_COLORS = [
  "hsl(217, 91%, 48%)",
  "hsl(142, 76%, 36%)",
  "hsl(271, 81%, 48%)",
  "hsl(43, 96%, 42%)",
  "hsl(340, 82%, 52%)",
  "hsl(190, 90%, 40%)",
  "hsl(25, 95%, 53%)",
  "hsl(300, 76%, 45%)",
];

const MAX_HISTORY = 100;

const generateId = () => crypto.randomUUID();

const pushHistory = (history: HistoryState[], historyIndex: number, state: HistoryState) => {
  const newHistory = history.slice(0, historyIndex + 1);
  newHistory.push(state);
  const trimmedHistory =
    newHistory.length > MAX_HISTORY
      ? newHistory.slice(newHistory.length - MAX_HISTORY)
      : newHistory;
  return {
    history: trimmedHistory,
    historyIndex: trimmedHistory.length - 1,
  };
};

export const useTranscriptStore = create<TranscriptState>((set, get) => ({
  audioFile: null,
  audioUrl: null,
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

  setAudioFile: (file) => set({ audioFile: file }),
  setAudioUrl: (url) => set({ audioUrl: url }),

  loadTranscript: (data) => {
    const uniqueSpeakers = Array.from(new Set(data.segments.map((s) => s.speaker)));
    const speakers: Speaker[] =
      data.speakers ||
      uniqueSpeakers.map((name, i) => ({
        id: generateId(),
        name,
        color: SPEAKER_COLORS[i % SPEAKER_COLORS.length],
      }));

    const segments = data.segments.map((s) => ({
      ...s,
      id: s.id || generateId(),
    }));

    const selectedSegmentId = segments[0]?.id ?? null;

    set({
      segments,
      speakers,
      selectedSegmentId,
      isWhisperXFormat: data.isWhisperXFormat || false,
      history: [{ segments, speakers, selectedSegmentId }],
      historyIndex: 0,
    });
  },

  setSelectedSegmentId: (id) =>
    set((state) => {
      if (state.historyIndex < 0) {
        return { selectedSegmentId: id };
      }
      const history = [...state.history];
      const current = history[state.historyIndex];
      if (!current) {
        return { selectedSegmentId: id };
      }
      history[state.historyIndex] = { ...current, selectedSegmentId: id };
      return { selectedSegmentId: id, history };
    }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setDuration: (duration) => set({ duration }),
  requestSeek: (time) => set({ seekRequestTime: time }),
  clearSeekRequest: () => set({ seekRequestTime: null }),

  updateSegmentText: (id, text) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId } = get();
    const segment = segments.find((s) => s.id === id);
    if (!segment || segment.text === text) return;
    const newSegments = segments.map((s) => (s.id === id ? { ...s, text } : s));
    const nextHistory = pushHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      selectedSegmentId,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  updateSegmentSpeaker: (id, speaker) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId } = get();
    const segment = segments.find((s) => s.id === id);
    if (!segment || segment.speaker === speaker) return;
    const newSegments = segments.map((s) => (s.id === id ? { ...s, speaker } : s));
    const nextHistory = pushHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      selectedSegmentId,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  splitSegment: (id, wordIndex) => {
    const { segments, speakers, history, historyIndex } = get();
    const segmentIndex = segments.findIndex((s) => s.id === id);
    if (segmentIndex === -1) return;

    const segment = segments[segmentIndex];
    if (wordIndex <= 0 || wordIndex >= segment.words.length) return;

    const firstWords = segment.words.slice(0, wordIndex);
    const secondWords = segment.words.slice(wordIndex);

    const firstSegment: Segment = {
      id: generateId(),
      speaker: segment.speaker,
      start: segment.start,
      end: firstWords[firstWords.length - 1].end,
      text: firstWords.map((w) => w.word).join(" "),
      words: firstWords,
    };

    const secondSegment: Segment = {
      id: generateId(),
      speaker: segment.speaker,
      start: secondWords[0].start,
      end: segment.end,
      text: secondWords.map((w) => w.word).join(" "),
      words: secondWords,
    };

    const newSegments = [
      ...segments.slice(0, segmentIndex),
      firstSegment,
      secondSegment,
      ...segments.slice(segmentIndex + 1),
    ];

    const nextHistory = pushHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      selectedSegmentId: secondSegment.id,
    });
    set({
      segments: newSegments,
      selectedSegmentId: secondSegment.id,
      currentTime: secondSegment.start,
      seekRequestTime: secondSegment.start,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  mergeSegments: (id1, id2) => {
    const { segments, speakers, history, historyIndex } = get();
    const index1 = segments.findIndex((s) => s.id === id1);
    const index2 = segments.findIndex((s) => s.id === id2);

    if (index1 === -1 || index2 === -1) return null;
    if (Math.abs(index1 - index2) !== 1) return null;

    const [first, second] =
      index1 < index2 ? [segments[index1], segments[index2]] : [segments[index2], segments[index1]];

    const merged: Segment = {
      id: generateId(),
      speaker: first.speaker,
      start: first.start,
      end: second.end,
      text: `${first.text} ${second.text}`,
      words: [...first.words, ...second.words],
    };

    const minIndex = Math.min(index1, index2);
    const newSegments = [
      ...segments.slice(0, minIndex),
      merged,
      ...segments.slice(Math.max(index1, index2) + 1),
    ];

    const nextHistory = pushHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      selectedSegmentId: merged.id,
    });
    set({
      segments: newSegments,
      selectedSegmentId: merged.id,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
    return merged.id;
  },

  updateSegmentTiming: (id, start, end) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId } = get();
    const segment = segments.find((s) => s.id === id);
    if (!segment || (segment.start === start && segment.end === end)) return;
    const newSegments = segments.map((s) => (s.id === id ? { ...s, start, end } : s));
    const nextHistory = pushHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      selectedSegmentId,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  deleteSegment: (id) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId } = get();
    const newSegments = segments.filter((s) => s.id !== id);
    if (newSegments.length === segments.length) return;
    const nextHistory = pushHistory(history, historyIndex, {
      segments: newSegments,
      speakers,
      selectedSegmentId,
    });
    set({
      segments: newSegments,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  renameSpeaker: (oldName, newName) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId } = get();
    if (oldName === newName) return;
    if (!speakers.some((s) => s.name === oldName)) return;
    const newSpeakers = speakers.map((s) => (s.name === oldName ? { ...s, name: newName } : s));
    const newSegments = segments.map((s) =>
      s.speaker === oldName ? { ...s, speaker: newName } : s,
    );
    const nextHistory = pushHistory(history, historyIndex, {
      segments: newSegments,
      speakers: newSpeakers,
      selectedSegmentId,
    });
    set({
      segments: newSegments,
      speakers: newSpeakers,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  mergeSpeakers: (fromName, toName) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId } = get();
    if (fromName === toName) return;
    if (!speakers.some((s) => s.name === fromName)) return;
    if (!speakers.some((s) => s.name === toName)) return;

    const newSegments = segments.map((s) =>
      s.speaker === fromName ? { ...s, speaker: toName } : s,
    );
    const newSpeakers = speakers.filter((s) => s.name !== fromName);
    const nextHistory = pushHistory(history, historyIndex, {
      segments: newSegments,
      speakers: newSpeakers,
      selectedSegmentId,
    });
    set({
      segments: newSegments,
      speakers: newSpeakers,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  addSpeaker: (name) => {
    const { speakers, segments, history, historyIndex, selectedSegmentId } = get();
    if (speakers.find((s) => s.name === name)) return;

    const newSpeaker: Speaker = {
      id: generateId(),
      name,
      color: SPEAKER_COLORS[speakers.length % SPEAKER_COLORS.length],
    };
    const newSpeakers = [...speakers, newSpeaker];
    const nextHistory = pushHistory(history, historyIndex, {
      segments,
      speakers: newSpeakers,
      selectedSegmentId,
    });
    set({
      speakers: newSpeakers,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  undo: () => {
    const { history, historyIndex, selectedSegmentId } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const state = history[newIndex];
    set({
      segments: state.segments,
      speakers: state.speakers,
      selectedSegmentId: state.selectedSegmentId ?? selectedSegmentId,
      historyIndex: newIndex,
    });
  },

  redo: () => {
    const { history, historyIndex, selectedSegmentId } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const state = history[newIndex];
    set({
      segments: state.segments,
      speakers: state.speakers,
      selectedSegmentId: state.selectedSegmentId ?? selectedSegmentId,
      historyIndex: newIndex,
    });
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,
}));
