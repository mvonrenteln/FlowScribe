import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { BackupScheduler } from "@/lib/backup/BackupScheduler";
import { type BackupStatus, DEFAULT_BACKUP_CONFIG, DEFAULT_BACKUP_STATE } from "@/lib/backup/types";
import { buildSessionKey, type FileReference, isSameFileReference } from "@/lib/fileReference";
import { mark } from "@/lib/logging";
import {
  buildRecentSessions,
  canUseLocalStorage,
  createStorageScheduler,
  readGlobalState,
  readSessionsState,
  writeSessionsSync,
} from "@/lib/storage";
import type { Chapter, ChapterUpdate } from "@/types/chapter";
import {
  PAUSED_TIME_PERSIST_STEP,
  PERSIST_THROTTLE_MS,
  PLAYING_TIME_PERSIST_STEP,
} from "./store/constants";
import { createStoreContext, type StoreContext } from "./store/context";
import {
  createAIChapterDetectionSlice,
  initialAIChapterDetectionState,
} from "./store/slices/aiChapterDetectionSlice";
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
import { createChapterSlice } from "./store/slices/chapterSlice";
import { createConfidenceSlice } from "./store/slices/confidenceSlice";
import { createHistorySlice } from "./store/slices/historySlice";
import { createLexiconSlice } from "./store/slices/lexiconSlice";
import { createPlaybackSlice } from "./store/slices/playbackSlice";
import { createRewriteSlice, initialRewriteState } from "./store/slices/rewriteSlice";
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
import { normalizeAIChapterDetectionConfig } from "./store/utils/aiChapterDetectionConfig";
import { normalizeAISegmentMergeConfig } from "./store/utils/aiSegmentMergeConfig";
import { normalizeAISpeakerConfig } from "./store/utils/aiSpeakerConfig";
import { memoizedBuildSegmentIndexMap, memoizedBuildSegmentMaps } from "./store/utils/chapters";
import { buildGlobalStatePayload } from "./store/utils/globalState";
import { normalizeLexiconEntriesFromGlobal } from "./store/utils/lexicon";
import {
  arePersistenceSelectionsEqual,
  selectPersistenceState,
} from "./store/utils/persistenceSelector";
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

/**
 * Return a memoized mapping of segment id -> index for the current store `segments`.
 *
 * This selector is optimized for performance: the underlying builder (`memoizedBuildSegmentIndexMap`)
 * uses a WeakMap cache keyed by the `segments` array identity so callers do not repeatedly rebuild
 * an O(n) index on every render. Use this when you need a fast id->index lookup in components
 * or selectors.
 *
 * Returns: `Map<string, number>`
 */
export const useSegmentIndexById = () =>
  useTranscriptStore((s) => memoizedBuildSegmentIndexMap(s.segments));

/**
 * Synchronous variant of `useSegmentIndexById` for imperative code.
 * Reads the current store state and returns the memoized id->index map.
 */
export const getSegmentIndexById = () =>
  memoizedBuildSegmentIndexMap(useTranscriptStore.getState().segments);

/**
 * Return a small set of memoized lookup maps derived from the store `segments`.
 *
 * The returned object contains at least:
 * - `segmentById`: Map<string, Segment>
 * - `indexById`: Map<string, number>
 *
 * Like the index selector, the maps are memoized (WeakMap keyed by the segments array)
 * so repeated reads are cheap and safe in render paths. Use `useSegmentMaps` in
 * components that need both id->segment and id->index lookups.
 */
export const useSegmentMaps = () => useTranscriptStore((s) => memoizedBuildSegmentMaps(s.segments));

/**
 * Synchronous variant of `useSegmentMaps` for imperative code.
 */
export const getSegmentMaps = () =>
  memoizedBuildSegmentMaps(useTranscriptStore.getState().segments);

/**
 * Convenience hook: return the `Segment` for the given id, or `undefined`.
 * Uses `useSegmentMaps()` internally and is safe to call from React components.
 */
export const useSegmentById = (id: string | null | undefined) => {
  const maps = useSegmentMaps();
  if (!id) return undefined;
  return maps.segmentById.get(id) as Segment | undefined;
};

/**
 * Synchronous variant of `useSegmentById` for imperative code paths.
 */
export const getSegmentById = (id: string | null | undefined) => {
  if (!id) return undefined;
  return getSegmentMaps().segmentById.get(id) as Segment | undefined;
};

const rawActiveSession =
  sessionsState.activeSessionKey && sessionsState.sessions[sessionsState.activeSessionKey]
    ? sessionsState.sessions[sessionsState.activeSessionKey]
    : null;
