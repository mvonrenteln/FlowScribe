import { create } from "zustand";

export interface Word {
  word: string;
  start: number;
  end: number;
  speaker?: string;
  score?: number;
}

export interface Segment {
  id: string;
  speaker: string;
  start: number;
  end: number;
  text: string;
  words: Word[];
  confirmed?: boolean;
  bookmarked?: boolean;
}

export interface Speaker {
  id: string;
  name: string;
  color: string;
}

export interface LexiconEntry {
  term: string;
  variants: string[];
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
  lexiconEntries: LexiconEntry[];
  lexiconThreshold: number;
  lexiconHighlightUnderline: boolean;
  lexiconHighlightBackground: boolean;

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
  confirmSegment: (id: string) => void;
  toggleSegmentBookmark: (id: string) => void;
  setLexiconEntries: (entries: LexiconEntry[]) => void;
  addLexiconEntry: (term: string, variants?: string[]) => void;
  removeLexiconEntry: (term: string) => void;
  updateLexiconEntry: (previousTerm: string, term: string, variants?: string[]) => void;
  setLexiconThreshold: (value: number) => void;
  setLexiconHighlightUnderline: (value: boolean) => void;
  setLexiconHighlightBackground: (value: boolean) => void;
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
const STORAGE_KEY = "flowscribe:transcript-state";
const PERSIST_THROTTLE_MS = 500;

type PersistedTranscriptState = {
  segments: Segment[];
  speakers: Speaker[];
  selectedSegmentId: string | null;
  currentTime: number;
  isWhisperXFormat: boolean;
  lexiconEntries?: LexiconEntry[];
  lexiconTerms?: string[];
  lexiconThreshold: number;
  lexiconHighlightUnderline?: boolean;
  lexiconHighlightBackground?: boolean;
};

const canUseLocalStorage = () => {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
};

const readPersistedState = (): PersistedTranscriptState | null => {
  if (!canUseLocalStorage()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedTranscriptState;
    if (!Array.isArray(parsed.segments) || !Array.isArray(parsed.speakers)) {
      return null;
    }
    const selectedSegmentId =
      parsed.selectedSegmentId && parsed.segments.some((s) => s.id === parsed.selectedSegmentId)
        ? parsed.selectedSegmentId
        : (parsed.segments[0]?.id ?? null);
    const lexiconEntries = Array.isArray(parsed.lexiconEntries)
      ? parsed.lexiconEntries
          .filter((entry) => entry && typeof entry.term === "string")
          .map((entry) => ({
            term: String(entry.term),
            variants: Array.isArray(entry.variants)
              ? entry.variants.map(String).filter(Boolean)
              : [],
          }))
      : Array.isArray(parsed.lexiconTerms)
        ? parsed.lexiconTerms
            .map((term) => (typeof term === "string" ? term : String(term ?? "")))
            .filter(Boolean)
            .map((term) => ({ term, variants: [] }))
        : [];

    return {
      segments: parsed.segments,
      speakers: parsed.speakers,
      selectedSegmentId,
      currentTime: Number.isFinite(parsed.currentTime) ? parsed.currentTime : 0,
      isWhisperXFormat: Boolean(parsed.isWhisperXFormat),
      lexiconEntries,
      lexiconThreshold:
        typeof parsed.lexiconThreshold === "number" ? parsed.lexiconThreshold : 0.82,
      lexiconHighlightUnderline: Boolean(parsed.lexiconHighlightUnderline),
      lexiconHighlightBackground: Boolean(parsed.lexiconHighlightBackground),
    };
  } catch {
    return null;
  }
};

const generateId = () => crypto.randomUUID();
const normalizeLexiconTerm = (value: string) => value.trim().toLowerCase();
const normalizeLexiconVariants = (variants: string[]) => {
  const seen = new Set<string>();
  return variants
    .map((variant) => variant.trim())
    .filter((variant) => {
      const normalized = normalizeLexiconTerm(variant);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
};
const normalizeLexiconEntry = (entry: LexiconEntry): LexiconEntry | null => {
  const term = entry.term.trim();
  if (!term) return null;
  return {
    term,
    variants: normalizeLexiconVariants(entry.variants ?? []),
  };
};
const uniqueEntries = (entries: LexiconEntry[]) => {
  const seen = new Map<string, LexiconEntry>();
  entries.forEach((entry) => {
    const normalized = normalizeLexiconEntry(entry);
    if (!normalized) return;
    const key = normalizeLexiconTerm(normalized.term);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, normalized);
      return;
    }
    const mergedVariants = normalizeLexiconVariants([
      ...existing.variants,
      ...normalized.variants,
    ]);
    seen.set(key, { term: existing.term, variants: mergedVariants });
  });
  return Array.from(seen.values());
};

const persistedState = readPersistedState();
const initialHistory =
  persistedState?.segments.length && persistedState.speakers.length
    ? [
        {
          segments: persistedState.segments,
          speakers: persistedState.speakers,
          selectedSegmentId: persistedState.selectedSegmentId,
        },
      ]
    : [];
const initialHistoryIndex = initialHistory.length > 0 ? 0 : -1;

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
  segments: persistedState?.segments ?? [],
  speakers: persistedState?.speakers ?? [],
  selectedSegmentId: persistedState?.selectedSegmentId ?? null,
  currentTime: persistedState?.currentTime ?? 0,
  isPlaying: false,
  duration: 0,
  seekRequestTime: null,
  history: initialHistory,
  historyIndex: initialHistoryIndex,
  isWhisperXFormat: persistedState?.isWhisperXFormat ?? false,
  lexiconEntries: persistedState?.lexiconEntries ?? [],
  lexiconThreshold: persistedState?.lexiconThreshold ?? 0.82,
  lexiconHighlightUnderline: persistedState?.lexiconHighlightUnderline ?? false,
  lexiconHighlightBackground: persistedState?.lexiconHighlightBackground ?? false,

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
    const normalizedText = text.trim();
    const nextWordTexts = normalizedText.split(/\s+/).filter((word) => word.length > 0);
    const prevWords = segment.words;

