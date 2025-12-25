import { create } from "zustand";
import { buildSessionKey, type FileReference, isSameFileReference } from "@/lib/fileReference";
import {
  loadSpellcheckDictionaries,
  removeSpellcheckDictionary,
  saveSpellcheckDictionary,
} from "@/lib/spellcheckDictionaryStorage";

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
  falsePositives: string[];
}

export type SpellcheckLanguage = "de" | "en";

export interface SpellcheckCustomDictionary {
  id: string;
  name: string;
  language: SpellcheckLanguage;
  aff: string;
  dic: string;
}

interface HistoryState {
  segments: Segment[];
  speakers: Speaker[];
  selectedSegmentId: string | null;
}

interface TranscriptState {
  audioFile: File | null;
  audioUrl: string | null;
  audioRef: FileReference | null;
  transcriptRef: FileReference | null;
  sessionKey: string;
  recentSessions: Array<{
    key: string;
    audioName?: string;
    transcriptName?: string;
    updatedAt?: number;
  }>;
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
  spellcheckEnabled: boolean;
  spellcheckLanguages: SpellcheckLanguage[];
  spellcheckIgnoreWords: string[];
  spellcheckCustomDictionaries: SpellcheckCustomDictionary[];
  spellcheckCustomDictionariesLoaded: boolean;

  setAudioFile: (file: File | null) => void;
  setAudioUrl: (url: string | null) => void;
  setAudioReference: (reference: FileReference | null) => void;
  setTranscriptReference: (reference: FileReference | null) => void;
  activateSession: (key: string) => void;
  loadTranscript: (data: {
    segments: Segment[];
    speakers?: Speaker[];
    isWhisperXFormat?: boolean;
    reference?: FileReference | null;
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
  addLexiconEntry: (term: string, variants?: string[], falsePositives?: string[]) => void;
  removeLexiconEntry: (term: string) => void;
  updateLexiconEntry: (
    previousTerm: string,
    term: string,
    variants?: string[],
    falsePositives?: string[],
  ) => void;
  addLexiconFalsePositive: (term: string, value: string) => void;
  setLexiconThreshold: (value: number) => void;
  setLexiconHighlightUnderline: (value: boolean) => void;
  setLexiconHighlightBackground: (value: boolean) => void;
  setSpellcheckEnabled: (enabled: boolean) => void;
  setSpellcheckLanguages: (languages: SpellcheckLanguage[]) => void;
  setSpellcheckIgnoreWords: (words: string[]) => void;
  addSpellcheckIgnoreWord: (value: string) => void;
  removeSpellcheckIgnoreWord: (value: string) => void;
  clearSpellcheckIgnoreWords: () => void;
  loadSpellcheckCustomDictionaries: () => Promise<void>;
  addSpellcheckCustomDictionary: (dictionary: Omit<SpellcheckCustomDictionary, "id">) => Promise<void>;
  removeSpellcheckCustomDictionary: (id: string) => Promise<void>;
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
const LEGACY_STORAGE_KEY = "flowscribe:transcript-state";
const SESSIONS_STORAGE_KEY = "flowscribe:sessions";
const GLOBAL_STORAGE_KEY = "flowscribe:global";
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

type PersistedSession = {
  audioRef: FileReference | null;
  transcriptRef: FileReference | null;
  segments: Segment[];
  speakers: Speaker[];
  selectedSegmentId: string | null;
  currentTime: number;
  isWhisperXFormat: boolean;
  updatedAt?: number;
};

type PersistedSessionsState = {
  sessions: Record<string, PersistedSession>;
  activeSessionKey: string | null;
};

type PersistedGlobalState = {
  lexiconEntries?: LexiconEntry[];
  lexiconTerms?: string[];
  lexiconThreshold?: number;
  lexiconHighlightUnderline?: boolean;
  lexiconHighlightBackground?: boolean;
  spellcheckEnabled?: boolean;
  spellcheckLanguages?: SpellcheckLanguage[];
  spellcheckIgnoreWords?: string[];
};

const canUseLocalStorage = () => {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
};

const readLegacyState = (): PersistedTranscriptState | null => {
  if (!canUseLocalStorage()) return null;
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
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
            falsePositives: Array.isArray(entry.falsePositives)
              ? entry.falsePositives.map(String).filter(Boolean)
              : [],
          }))
      : Array.isArray(parsed.lexiconTerms)
        ? parsed.lexiconTerms
            .map((term) => (typeof term === "string" ? term : String(term ?? "")))
            .filter(Boolean)
            .map((term) => ({ term, variants: [], falsePositives: [] }))
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

const readSessionsState = (
  legacyState: PersistedTranscriptState | null,
): PersistedSessionsState => {
  if (!canUseLocalStorage()) {
    return { sessions: {}, activeSessionKey: null };
  }
  const raw = window.localStorage.getItem(SESSIONS_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PersistedSessionsState;
      if (parsed && typeof parsed === "object" && parsed.sessions) {
        const sessions = parsed.sessions ?? {};
        let activeSessionKey = parsed.activeSessionKey ?? null;
        if (!activeSessionKey) {
          const keys = Object.keys(sessions);
          if (keys.length > 0) {
            activeSessionKey = keys.reduce((bestKey, key) => {
              const bestTime = sessions[bestKey]?.updatedAt ?? 0;
              const nextTime = sessions[key]?.updatedAt ?? 0;
              return nextTime > bestTime ? key : bestKey;
            }, keys[0]);
          }
        }
        return {
          sessions,
          activeSessionKey,
        };
      }
    } catch {
      // ignore malformed storage
    }
  }
  if (!legacyState) {
    return { sessions: {}, activeSessionKey: null };
  }
  const legacyKey = buildSessionKey(null, null);
  return {
    sessions: {
      [legacyKey]: {
        audioRef: null,
        transcriptRef: null,
        segments: legacyState.segments,
        speakers: legacyState.speakers,
        selectedSegmentId: legacyState.selectedSegmentId,
        currentTime: legacyState.currentTime,
        isWhisperXFormat: legacyState.isWhisperXFormat,
      },
    },
    activeSessionKey: legacyKey,
  };
};

