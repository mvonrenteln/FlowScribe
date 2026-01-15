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
import { createAiRevisionSelectionSlice } from "./store/slices/aiRevisionSelectionSlice";
import {
  createAIRevisionSlice,
  initialAIRevisionState,
  normalizeAIRevisionConfig,
} from "./store/slices/aiRevisionSlice";
import {
  createAISegmentMergeSlice,
  initialAISegmentMergeState,
} from "./store/slices/aiSegmentMergeSlice";
import { createAISpeakerSlice, initialAISpeakerState } from "./store/slices/aiSpeakerSlice";
import { createConfidenceSlice } from "./store/slices/confidenceSlice";
import { createHistorySlice } from "./store/slices/historySlice";
import { createLexiconSlice } from "./store/slices/lexiconSlice";
import { createPlaybackSlice } from "./store/slices/playbackSlice";
import { createSegmentsSlice } from "./store/slices/segmentsSlice";
import { buildInitialHistory, createSessionSlice } from "./store/slices/sessionSlice";
import { createSpeakersSlice } from "./store/slices/speakersSlice";
import { createSpellcheckSlice } from "./store/slices/spellcheckSlice";
import { createTagsSlice } from "./store/slices/tagsSlice";
import type {
  AIPrompt,
  AISpeakerConfig,
  AISpeakerSuggestion,
  InitialStoreState,
  LexiconEntry,
  SearchMatch,
  Segment,
  SessionKind,
  Speaker,
  SpellcheckCustomDictionary,
  SpellcheckLanguage,
  Tag,
  TranscriptStore,
  Word,
} from "./store/types";
import { normalizeAISegmentMergeConfig } from "./store/utils/aiSegmentMergeConfig";
import { normalizeAISpeakerConfig } from "./store/utils/aiSpeakerConfig";
import { buildGlobalStatePayload } from "./store/utils/globalState";
import { normalizeLexiconEntriesFromGlobal } from "./store/utils/lexicon";
import {
  normalizeSpellcheckIgnoreWords,
  normalizeSpellcheckLanguages,
  resolveSpellcheckSelection,
} from "./store/utils/spellcheck";
import { normalizeSegments } from "./transcript/normalizeTranscript";

const sessionsState = readSessionsState();
const globalState = readGlobalState();
const resolvedSpellcheckSelection = resolveSpellcheckSelection(
  normalizeSpellcheckLanguages(globalState?.spellcheckLanguages),
  Boolean(globalState?.spellcheckCustomEnabled),
);

const rawActiveSession =
  sessionsState.activeSessionKey && sessionsState.sessions[sessionsState.activeSessionKey]
    ? sessionsState.sessions[sessionsState.activeSessionKey]
    : null;
const activeSession = rawActiveSession
  ? {
      ...rawActiveSession,
      segments: normalizeSegments(rawActiveSession.segments),
      tags: rawActiveSession.tags ?? [],
    }
  : null;
const activeSessionKey =
  sessionsState.activeSessionKey ??
  (activeSession ? buildSessionKey(activeSession.audioRef, activeSession.transcriptRef) : null);

const initialHistoryState = buildInitialHistory(
  activeSession?.segments.length && activeSession.speakers.length
    ? {
        segments: activeSession.segments,
        speakers: activeSession.speakers,
        tags: activeSession.tags ?? [],
        selectedSegmentId: activeSession.selectedSegmentId,
        currentTime: activeSession.currentTime ?? 0,
      }
    : null,
);

const initialState: InitialStoreState = {
  audioFile: null,
  audioUrl: null,
  audioRef: activeSession?.audioRef ?? null,
  transcriptRef: activeSession?.transcriptRef ?? null,
  sessionKey: activeSessionKey ?? buildSessionKey(null, null),
  sessionKind: activeSession?.kind ?? "current",
  sessionLabel: activeSession?.label ?? null,
  baseSessionKey: activeSession?.baseSessionKey ?? null,
  recentSessions: buildRecentSessions(sessionsState.sessions),
  segments: activeSession?.segments ?? [],
  speakers: activeSession?.speakers ?? [],
  tags: activeSession?.tags ?? [],
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
  ...initialAISpeakerState,
  aiSpeakerConfig: normalizeAISpeakerConfig(globalState?.aiSpeakerConfig),
  // Confidence highlighting
  highlightLowConfidence: globalState?.highlightLowConfidence ?? true,
  manualConfidenceThreshold: globalState?.manualConfidenceThreshold ?? null,
  // AI Revision state
  ...initialAIRevisionState,
  aiRevisionConfig: normalizeAIRevisionConfig(globalState?.aiRevisionConfig),
  // AI Segment Merge state
  ...initialAISegmentMergeState,
  aiSegmentMergeConfig: normalizeAISegmentMergeConfig(globalState?.aiSegmentMergeConfig),
};