    const buildDefaultWords = () => {
      const segDuration = segment.end - segment.start;
      const wordDuration = nextWordTexts.length > 0 ? segDuration / nextWordTexts.length : 0;
      return nextWordTexts.map((word, index) => ({
        word,
        start: segment.start + index * wordDuration,
        end: segment.start + (index + 1) * wordDuration,
        speaker: segment.speaker,
        score: 1,
      }));
    };

    const findMatches = (prevText: string[], nextText: string[]) => {
      const rows = prevText.length + 1;
      const cols = nextText.length + 1;
      const table = Array.from({ length: rows }, () => Array(cols).fill(0));
      for (let i = prevText.length - 1; i >= 0; i -= 1) {
        for (let j = nextText.length - 1; j >= 0; j -= 1) {
          if (prevText[i] === nextText[j]) {
            table[i][j] = table[i + 1][j + 1] + 1;
          } else {
            table[i][j] = Math.max(table[i + 1][j], table[i][j + 1]);
          }
        }
      }

      const matches: Array<{ oldIndex: number; newIndex: number }> = [];
      let i = 0;
      let j = 0;
      while (i < prevText.length && j < nextText.length) {
        if (prevText[i] === nextText[j]) {
          matches.push({ oldIndex: i, newIndex: j });
          i += 1;
          j += 1;
        } else if (table[i + 1][j] >= table[i][j + 1]) {
          i += 1;
        } else {
          j += 1;
        }
      }
      return matches;
    };

    const buildWordsWithPreservedTiming = () => {
      if (prevWords.length === 0 || nextWordTexts.length === 0) {
        return buildDefaultWords();
      }

      const prevText = prevWords.map((word) => word.word);
      const matches = findMatches(prevText, nextWordTexts);
      const updated: typeof prevWords = [];

      const addRegion = (oldStart: number, oldEnd: number, newStart: number, newEnd: number) => {
        const regionWords = nextWordTexts.slice(newStart, newEnd);
        if (regionWords.length === 0) return;

        let regionStart = segment.start;
        let regionEnd = segment.end;

        if (oldEnd > oldStart) {
          regionStart = prevWords[oldStart].start;
          regionEnd = prevWords[oldEnd - 1].end;
        } else {
          const prevWord = oldStart > 0 ? prevWords[oldStart - 1] : null;
          const nextWord = oldEnd < prevWords.length ? prevWords[oldEnd] : null;
          if (prevWord && nextWord) {
            regionStart = prevWord.end;
            regionEnd = nextWord.start;
          } else if (prevWord) {
            regionStart = prevWord.end;
            regionEnd = segment.end;
          } else if (nextWord) {
            regionStart = segment.start;
            regionEnd = nextWord.start;
          }
        }

        if (regionEnd < regionStart) {
          regionEnd = regionStart;
        }

        const duration = regionEnd - regionStart;
        const step = regionWords.length > 0 ? duration / regionWords.length : 0;
        regionWords.forEach((word, index) => {
          const start = regionStart + index * step;
          const end = regionStart + (index + 1) * step;
          updated.push({
            word,
            start,
            end: end < start ? start : end,
            speaker: segment.speaker,
            score: 1,
          });
        });
      };

      let prevIndex = 0;
      let nextIndex = 0;
      matches.forEach((match) => {
        addRegion(prevIndex, match.oldIndex, nextIndex, match.newIndex);
        const matchedPrev = prevWords[match.oldIndex];
        updated.push({
          ...matchedPrev,
          word: nextWordTexts[match.newIndex],
        });
        prevIndex = match.oldIndex + 1;
        nextIndex = match.newIndex + 1;
      });
      addRegion(prevIndex, prevWords.length, nextIndex, nextWordTexts.length);

      return updated;
    };