const readGlobalState = (
  legacyState: PersistedTranscriptState | null,
): PersistedGlobalState | null => {
  if (!canUseLocalStorage()) return null;
  const raw = window.localStorage.getItem(GLOBAL_STORAGE_KEY);
  if (!raw) return legacyState;
  try {
    return JSON.parse(raw) as PersistedGlobalState;
  } catch {
    return legacyState;
  }
};

const buildRecentSessions = (sessions: Record<string, PersistedSession>) => {
  return Object.entries(sessions)
    .filter(([, session]) => session.segments.length > 0)
    .map(([key, session]) => ({
      key,
      audioName: session.audioRef?.name,
      transcriptName: session.transcriptRef?.name,
      updatedAt: session.updatedAt ?? 0,
    }))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
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
    falsePositives: normalizeLexiconVariants(entry.falsePositives ?? []),
  };
};
const normalizeLexiconEntriesFromGlobal = (state: PersistedGlobalState | null) => {
  if (!state) return [];
  if (Array.isArray(state.lexiconEntries)) {
    return state.lexiconEntries
      .filter((entry) => entry && typeof entry.term === "string")
      .map((entry) => ({
        term: String(entry.term),
        variants: Array.isArray(entry.variants) ? entry.variants.map(String).filter(Boolean) : [],
        falsePositives: Array.isArray(entry.falsePositives)
          ? entry.falsePositives.map(String).filter(Boolean)
          : [],
      }));
  }
  if (Array.isArray(state.lexiconTerms)) {
    return state.lexiconTerms
      .map((term) => (typeof term === "string" ? term : String(term ?? "")))
      .filter(Boolean)
      .map((term) => ({ term, variants: [], falsePositives: [] }));
  }
  return [];
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
    const mergedVariants = normalizeLexiconVariants([...existing.variants, ...normalized.variants]);
    const mergedFalsePositives = normalizeLexiconVariants([
      ...existing.falsePositives,
      ...normalized.falsePositives,
    ]);
    seen.set(key, {
      term: existing.term,
      variants: mergedVariants,
      falsePositives: mergedFalsePositives,
    });
  });
  return Array.from(seen.values());
};