const activeSession = rawActiveSession
  ? {
      ...rawActiveSession,
      segments: normalizeSegments(rawActiveSession.segments),
      tags: rawActiveSession.tags ?? [],
      chapters: rawActiveSession.chapters ?? [],
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
        chapters: activeSession.chapters ?? [],
        selectedSegmentId: activeSession.selectedSegmentId,
        selectedChapterId: activeSession.selectedChapterId ?? null,
        currentTime: activeSession.currentTime ?? 0,
        confidenceScoresVersion: 0,
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
  chapters: activeSession?.chapters ?? [],
  selectedSegmentId: activeSession?.selectedSegmentId ?? null,
  selectedChapterId: activeSession?.selectedChapterId ?? null,
  chapterDisplayModes: {},
  currentTime: activeSession?.currentTime ?? 0,
  isPlaying: false,
  duration: 0,
  seekRequestTime: null,
  history: initialHistoryState.history,
  historyIndex: initialHistoryState.historyIndex,
  isWhisperXFormat: activeSession?.isWhisperXFormat ?? false,
  filteredSegmentIds: new Set(),
  filtersActive: false,
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
  confidenceScoresVersion: 0,
  // AI Revision state
  ...initialAIRevisionState,
  aiRevisionConfig: normalizeAIRevisionConfig(globalState?.aiRevisionConfig),
  // AI Segment Merge state
  ...initialAISegmentMergeState,
  aiSegmentMergeConfig: normalizeAISegmentMergeConfig(globalState?.aiSegmentMergeConfig),
  // AI Chapter Detection state
  ...initialAIChapterDetectionState,
  aiChapterDetectionConfig: normalizeAIChapterDetectionConfig(
    globalState?.aiChapterDetectionConfig,
    globalState?.rewritePrompts,
    globalState?.rewriteConfig,
  ),
  // Rewrite state
  ...initialRewriteState,
  // Backup config (persisted in global state — config only, no runtime state)
  backupConfig: { ...DEFAULT_BACKUP_CONFIG, ...(globalState?.backupConfig ?? {}) },
  // Backup runtime state — transient, never persisted, reset on every load
  backupState: {
    ...DEFAULT_BACKUP_STATE,
    status: (globalState?.backupConfig?.enabled ? "enabled" : "disabled") as BackupStatus,
  },
  // Chapter Metadata state
  chapterMetadataTitleSuggestions: null,
  chapterMetadataTitleLoading: false,
  chapterMetadataTitleChapterId: null,
  chapterMetadataSummaryLoading: false,
  chapterMetadataSummaryChapterId: null,
  chapterMetadataNotesLoading: false,
  chapterMetadataNotesChapterId: null,
  chapterMetadataError: null,
  chapterMetadataAbortController: null,
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
      writeSessionsSync,
      (recentSessions) => set({ recentSessions }),
    );

    return {
      ...initialState,
      ...createSessionSlice(set, get, storeContext),
      ...createPlaybackSlice(set, get),
      ...createSegmentsSlice(set, get, storeContext),
      ...createSpeakersSlice(set, get),
      ...createTagsSlice(set, get),
      ...createChapterSlice(set, get),
      ...createLexiconSlice(set, get),
      ...createSpellcheckSlice(set, get),
      ...createHistorySlice(set, get),
      ...createAISpeakerSlice(set, get),
      ...createConfidenceSlice(set, get),
      ...createAIRevisionSlice(set, get),
      ...createAiRevisionSelectionSlice(set, get),
      ...createAISegmentMergeSlice(set, get),
      ...createAIChapterDetectionSlice(set, get),
      ...createRewriteSlice(set, get),
      quotaErrorShown: false,
      setQuotaErrorShown: (shown: boolean) => set({ quotaErrorShown: shown }),
      setBackupConfig: (patch) =>
        set((state) => ({ backupConfig: { ...state.backupConfig, ...patch } })),
      setBackupState: (patch) =>
        set((state) => ({ backupState: { ...state.backupState, ...patch } })),
    };
  }),
);

// Initialize backup scheduler (browser only, not in test environment)
if (typeof window !== "undefined" && !import.meta.env.VITEST) {
  const initBackup = async () => {
    const { FileSystemProvider } = await import("@/lib/backup/providers/FileSystemProvider");
    const { DownloadProvider } = await import("@/lib/backup/providers/DownloadProvider");

    const fsProvider = new FileSystemProvider();
    await fsProvider.initialize();

    const provider = fsProvider.isSupported() ? fsProvider : new DownloadProvider();
    const scheduler = new BackupScheduler(provider);
    scheduler.start(useTranscriptStore);

    // Store scheduler reference for access from UI
    (window as Window & { __backupScheduler?: BackupScheduler }).__backupScheduler = scheduler;
  };
  void initBackup();
}