    const words = buildWordsWithPreservedTiming();
    const newSegments = segments.map((s) =>
      s.id === id ? { ...s, text: normalizedText, words } : s,
    );
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

  confirmSegment: (id) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId } = get();
    const segment = segments.find((s) => s.id === id);
    if (!segment) return;
    const updatedWords = segment.words.map((word) => ({ ...word, score: 1 }));
    const newSegments = segments.map((s) =>
      s.id === id ? { ...s, words: updatedWords, confirmed: true } : s,
    );
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

  toggleSegmentBookmark: (id) => {
    const { segments, speakers, history, historyIndex, selectedSegmentId } = get();
    const segment = segments.find((s) => s.id === id);
    if (!segment) return;
    const newSegments = segments.map((s) =>
      s.id === id ? { ...s, bookmarked: !s.bookmarked } : s,
    );
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

  setLexiconEntries: (entries) => {
    set({ lexiconEntries: uniqueEntries(entries) });
  },

  addLexiconEntry: (term, variants = []) => {
    const cleaned = term.trim();
    if (!cleaned) return;
    const entry: LexiconEntry = { term: cleaned, variants };
    const { lexiconEntries } = get();
    const next = uniqueEntries([...lexiconEntries, entry]);
    set({ lexiconEntries: next });
  },

  removeLexiconEntry: (term) => {
    const normalized = normalizeLexiconTerm(term);
    const { lexiconEntries } = get();
    const next = lexiconEntries.filter(
      (item) => normalizeLexiconTerm(item.term) !== normalized,
    );
    set({ lexiconEntries: next });
  },

  updateLexiconEntry: (previousTerm, term, variants = []) => {
    const normalizedPrevious = normalizeLexiconTerm(previousTerm);
    const cleaned = term.trim();
    if (!cleaned) return;
    const { lexiconEntries } = get();
    const remaining = lexiconEntries.filter(
      (entry) => normalizeLexiconTerm(entry.term) !== normalizedPrevious,
    );
    const next = uniqueEntries([...remaining, { term: cleaned, variants }]);
    set({ lexiconEntries: next });
  },

  setLexiconThreshold: (value) => {
    const clamped = Math.max(0.5, Math.min(0.99, value));
    set({ lexiconThreshold: clamped });
  },

  setLexiconHighlightUnderline: (value) => set({ lexiconHighlightUnderline: value }),
  setLexiconHighlightBackground: (value) => set({ lexiconHighlightBackground: value }),

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
      s.speaker === oldName
        ? {
            ...s,
            speaker: newName,
            words: s.words.map((word) =>
              word.speaker === oldName ? { ...word, speaker: newName } : word,
            ),
          }
        : {
            ...s,
            words: s.words.map((word) =>
              word.speaker === oldName ? { ...word, speaker: newName } : word,
            ),
          },
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
      s.speaker === fromName
        ? {
            ...s,
            speaker: toName,
            words: s.words.map((word) =>
              word.speaker === fromName ? { ...word, speaker: toName } : word,
            ),
          }
        : {
            ...s,
            words: s.words.map((word) =>
              word.speaker === fromName ? { ...word, speaker: toName } : word,
            ),
          },
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

if (canUseLocalStorage()) {
  let pendingPersist: PersistedTranscriptState | null = null;
  let persistTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastSerialized = persistedState ? JSON.stringify(persistedState) : "";

  const schedulePersist = (state: PersistedTranscriptState) => {
    pendingPersist = state;
    if (persistTimeout) return;
    persistTimeout = setTimeout(() => {
      if (!pendingPersist) return;
      try {
        const serialized = JSON.stringify(pendingPersist);
        if (serialized !== lastSerialized) {
          window.localStorage.setItem(STORAGE_KEY, serialized);
          lastSerialized = serialized;
        }
      } catch {
        // Ignore persistence failures (quota, serialization).
      } finally {
        pendingPersist = null;
        persistTimeout = null;
      }
    }, PERSIST_THROTTLE_MS);
  };

  useTranscriptStore.subscribe((state) => {
    schedulePersist({
      segments: state.segments,
      speakers: state.speakers,
      selectedSegmentId: state.selectedSegmentId,
      currentTime: state.currentTime,
      isWhisperXFormat: state.isWhisperXFormat,
      lexiconEntries: state.lexiconEntries,
      lexiconThreshold: state.lexiconThreshold,
      lexiconHighlightUnderline: state.lexiconHighlightUnderline,
      lexiconHighlightBackground: state.lexiconHighlightBackground,
    });
  });
}