const normalizeSpellcheckIgnoreWord = (value: string) =>
  value
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .trim()
    .toLowerCase();

const normalizeSpellcheckIgnoreWords = (values: string[]) => {
  const seen = new Set<string>();
  return values
    .map((value) => normalizeSpellcheckIgnoreWord(value))
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
};

const normalizeSpellcheckLanguages = (value: unknown): SpellcheckLanguage[] => {
  const raw = typeof value === "string" ? value.split(",") : Array.isArray(value) ? value : [];
  const next = raw
    .map((lang) => String(lang).trim())
    .filter((lang): lang is SpellcheckLanguage => lang === "de" || lang === "en");
  const unique = Array.from(new Set(next));
  return unique.length > 0 ? unique : ["de", "en"];
};

const sessionsState = readSessionsState(null);
const globalState = readGlobalState(null);
let sessionsCache = sessionsState.sessions;
let activeSessionKeyCache = sessionsState.activeSessionKey;
let lastRecentSerialized = JSON.stringify(buildRecentSessions(sessionsCache));

const activeSession =
  sessionsState.activeSessionKey && sessionsState.sessions[sessionsState.activeSessionKey]
    ? sessionsState.sessions[sessionsState.activeSessionKey]
    : null;
const activeSessionKey =
  sessionsState.activeSessionKey ??
  (activeSession ? buildSessionKey(activeSession.audioRef, activeSession.transcriptRef) : null);

