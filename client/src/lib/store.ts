import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { buildSessionKey, type FileReference, isSameFileReference } from "@/lib/fileReference";
import {
  buildRecentSessions,
  canUseLocalStorage,
  createStorageScheduler,
  readGlobalState,
  readSessionsState,
} from "@/lib/storage";
import {
  PAUSED_TIME_PERSIST_STEP,
  PERSIST_THROTTLE_MS,
  PLAYING_TIME_PERSIST_STEP,
} from "./store/constants";
import { createStoreContext, type StoreContext } from "./store/context";
import { createHistorySlice } from "./store/slices/historySlice";
import { createLexiconSlice } from "./store/slices/lexiconSlice";
import { createPlaybackSlice } from "./store/slices/playbackSlice";
import { createSegmentsSlice } from "./store/slices/segmentsSlice";
import { buildInitialHistory, createSessionSlice } from "./store/slices/sessionSlice";
import { createSpeakersSlice } from "./store/slices/speakersSlice";
import { createSpellcheckSlice } from "./store/slices/spellcheckSlice";
import type {
  InitialStoreState,
  LexiconEntry,
  Segment,
  Speaker,
  SpellcheckCustomDictionary,
  SpellcheckLanguage,
  TranscriptStore,
  Word,
} from "./store/types";
import { normalizeLexiconEntriesFromGlobal } from "./store/utils/lexicon";
import {
  normalizeSpellcheckIgnoreWords,
  normalizeSpellcheckLanguages,
  resolveSpellcheckSelection,
} from "./store/utils/spellcheck";

const sessionsState = readSessionsState();
const globalState = readGlobalState();
const resolvedSpellcheckSelection = resolveSpellcheckSelection(
  normalizeSpellcheckLanguages(globalState?.spellcheckLanguages),
  Boolean(globalState?.spellcheckCustomEnabled),
);

const activeSession =
  sessionsState.activeSessionKey && sessionsState.sessions[sessionsState.activeSessionKey]
    ? sessionsState.sessions[sessionsState.activeSessionKey]
    : null;
const activeSessionKey =
  sessionsState.activeSessionKey ??
  (activeSession ? buildSessionKey(activeSession.audioRef, activeSession.transcriptRef) : null);

const initialHistoryState = buildInitialHistory(
  activeSession?.segments.length && activeSession.speakers.length
    ? {
        segments: activeSession.segments,
        speakers: activeSession.speakers,
        selectedSegmentId: activeSession.selectedSegmentId,
      }
    : null,
);

const initialState: InitialStoreState = {
  audioFile: null,
  audioUrl: null,
  audioRef: activeSession?.audioRef ?? null,
  transcriptRef: activeSession?.transcriptRef ?? null,
  sessionKey: activeSessionKey ?? buildSessionKey(null, null),
  recentSessions: buildRecentSessions(sessionsState.sessions),
  segments: activeSession?.segments ?? [],
  speakers: activeSession?.speakers ?? [],
  selectedSegmentId: activeSession?.selectedSegmentId ?? null,
  currentTime: activeSession?.currentTime ?? 0,
  isPlaying: false,
  duration: 0,
  seekRequestTime: null,
  history: initialHistoryState.history,
  historyIndex: initialHistoryState.historyIndex,
  isWhisperXFormat: activeSession?.isWhisperXFormat ?? false,
  lexiconEntries: normalizeLexiconEntriesFromGlobal(globalState),
  lexiconThreshold: globalState?.lexiconThreshold ?? 0.82,
  lexiconHighlightUnderline: Boolean(globalState?.lexiconHighlightUnderline),
  lexiconHighlightBackground: Boolean(globalState?.lexiconHighlightBackground),
  spellcheckEnabled: Boolean(globalState?.spellcheckEnabled),
  spellcheckLanguages: resolvedSpellcheckSelection.languages,
  spellcheckIgnoreWords: normalizeSpellcheckIgnoreWords(globalState?.spellcheckIgnoreWords ?? []),
  spellcheckCustomDictionaries: [],
  spellcheckCustomDictionariesLoaded: false,
  spellcheckCustomEnabled: resolvedSpellcheckSelection.customEnabled,
};

const schedulePersist = canUseLocalStorage() ? createStorageScheduler(PERSIST_THROTTLE_MS) : null;
let storeContext: StoreContext | null = null;
let lastGlobalSnapshot: {
  lexiconEntries: LexiconEntry[];
  lexiconThreshold: number;
  lexiconHighlightUnderline: boolean;
  lexiconHighlightBackground: boolean;
  spellcheckEnabled: boolean;
  spellcheckLanguages: SpellcheckLanguage[];
  spellcheckIgnoreWords: string[];
  spellcheckCustomEnabled: boolean;
} | null = null;

export const useTranscriptStore = create<TranscriptStore>()(
  subscribeWithSelector((set, get) => {
    storeContext = createStoreContext(
      sessionsState.sessions,
      sessionsState.activeSessionKey ?? null,
      (sessionState, globalStateToPersist) => {
        if (schedulePersist) {
          schedulePersist(sessionState, globalStateToPersist);
        }
      },
      (recentSessions) => set({ recentSessions }),
    );

    return {
      ...initialState,
      ...createSessionSlice(set, get, storeContext),
      ...createPlaybackSlice(set),
      ...createSegmentsSlice(set, get, storeContext),
      ...createSpeakersSlice(set, get),
      ...createLexiconSlice(set, get),
      ...createSpellcheckSlice(set, get),
      ...createHistorySlice(set, get),
    };
  }),
);