const schedulePersist = canUseLocalStorage() ? createStorageScheduler(PERSIST_THROTTLE_MS) : null;
let storeContext: StoreContext | null = null;
let lastGlobalPayload: ReturnType<typeof buildGlobalStatePayload> | null = null;

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
      ...createTagsSlice(set, get),
      ...createLexiconSlice(set, get),
      ...createSpellcheckSlice(set, get),
      ...createHistorySlice(set, get),
      ...createAISpeakerSlice(set, get),
      ...createConfidenceSlice(set, get),
      ...createAIRevisionSlice(set, get),
      ...createAiRevisionSelectionSlice(set, get),
      ...createAISegmentMergeSlice(set, get),
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
        previous.tags !== state.tags ||
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
          tags: state.tags,
          selectedSegmentId: state.selectedSegmentId,
          currentTime: state.currentTime,
          isWhisperXFormat: state.isWhisperXFormat,
          updatedAt: Date.now(),
          kind: state.sessionKind,
          label: state.sessionLabel,
          baseSessionKey: state.baseSessionKey,
        };
        if (shouldTouchSession || !previous) {
          nextEntry.audioRef = state.audioRef;
          nextEntry.transcriptRef = state.transcriptRef;
          nextEntry.segments = state.segments;
          nextEntry.speakers = state.speakers;
          nextEntry.tags = state.tags;
          nextEntry.isWhisperXFormat = state.isWhisperXFormat;
          // Only update timestamp if content changed, not just on activation
          if (baseChanged || !previous) {
            nextEntry.updatedAt = Date.now();
          }
          nextEntry.kind = state.sessionKind;
          nextEntry.label = state.sessionLabel;
          nextEntry.baseSessionKey = state.baseSessionKey;
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

      const nextGlobalPayload = buildGlobalStatePayload(state);
      const globalChanged =
        !lastGlobalPayload ||
        lastGlobalPayload.lexiconEntries !== nextGlobalPayload.lexiconEntries ||
        lastGlobalPayload.lexiconThreshold !== nextGlobalPayload.lexiconThreshold ||
        lastGlobalPayload.lexiconHighlightUnderline !==
          nextGlobalPayload.lexiconHighlightUnderline ||
        lastGlobalPayload.lexiconHighlightBackground !==
          nextGlobalPayload.lexiconHighlightBackground ||
        lastGlobalPayload.spellcheckEnabled !== nextGlobalPayload.spellcheckEnabled ||
        lastGlobalPayload.spellcheckLanguages !== nextGlobalPayload.spellcheckLanguages ||
        lastGlobalPayload.spellcheckIgnoreWords !== nextGlobalPayload.spellcheckIgnoreWords ||
        lastGlobalPayload.spellcheckCustomEnabled !== nextGlobalPayload.spellcheckCustomEnabled ||
        lastGlobalPayload.aiSpeakerConfig !== nextGlobalPayload.aiSpeakerConfig ||
        lastGlobalPayload.aiRevisionConfig !== nextGlobalPayload.aiRevisionConfig;

      if (shouldUpdateEntry || globalChanged || sessionActivated) {
        storeContext.persist(
          {
            sessions: storeContext.getSessionsCache(),
            activeSessionKey: storeContext.getActiveSessionKey(),
          },
          nextGlobalPayload,
        );
      }

      if (globalChanged) {
        lastGlobalPayload = nextGlobalPayload;
      }
    },
  );
}

export const selectAudioAndSessionState = (state: TranscriptStore) => ({
  audioFile: state.audioFile,
  audioUrl: state.audioUrl,
  transcriptRef: state.transcriptRef,
  sessionKey: state.sessionKey,
  sessionKind: state.sessionKind,
  sessionLabel: state.sessionLabel,
  baseSessionKey: state.baseSessionKey,
  recentSessions: state.recentSessions,
  isWhisperXFormat: state.isWhisperXFormat,
  setAudioFile: state.setAudioFile,
  setAudioUrl: state.setAudioUrl,
  setAudioReference: state.setAudioReference,
  activateSession: state.activateSession,
  loadTranscript: state.loadTranscript,
  createRevision: state.createRevision,
});