const initialHistory =
  activeSession?.segments.length && activeSession.speakers.length
    ? [
        {
          segments: activeSession.segments,
          speakers: activeSession.speakers,
          selectedSegmentId: activeSession.selectedSegmentId,
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
  audioRef: activeSession?.audioRef ?? null,
  transcriptRef: activeSession?.transcriptRef ?? null,
  sessionKey: activeSessionKey ?? buildSessionKey(null, null),
  recentSessions: buildRecentSessions(sessionsCache),
  segments: activeSession?.segments ?? [],
  speakers: activeSession?.speakers ?? [],
  selectedSegmentId: activeSession?.selectedSegmentId ?? null,
  currentTime: activeSession?.currentTime ?? 0,
  isPlaying: false,
  duration: 0,
  seekRequestTime: null,
  history: initialHistory,
  historyIndex: initialHistoryIndex,
  isWhisperXFormat: activeSession?.isWhisperXFormat ?? false,
  lexiconEntries: normalizeLexiconEntriesFromGlobal(globalState),
  lexiconThreshold: globalState?.lexiconThreshold ?? 0.82,
  lexiconHighlightUnderline: Boolean(globalState?.lexiconHighlightUnderline),
  lexiconHighlightBackground: Boolean(globalState?.lexiconHighlightBackground),
  spellcheckEnabled: Boolean(globalState?.spellcheckEnabled),
  spellcheckLanguages: normalizeSpellcheckLanguages(globalState?.spellcheckLanguages),
  spellcheckIgnoreWords: normalizeSpellcheckIgnoreWords(globalState?.spellcheckIgnoreWords ?? []),
  spellcheckCustomDictionaries: [],
  spellcheckCustomDictionariesLoaded: false,

  setAudioFile: (file) => set({ audioFile: file }),
  setAudioUrl: (url) => set({ audioUrl: url }),
  setAudioReference: (reference) => {
    const state = get();
    const sessionKey =
      state.transcriptRef === null
        ? state.sessionKey
        : buildSessionKey(reference, state.transcriptRef);
    const session = sessionsCache[sessionKey];
    const shouldPromoteCurrent = !session && state.segments.length > 0;
    if (shouldPromoteCurrent) {
      sessionsCache = {
        ...sessionsCache,
        [sessionKey]: {
          audioRef: reference,
          transcriptRef: state.transcriptRef,
          segments: state.segments,
          speakers: state.speakers,
          selectedSegmentId: state.selectedSegmentId,
          currentTime: state.currentTime,
          isWhisperXFormat: state.isWhisperXFormat,
          updatedAt: Date.now(),
        },
      };
    }
    const selectedSegmentId =
      session?.selectedSegmentId &&
      session.segments.some((segment) => segment.id === session.selectedSegmentId)
        ? session.selectedSegmentId
        : shouldPromoteCurrent
          ? state.selectedSegmentId
          : (session?.segments[0]?.id ?? null);
    set({
      audioRef: reference,
      transcriptRef: state.transcriptRef,
      sessionKey,
      segments: session?.segments ?? (shouldPromoteCurrent ? state.segments : []),
      speakers: session?.speakers ?? (shouldPromoteCurrent ? state.speakers : []),
      selectedSegmentId,
      currentTime: session?.currentTime ?? (shouldPromoteCurrent ? state.currentTime : 0),
      isWhisperXFormat:
        session?.isWhisperXFormat ?? (shouldPromoteCurrent ? state.isWhisperXFormat : false),
      history:
        session?.segments.length || shouldPromoteCurrent
          ? [
              {
                segments: session?.segments ?? state.segments,
                speakers: session?.speakers ?? state.speakers,
                selectedSegmentId,
              },
            ]
          : [],
      historyIndex: session?.segments.length || shouldPromoteCurrent ? 0 : -1,
    });
  },
  setTranscriptReference: (reference) => {
    const state = get();
    const sessionKey =
      state.audioRef === null ? state.sessionKey : buildSessionKey(state.audioRef, reference);
    const session = sessionsCache[sessionKey];
    const shouldPromoteCurrent = !session && state.segments.length > 0;
    if (shouldPromoteCurrent) {
      sessionsCache = {
        ...sessionsCache,
        [sessionKey]: {
          audioRef: state.audioRef,
          transcriptRef: reference,
          segments: state.segments,
          speakers: state.speakers,
          selectedSegmentId: state.selectedSegmentId,
          currentTime: state.currentTime,
          isWhisperXFormat: state.isWhisperXFormat,
          updatedAt: Date.now(),
        },
      };
    }
    const selectedSegmentId =
      session?.selectedSegmentId &&
      session.segments.some((segment) => segment.id === session.selectedSegmentId)
        ? session.selectedSegmentId
        : shouldPromoteCurrent
          ? state.selectedSegmentId
          : (session?.segments[0]?.id ?? null);
    set({
      audioRef: state.audioRef,
      transcriptRef: reference,
      sessionKey,
      segments: session?.segments ?? (shouldPromoteCurrent ? state.segments : []),
      speakers: session?.speakers ?? (shouldPromoteCurrent ? state.speakers : []),
      selectedSegmentId,
      currentTime: session?.currentTime ?? (shouldPromoteCurrent ? state.currentTime : 0),
      isWhisperXFormat:
        session?.isWhisperXFormat ?? (shouldPromoteCurrent ? state.isWhisperXFormat : false),
      history:
        session?.segments.length || shouldPromoteCurrent
          ? [
              {
                segments: session?.segments ?? state.segments,
                speakers: session?.speakers ?? state.speakers,
                selectedSegmentId,
              },
            ]
          : [],
      historyIndex: session?.segments.length || shouldPromoteCurrent ? 0 : -1,
    });
  },
  activateSession: (key) => {
    const session = sessionsCache[key];
    if (!session) return;
    const selectedSegmentId =
      session.selectedSegmentId &&
      session.segments.some((segment) => segment.id === session.selectedSegmentId)
        ? session.selectedSegmentId
        : (session.segments[0]?.id ?? null);
    const state = get();
    const shouldClearAudio = !isSameFileReference(state.audioRef, session.audioRef);
    set({
      audioRef: session.audioRef,
      transcriptRef: session.transcriptRef,
      sessionKey: key,
      segments: session.segments,
      speakers: session.speakers,
      selectedSegmentId,
      currentTime: session.currentTime ?? 0,
      isWhisperXFormat: session.isWhisperXFormat ?? false,
      history: [
        {
          segments: session.segments,
          speakers: session.speakers,
          selectedSegmentId,
        },
      ],
      historyIndex: 0,
      audioFile: shouldClearAudio ? null : state.audioFile,
      audioUrl: shouldClearAudio ? null : state.audioUrl,
      seekRequestTime: null,
    });
  },

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

    const sessionKey = buildSessionKey(get().audioRef, data.reference ?? get().transcriptRef);
    const session = sessionsCache[sessionKey];
    const selectedFromSession =
      session?.selectedSegmentId &&
      session.segments.some((segment) => segment.id === session.selectedSegmentId)
        ? session.selectedSegmentId
        : (session?.segments[0]?.id ?? null);
    if (session && session.segments.length > 0) {
      set({
        segments: session.segments,
        speakers: session.speakers,
        selectedSegmentId: selectedFromSession,
        currentTime: session.currentTime ?? 0,
        isWhisperXFormat: session.isWhisperXFormat ?? false,
        history: [
          {
            segments: session.segments,
            speakers: session.speakers,
            selectedSegmentId: selectedFromSession,
          },
        ],
        historyIndex: 0,
        transcriptRef: data.reference ?? get().transcriptRef,
        sessionKey,
      });
      return;
    }
    set({
      segments,
      speakers,
      selectedSegmentId,
      isWhisperXFormat: data.isWhisperXFormat || false,
      history: [{ segments, speakers, selectedSegmentId }],
      historyIndex: 0,
      transcriptRef: data.reference ?? get().transcriptRef,
      sessionKey,
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

  addLexiconEntry: (term, variants = [], falsePositives = []) => {
    const cleaned = term.trim();
    if (!cleaned) return;
    const entry: LexiconEntry = { term: cleaned, variants, falsePositives };
    const { lexiconEntries } = get();
    const next = uniqueEntries([...lexiconEntries, entry]);
    set({ lexiconEntries: next });
  },

  removeLexiconEntry: (term) => {
    const normalized = normalizeLexiconTerm(term);
    const { lexiconEntries } = get();
    const next = lexiconEntries.filter((item) => normalizeLexiconTerm(item.term) !== normalized);
    set({ lexiconEntries: next });
  },

  updateLexiconEntry: (previousTerm, term, variants = [], falsePositives = []) => {
    const normalizedPrevious = normalizeLexiconTerm(previousTerm);
    const cleaned = term.trim();
    if (!cleaned) return;
    const { lexiconEntries } = get();
    const remaining = lexiconEntries.filter(
      (entry) => normalizeLexiconTerm(entry.term) !== normalizedPrevious,
    );
    const next = uniqueEntries([...remaining, { term: cleaned, variants, falsePositives }]);
    set({ lexiconEntries: next });
  },
  addLexiconFalsePositive: (term, value) => {
    const cleaned = value.trim();
    if (!cleaned) return;
    const normalizedTerm = normalizeLexiconTerm(term);
    const { lexiconEntries } = get();
    const next = lexiconEntries.map((entry) => {
      if (normalizeLexiconTerm(entry.term) !== normalizedTerm) return entry;
      const falsePositives = normalizeLexiconVariants([...(entry.falsePositives ?? []), cleaned]);
      return { ...entry, falsePositives };
    });
    set({ lexiconEntries: next });
  },

  setLexiconThreshold: (value) => {
    const clamped = Math.max(0.5, Math.min(0.99, value));
    set({ lexiconThreshold: clamped });
  },

  setLexiconHighlightUnderline: (value) => set({ lexiconHighlightUnderline: value }),
  setLexiconHighlightBackground: (value) => set({ lexiconHighlightBackground: value }),
  setSpellcheckEnabled: (enabled) => set({ spellcheckEnabled: enabled }),
  setSpellcheckLanguages: (languages) =>
    set({ spellcheckLanguages: normalizeSpellcheckLanguages(languages) }),
  setSpellcheckIgnoreWords: (words) =>
    set({ spellcheckIgnoreWords: normalizeSpellcheckIgnoreWords(words) }),
  addSpellcheckIgnoreWord: (value) => {
    const cleaned = normalizeSpellcheckIgnoreWord(value);
    if (!cleaned) return;
    const { spellcheckIgnoreWords } = get();
    if (spellcheckIgnoreWords.includes(cleaned)) return;
    set({ spellcheckIgnoreWords: [...spellcheckIgnoreWords, cleaned] });
  },
  removeSpellcheckIgnoreWord: (value) => {
    const cleaned = normalizeSpellcheckIgnoreWord(value);
    if (!cleaned) return;
    const { spellcheckIgnoreWords } = get();
    set({
      spellcheckIgnoreWords: spellcheckIgnoreWords.filter((word) => word !== cleaned),
    });
  },
  clearSpellcheckIgnoreWords: () => set({ spellcheckIgnoreWords: [] }),
  loadSpellcheckCustomDictionaries: async () => {
    const { spellcheckCustomDictionariesLoaded } = get();
    if (spellcheckCustomDictionariesLoaded) return;
    try {
      const dictionaries = await loadSpellcheckDictionaries();
      set({
        spellcheckCustomDictionaries: dictionaries,
        spellcheckCustomDictionariesLoaded: true,
      });
    } catch (err) {
      console.error("Failed to load spellcheck dictionaries:", err);
      set({ spellcheckCustomDictionariesLoaded: true });
    }
  },
  addSpellcheckCustomDictionary: async (dictionary) => {
    const entry: SpellcheckCustomDictionary = { ...dictionary, id: generateId() };
    try {
      await saveSpellcheckDictionary(entry);
    } catch (err) {
      console.error("Failed to save spellcheck dictionary:", err);
    }
    const { spellcheckCustomDictionaries } = get();
    set({
      spellcheckCustomDictionaries: [...spellcheckCustomDictionaries, entry],
    });
  },
  removeSpellcheckCustomDictionary: async (id) => {
    try {
      await removeSpellcheckDictionary(id);
    } catch (err) {
      console.error("Failed to remove spellcheck dictionary:", err);
    }
    const { spellcheckCustomDictionaries } = get();
    set({
      spellcheckCustomDictionaries: spellcheckCustomDictionaries.filter(
        (dictionary) => dictionary.id !== id,
      ),
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
  let persistTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingSessions: PersistedSessionsState | null = null;
  let pendingGlobal: PersistedGlobalState | null = null;

  const schedulePersist = (
    sessionsState: PersistedSessionsState,
    globalState: PersistedGlobalState,
  ) => {
    pendingSessions = sessionsState;
    pendingGlobal = globalState;
    if (persistTimeout) return;
    persistTimeout = setTimeout(() => {
      try {
        if (pendingSessions) {
          window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(pendingSessions));
        }
        if (pendingGlobal) {
          window.localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(pendingGlobal));
        }
      } catch {
        // Ignore persistence failures (quota, serialization).
      } finally {
        pendingSessions = null;
        pendingGlobal = null;
        persistTimeout = null;
      }
    }, PERSIST_THROTTLE_MS);
  };

  useTranscriptStore.subscribe((state) => {
    const sessionKey = state.sessionKey;
    sessionsCache = {
      ...sessionsCache,
      [sessionKey]: {
        audioRef: state.audioRef,
        transcriptRef: state.transcriptRef,
        segments: state.segments,
        speakers: state.speakers,
        selectedSegmentId: state.selectedSegmentId,
        currentTime: state.currentTime,
        isWhisperXFormat: state.isWhisperXFormat,
        updatedAt: Date.now(),
      },
    };
    activeSessionKeyCache = sessionKey;

    const recentSessions = buildRecentSessions(sessionsCache);
    const recentSerialized = JSON.stringify(recentSessions);
    if (recentSerialized !== lastRecentSerialized) {
      lastRecentSerialized = recentSerialized;
      useTranscriptStore.setState({ recentSessions });
    }

    schedulePersist(
      {
        sessions: sessionsCache,
        activeSessionKey: activeSessionKeyCache,
      },
      {
        lexiconEntries: state.lexiconEntries,
        lexiconThreshold: state.lexiconThreshold,
        lexiconHighlightUnderline: state.lexiconHighlightUnderline,
        lexiconHighlightBackground: state.lexiconHighlightBackground,
        spellcheckEnabled: state.spellcheckEnabled,
        spellcheckLanguages: state.spellcheckLanguages,
        spellcheckIgnoreWords: state.spellcheckIgnoreWords,
      },
    );
  });
}