if (canUseLocalStorage()) {
  useTranscriptStore.subscribe(
    (state) => state,
    (state) => {
      if (!storeContext) return;
      const sessionKey = state.sessionKey;
      const sessionsCache = storeContext.getSessionsCache();
      const previous = sessionsCache[sessionKey];
      const sessionActivated = sessionKey !== storeContext.getActiveSessionKey();
      const baseChanged =
        !previous ||
        previous.segments !== state.segments ||
        previous.speakers !== state.speakers ||
        !isSameFileReference(previous.audioRef, state.audioRef) ||
        !isSameFileReference(previous.transcriptRef, state.transcriptRef) ||
        previous.isWhisperXFormat !== state.isWhisperXFormat;
      const shouldUpdateSelected =
        !previous || previous.selectedSegmentId !== state.selectedSegmentId;
      const timeDelta = previous ? Math.abs(state.currentTime - previous.currentTime) : Infinity;
      const timeThreshold = state.isPlaying ? PLAYING_TIME_PERSIST_STEP : PAUSED_TIME_PERSIST_STEP;
      const shouldUpdateTime = !previous || timeDelta >= timeThreshold;
      const shouldTouchSession = baseChanged || sessionActivated || !previous;
      const shouldUpdateEntry = shouldTouchSession || shouldUpdateSelected || shouldUpdateTime;

      if (shouldUpdateEntry) {
        const nextEntry = previous ?? {
          audioRef: state.audioRef,
          transcriptRef: state.transcriptRef,
          segments: state.segments,
          speakers: state.speakers,
          selectedSegmentId: state.selectedSegmentId,
          currentTime: state.currentTime,
          isWhisperXFormat: state.isWhisperXFormat,
          updatedAt: Date.now(),
        };
        if (shouldTouchSession || !previous) {
          nextEntry.audioRef = state.audioRef;
          nextEntry.transcriptRef = state.transcriptRef;
          nextEntry.segments = state.segments;
          nextEntry.speakers = state.speakers;
          nextEntry.isWhisperXFormat = state.isWhisperXFormat;
          nextEntry.updatedAt = Date.now();
        }
        if (shouldUpdateSelected || !previous) {
          nextEntry.selectedSegmentId = state.selectedSegmentId;
        }
        if (shouldUpdateTime || !previous) {
          nextEntry.currentTime = state.currentTime;
        }
        storeContext.setSessionsCache({
          ...storeContext.getSessionsCache(),
          [sessionKey]: nextEntry,
        });
      }

      storeContext.setActiveSessionKey(sessionKey);

      if (shouldTouchSession) {
        storeContext.updateRecentSessions(storeContext.getSessionsCache());
      }

      const nextGlobalSnapshot = {
        lexiconEntries: state.lexiconEntries,
        lexiconThreshold: state.lexiconThreshold,
        lexiconHighlightUnderline: state.lexiconHighlightUnderline,
        lexiconHighlightBackground: state.lexiconHighlightBackground,
        spellcheckEnabled: state.spellcheckEnabled,
        spellcheckLanguages: state.spellcheckLanguages,
        spellcheckIgnoreWords: state.spellcheckIgnoreWords,
        spellcheckCustomEnabled: state.spellcheckCustomEnabled,
      };
      const globalChanged =
        !lastGlobalSnapshot ||
        lastGlobalSnapshot.lexiconEntries !== nextGlobalSnapshot.lexiconEntries ||
        lastGlobalSnapshot.lexiconThreshold !== nextGlobalSnapshot.lexiconThreshold ||
        lastGlobalSnapshot.lexiconHighlightUnderline !==
          nextGlobalSnapshot.lexiconHighlightUnderline ||
        lastGlobalSnapshot.lexiconHighlightBackground !==
          nextGlobalSnapshot.lexiconHighlightBackground ||
        lastGlobalSnapshot.spellcheckEnabled !== nextGlobalSnapshot.spellcheckEnabled ||
        lastGlobalSnapshot.spellcheckLanguages !== nextGlobalSnapshot.spellcheckLanguages ||
        lastGlobalSnapshot.spellcheckIgnoreWords !== nextGlobalSnapshot.spellcheckIgnoreWords ||
        lastGlobalSnapshot.spellcheckCustomEnabled !== nextGlobalSnapshot.spellcheckCustomEnabled;

      if (shouldUpdateEntry || globalChanged || sessionActivated) {
        storeContext.persist(
          {
            sessions: storeContext.getSessionsCache(),
            activeSessionKey: storeContext.getActiveSessionKey(),
          },
          nextGlobalSnapshot,
        );
      }

      if (globalChanged) {
        lastGlobalSnapshot = nextGlobalSnapshot;
      }
    },
  );
}

export const useSegments = () => useTranscriptStore((state) => state.segments);
export const usePlaybackState = () => {
  const currentTime = useTranscriptStore((state) => state.currentTime);
  const isPlaying = useTranscriptStore((state) => state.isPlaying);
  const duration = useTranscriptStore((state) => state.duration);
  const seekRequestTime = useTranscriptStore((state) => state.seekRequestTime);
  return { currentTime, isPlaying, duration, seekRequestTime };
};
export const useSpeakers = () => useTranscriptStore((state) => state.speakers);

export type {
  FileReference,
  LexiconEntry,
  Segment,
  Speaker,
  SpellcheckCustomDictionary,
  SpellcheckLanguage,
  Word,
};