if (canUseLocalStorage()) {
  let __storeSubscriptionCount = 0;
  useTranscriptStore.subscribe(
    selectPersistenceState,
    (state) => {
      __storeSubscriptionCount += 1;
      if (__storeSubscriptionCount % 100 === 0) {
        mark("store-subscription-bulk", { count: __storeSubscriptionCount });
      }
      // DEV-only: allow temporarily disabling persistence to run A/B perf tests.
      // Set `window.__DEV_DISABLE_PERSISTENCE = true` in the browser console to disable.
      if (import.meta.env.DEV) {
        try {
          // global flag checked on each subscription fire; default is false.
          const maybeFlag = globalThis as unknown as { __DEV_DISABLE_PERSISTENCE?: unknown };
          const devDisabled = maybeFlag.__DEV_DISABLE_PERSISTENCE === true;
          if (devDisabled) return;
        } catch (_e) {
          // ignore safety errors in exotic environments
        }
      }
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
        previous.chapters !== state.chapters ||
        !isSameFileReference(previous.audioRef, state.audioRef) ||
        !isSameFileReference(previous.transcriptRef, state.transcriptRef) ||
        previous.isWhisperXFormat !== state.isWhisperXFormat;
      const shouldUpdateSelected =
        !previous ||
        previous.selectedSegmentId !== state.selectedSegmentId ||
        previous.selectedChapterId !== state.selectedChapterId;
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
          chapters: state.chapters,
          selectedSegmentId: state.selectedSegmentId,
          selectedChapterId: state.selectedChapterId,
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
          nextEntry.chapters = state.chapters;
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
          nextEntry.selectedChapterId = state.selectedChapterId;
        }
        if (shouldUpdateTime || !previous) {
          nextEntry.currentTime = state.currentTime;
        }
        storeContext.setSessionsCache({
          ...storeContext.getSessionsCache(),
          [sessionKey]: nextEntry,
        });
      }

      if (state.segments.length > 0 || state.transcriptRef) {
        storeContext.setActiveSessionKey(sessionKey);
      }

      // Remove ghost sessions: entries with no segments, no transcript, and
      // not the currently active session key.  These accumulate when
      // setAudioReference creates intermediate "audio-only" entries.
      const currentCache = storeContext.getSessionsCache();
      const cleaned = Object.fromEntries(
        Object.entries(currentCache).filter(
          ([key, s]) => s.segments.length > 0 || s.transcriptRef || key === sessionKey,
        ),
      );
      if (Object.keys(cleaned).length !== Object.keys(currentCache).length) {
        storeContext.setSessionsCache(cleaned);
      }

      if (shouldTouchSession) {
        storeContext.updateRecentSessions(storeContext.getSessionsCache());
      }

      const nextGlobalPayload = buildGlobalStatePayload(useTranscriptStore.getState());
      const globalChanged =
        !lastGlobalPayload ||
        lastGlobalPayload.backupConfig !== nextGlobalPayload.backupConfig ||
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
        lastGlobalPayload.aiRevisionConfig !== nextGlobalPayload.aiRevisionConfig ||
        lastGlobalPayload.aiSegmentMergeConfig !== nextGlobalPayload.aiSegmentMergeConfig ||
        lastGlobalPayload.aiChapterDetectionConfig !== nextGlobalPayload.aiChapterDetectionConfig ||
        lastGlobalPayload.rewriteConfig !== nextGlobalPayload.rewriteConfig ||
        lastGlobalPayload.rewritePrompts !== nextGlobalPayload.rewritePrompts;

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
    { equalityFn: arePersistenceSelectionsEqual },
  );

  // Flush sessions cache to localStorage synchronously before the page unloads.
  // The throttled persist pipeline (with Web Worker) may still be pending when
  // the user refreshes or navigates away, which would cause recent sessions to
  // be lost. This handler ensures all in-memory session data is written.
  window.addEventListener("beforeunload", () => {
    if (storeContext) {
      writeSessionsSync({
        sessions: storeContext.getSessionsCache(),
        activeSessionKey: storeContext.getActiveSessionKey(),
      });
    }
  });
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
  Chapter,
  ChapterUpdate,
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