export const selectPlaybackState = (state: TranscriptStore) => ({
  currentTime: state.currentTime,
  isPlaying: state.isPlaying,
  duration: state.duration,
  seekRequestTime: state.seekRequestTime,
  requestSeek: state.requestSeek,
  clearSeekRequest: state.clearSeekRequest,
  setCurrentTime: state.setCurrentTime,
  setIsPlaying: state.setIsPlaying,
  setDuration: state.setDuration,
});

export const selectSegmentOperations = (state: TranscriptStore) => ({
  segments: state.segments,
  speakers: state.speakers,
  selectedSegmentId: state.selectedSegmentId,
  setSelectedSegmentId: state.setSelectedSegmentId,
  mergeSegments: state.mergeSegments,
  splitSegment: state.splitSegment,
  updateSegmentText: state.updateSegmentText,
  updateSegmentSpeaker: state.updateSegmentSpeaker,
  confirmSegment: state.confirmSegment,
  toggleSegmentBookmark: state.toggleSegmentBookmark,
  updateSegmentTiming: state.updateSegmentTiming,
  deleteSegment: state.deleteSegment,
  renameSpeaker: state.renameSpeaker,
  addSpeaker: state.addSpeaker,
  mergeSpeakers: state.mergeSpeakers,
  undo: state.undo,
  redo: state.redo,
  canUndo: state.canUndo,
  canRedo: state.canRedo,
});

export const selectLexiconAndSpellcheck = (state: TranscriptStore) => ({
  lexiconEntries: state.lexiconEntries,
  lexiconThreshold: state.lexiconThreshold,
  lexiconHighlightUnderline: state.lexiconHighlightUnderline,
  lexiconHighlightBackground: state.lexiconHighlightBackground,
  addLexiconFalsePositive: state.addLexiconFalsePositive,
  addLexiconEntry: state.addLexiconEntry,
  spellcheckEnabled: state.spellcheckEnabled,
  spellcheckLanguages: state.spellcheckLanguages,
  spellcheckIgnoreWords: state.spellcheckIgnoreWords,
  spellcheckCustomDictionaries: state.spellcheckCustomDictionaries,
  spellcheckCustomEnabled: state.spellcheckCustomEnabled,
  loadSpellcheckCustomDictionaries: state.loadSpellcheckCustomDictionaries,
  addSpellcheckIgnoreWord: state.addSpellcheckIgnoreWord,
  setSpellcheckEnabled: state.setSpellcheckEnabled,
  setSpellcheckLanguages: state.setSpellcheckLanguages,
  setSpellcheckCustomEnabled: state.setSpellcheckCustomEnabled,
});

export const useSegments = () => useTranscriptStore((state) => state.segments);
export const usePlaybackState = () => useTranscriptStore(selectPlaybackState);
export const useSpeakers = () => useTranscriptStore((state) => state.speakers);

export const selectAISpeakerState = (state: TranscriptStore) => ({
  suggestions: state.aiSpeakerSuggestions,
  isProcessing: state.aiSpeakerIsProcessing,
  processedCount: state.aiSpeakerProcessedCount,
  totalToProcess: state.aiSpeakerTotalToProcess,
  config: state.aiSpeakerConfig,
  error: state.aiSpeakerError,
  startAnalysis: state.startAnalysis,
  cancelAnalysis: state.cancelAnalysis,
  acceptSuggestion: state.acceptSuggestion,
  rejectSuggestion: state.rejectSuggestion,
  clearSuggestions: state.clearSuggestions,
  updateConfig: state.updateConfig,
  addPrompt: state.addPrompt,
  updatePrompt: state.updatePrompt,
  deletePrompt: state.deletePrompt,
  setActivePrompt: state.setActivePrompt,
});

export type {
  AISpeakerConfig,
  AISpeakerSuggestion,
  FileReference,
  LexiconEntry,
  AIPrompt,
  SearchMatch,
  Segment,
  Speaker,
  SpellcheckCustomDictionary,
  SpellcheckLanguage,
  SessionKind,
  Tag,
  Word,
};
