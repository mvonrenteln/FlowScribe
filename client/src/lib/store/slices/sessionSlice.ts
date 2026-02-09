import type { StoreApi } from "zustand";
import {
  buildAudioRefKey,
  clearAudioHandleForAudioRef,
  loadAudioHandleForAudioRef,
  queryAudioHandlePermission,
} from "@/lib/audioHandleStorage";
import confirmIfLargeAudio from "@/lib/confirmLargeFile";
import { buildSessionKey, isSameFileReference } from "@/lib/fileReference";
import { buildRecentSessions } from "@/lib/storage";
import { normalizeSegments } from "@/lib/transcript/normalizeTranscript";
import { SPEAKER_COLORS } from "../constants";
import type { StoreContext } from "../context";
import type {
  PersistedSession,
  Segment,
  SessionKind,
  SessionSlice,
  TranscriptStore,
} from "../types";
import { buildGlobalStatePayload } from "../utils/globalState";
import { generateId } from "../utils/id";
import { normalizeLexiconSessionIgnores } from "../utils/lexicon";
import { buildRevisionKey, cloneSessionForRevision } from "../utils/session";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

const getSessionKind = (session?: PersistedSession, fallback?: SessionKind) =>
  session?.kind ?? fallback ?? "current";

const getSessionLabel = (session?: PersistedSession, fallback?: string | null) =>
  session?.label ?? fallback ?? null;

const getBaseSessionKey = (session?: PersistedSession, fallback?: string | null) =>
  session?.baseSessionKey ?? fallback ?? null;

const buildPersistedSession = (state: TranscriptStore): PersistedSession => ({
  audioRef: state.audioRef,
  transcriptRef: state.transcriptRef,
  segments: state.segments,
  speakers: state.speakers,
  tags: state.tags,
  chapters: state.chapters,
  lexiconSessionIgnores: state.lexiconSessionIgnores,
  selectedSegmentId: state.selectedSegmentId,
  selectedChapterId: state.selectedChapterId,
  currentTime: state.currentTime,
  isWhisperXFormat: state.isWhisperXFormat,
  updatedAt: Date.now(),
  kind: state.sessionKind,
  label: state.sessionLabel,
  baseSessionKey: state.baseSessionKey,
});

export const createSessionSlice = (
  set: StoreSetter,
  get: StoreGetter,
  context: StoreContext,
): SessionSlice => ({
  setAudioFile: (file) => set({ audioFile: file }),
  setAudioUrl: (url) => set({ audioUrl: url }),
  setAudioReference: (reference) => {
    const state = get();
    const audioChanged = !isSameFileReference(state.audioRef, reference);
    const shouldResetTranscript = audioChanged && reference !== null;
    // When switching to a new audio, flush the current session to localStorage
    // immediately to prevent data loss if the tab crashes shortly after
    // (e.g., from loading a very large audio file that causes OOM).
    if (shouldResetTranscript && state.segments.length > 0) {
      context.setSessionsCache({
        ...context.getSessionsCache(),
        [state.sessionKey]: buildPersistedSession(state),
      });
      context.persistSync();
    }
    const nextTranscriptRef = shouldResetTranscript ? null : state.transcriptRef;
    const confidenceScoresVersion = state.confidenceScoresVersion + 1;
    const sessionKey = buildSessionKey(reference, nextTranscriptRef);
    const session = context.getSessionsCache()[sessionKey];
    const shouldPromoteCurrent = !session && state.segments.length > 0 && !shouldResetTranscript;
    const persistedSegments = session ? normalizeSegments(session.segments) : undefined;
    const persistedHistorySegments = session ? normalizeSegments(session.segments) : undefined;
    if (shouldPromoteCurrent) {
      context.setSessionsCache({
        ...context.getSessionsCache(),
        [sessionKey]: {
          ...buildPersistedSession(state),
          audioRef: reference,
          baseSessionKey: state.baseSessionKey,
        },
      });
    }
    const sessionKind = getSessionKind(
      session,
      shouldResetTranscript ? "current" : state.sessionKind,
    );
    const sessionLabel = getSessionLabel(
      session,
      shouldResetTranscript ? null : (state.sessionLabel ?? state.transcriptRef?.name ?? null),
    );
    const baseSessionKey = getBaseSessionKey(
      session,
      shouldResetTranscript ? null : state.baseSessionKey,
    );
    const selectedSegmentId =
      session?.selectedSegmentId &&
      session.segments.some((segment) => segment.id === session.selectedSegmentId)
        ? session.selectedSegmentId
        : shouldPromoteCurrent
          ? state.selectedSegmentId
          : (session?.segments[0]?.id ?? null);
    const nextSegments = shouldResetTranscript
      ? []
      : (persistedSegments ?? (shouldPromoteCurrent ? state.segments : []));
    const nextSpeakers = shouldResetTranscript
      ? []
      : (session?.speakers ?? (shouldPromoteCurrent ? state.speakers : []));
    const nextTags = shouldResetTranscript
      ? []
      : (session?.tags ?? (shouldPromoteCurrent ? state.tags : []));
    const nextChapters = shouldResetTranscript
      ? []
      : (session?.chapters ?? (shouldPromoteCurrent ? state.chapters : []));
    const nextLexiconSessionIgnores = shouldResetTranscript
      ? []
      : normalizeLexiconSessionIgnores(
          session?.lexiconSessionIgnores ??
            (shouldPromoteCurrent ? state.lexiconSessionIgnores : []),
        );
    const nextSelectedSegmentId = shouldResetTranscript ? null : selectedSegmentId;
    const nextSelectedChapterId = shouldResetTranscript
      ? null
      : (session?.selectedChapterId ?? null);
    const nextCurrentTime = shouldResetTranscript
      ? 0
      : (session?.currentTime ?? (shouldPromoteCurrent ? state.currentTime : 0));
    const nextIsWhisperXFormat = shouldResetTranscript
      ? false
      : (session?.isWhisperXFormat ?? (shouldPromoteCurrent ? state.isWhisperXFormat : false));
    const nextHistory = shouldResetTranscript
      ? []
      : session?.segments?.length || shouldPromoteCurrent
        ? [
            {
              segments: persistedHistorySegments ?? session?.segments ?? state.segments,
              speakers: session?.speakers ?? state.speakers,
              tags: session?.tags ?? state.tags,
              chapters: session?.chapters ?? state.chapters,
              selectedSegmentId,
              selectedChapterId: session?.selectedChapterId ?? state.selectedChapterId,
              currentTime: session?.currentTime ?? state.currentTime,
              confidenceScoresVersion,
            },
          ]
        : [];
    const nextHistoryIndex = shouldResetTranscript
      ? -1
      : session?.segments.length || shouldPromoteCurrent
        ? 0
        : -1;
    set({
      audioRef: reference,
      transcriptRef: nextTranscriptRef,
      sessionKey,
      sessionKind,
      sessionLabel,
      baseSessionKey,
      segments: nextSegments,
      speakers: nextSpeakers,
      tags: nextTags,
      chapters: nextChapters,
      lexiconSessionIgnores: nextLexiconSessionIgnores,
      selectedSegmentId: nextSelectedSegmentId,
      selectedChapterId: nextSelectedChapterId,
      currentTime: nextCurrentTime,
      isWhisperXFormat: nextIsWhisperXFormat,
      history: nextHistory,
      historyIndex: nextHistoryIndex,
      confidenceScoresVersion,
    });
  },
  setTranscriptReference: (reference) => {
    const state = get();
    const confidenceScoresVersion = state.confidenceScoresVersion + 1;
    const sessionKey =
      state.audioRef === null ? state.sessionKey : buildSessionKey(state.audioRef, reference);
    const session = context.getSessionsCache()[sessionKey];
    const shouldPromoteCurrent = !session && state.segments.length > 0;
    const persistedSegments = session ? normalizeSegments(session.segments) : undefined;
    const persistedHistorySegments = session ? normalizeSegments(session.segments) : undefined;
    if (shouldPromoteCurrent) {
      context.setSessionsCache({
        ...context.getSessionsCache(),
        [sessionKey]: {
          ...buildPersistedSession(state),
          transcriptRef: reference,
          baseSessionKey: state.baseSessionKey,
        },
      });
    }
    const sessionKind = getSessionKind(session, state.sessionKind);
    const sessionLabel = getSessionLabel(
      session,
      state.sessionLabel ?? reference?.name ?? state.transcriptRef?.name ?? null,
    );
    const baseSessionKey = getBaseSessionKey(session, state.baseSessionKey);
    const nextLexiconSessionIgnores = normalizeLexiconSessionIgnores(
      session?.lexiconSessionIgnores ?? (shouldPromoteCurrent ? state.lexiconSessionIgnores : []),
    );
    const selectedSegmentId =
      session?.selectedSegmentId &&
      session.segments.some((segment) => segment.id === session.selectedSegmentId)
        ? session.selectedSegmentId
        : shouldPromoteCurrent
          ? state.selectedSegmentId
          : (session?.segments[0]?.id ?? null);
    const selectedChapterId = session?.selectedChapterId ?? null;
    set({
      audioRef: state.audioRef,
      transcriptRef: reference,
      sessionKey,
      sessionKind,
      sessionLabel,
      baseSessionKey,
      segments: persistedSegments ?? (shouldPromoteCurrent ? state.segments : []),
      speakers: session?.speakers ?? (shouldPromoteCurrent ? state.speakers : []),
      tags: session?.tags ?? (shouldPromoteCurrent ? state.tags : []),
      chapters: session?.chapters ?? (shouldPromoteCurrent ? state.chapters : []),
      lexiconSessionIgnores: nextLexiconSessionIgnores,
      selectedSegmentId,
      selectedChapterId,
      currentTime: session?.currentTime ?? (shouldPromoteCurrent ? state.currentTime : 0),
      isWhisperXFormat:
        session?.isWhisperXFormat ?? (shouldPromoteCurrent ? state.isWhisperXFormat : false),
      history:
        session?.segments?.length || shouldPromoteCurrent
          ? [
              {
                segments: persistedHistorySegments ?? session?.segments ?? state.segments,
                speakers: session?.speakers ?? state.speakers,
                tags: session?.tags ?? state.tags,
                chapters: session?.chapters ?? state.chapters,
                selectedSegmentId,
                selectedChapterId,
                currentTime: session?.currentTime ?? (shouldPromoteCurrent ? state.currentTime : 0),
                confidenceScoresVersion,
              },
            ]
          : [],
      historyIndex: session?.segments.length || shouldPromoteCurrent ? 0 : -1,
      confidenceScoresVersion,
    });
  },
  activateSession: (key) => {
    const session = context.getSessionsCache()[key];
    if (!session) return;
    const selectedSegmentId =
      session.selectedSegmentId &&
      session.segments.some((segment) => segment.id === session.selectedSegmentId)
        ? session.selectedSegmentId
        : (session.segments[0]?.id ?? null);
    const selectedChapterId = session.selectedChapterId ?? null;
    const state = get();
    const confidenceScoresVersion = state.confidenceScoresVersion + 1;
    const shouldClearAudio = !isSameFileReference(state.audioRef, session.audioRef);

    // Abort any running AI operations before switching sessions
    state.aiSpeakerAbortController?.abort();
    state.aiRevisionAbortController?.abort();
    state.aiSegmentMergeAbortController?.abort();
    state.aiChapterDetectionAbortController?.abort();
    state.rewriteAbortController?.abort();

    set({
      audioRef: session.audioRef,
      transcriptRef: session.transcriptRef,
      sessionKey: key,
      sessionKind: session.kind ?? "current",
      sessionLabel: session.label ?? null,
      baseSessionKey: session.baseSessionKey ?? null,
      segments: normalizeSegments(session.segments),
      speakers: session.speakers,
      tags: session.tags ?? [],
      chapters: session.chapters ?? [],
      lexiconSessionIgnores: normalizeLexiconSessionIgnores(session.lexiconSessionIgnores),
      selectedSegmentId,
      selectedChapterId,
      currentTime: session.currentTime ?? 0,
      isWhisperXFormat: session.isWhisperXFormat ?? false,
      history: [
        {
          segments: normalizeSegments(session.segments),
          speakers: session.speakers,
          tags: session.tags ?? [],
          chapters: session.chapters ?? [],
          selectedSegmentId,
          selectedChapterId,
          currentTime: session.currentTime ?? 0,
          confidenceScoresVersion,
        },
      ],
      historyIndex: 0,
      audioFile: shouldClearAudio ? null : state.audioFile,
      audioUrl: shouldClearAudio ? null : state.audioUrl,
      seekRequestTime: null,
      confidenceScoresVersion,
      // Clear all AI suggestions and states when switching sessions
      aiSpeakerSuggestions: [],
      aiSpeakerIsProcessing: false,
      aiSpeakerProcessedCount: 0,
      aiSpeakerTotalToProcess: 0,
      aiSpeakerError: null,
      aiSpeakerAbortController: null,
      aiSpeakerBatchInsights: [],
      aiSpeakerDiscrepancyNotice: null,
      aiSpeakerBatchLog: [],
      aiRevisionSuggestions: [],
      aiRevisionIsProcessing: false,
      aiRevisionCurrentSegmentId: null,
      aiRevisionProcessedCount: 0,
      aiRevisionTotalToProcess: 0,
      aiRevisionError: null,
      aiRevisionAbortController: null,
      aiRevisionBatchLog: [],
      aiRevisionLastResult: null,
      aiSegmentMergeSuggestions: [],
      aiSegmentMergeIsProcessing: false,
      aiSegmentMergeProcessedCount: 0,
      aiSegmentMergeTotalToProcess: 0,
      aiSegmentMergeError: null,
      aiSegmentMergeAbortController: null,
      aiSegmentMergeBatchLog: [],
      aiChapterDetectionSuggestions: [],
      aiChapterDetectionIsProcessing: false,
      aiChapterDetectionProcessedBatches: 0,
      aiChapterDetectionTotalBatches: 0,
      aiChapterDetectionError: null,
      aiChapterDetectionAbortController: null,
      aiChapterDetectionBatchLog: [],
      rewriteInProgress: false,
      rewriteChapterId: null,
      rewriteError: null,
      rewriteAbortController: null,
    });

    // Try to restore audio handle for this session
    // Use audio reference key for handle lookup
    if (shouldClearAudio && session.audioRef) {
      const audioRefKey = buildAudioRefKey(session.audioRef);
      loadAudioHandleForAudioRef(audioRefKey)
        .then(async (handle) => {
          if (!handle) return;
          const granted = await queryAudioHandlePermission(handle);
          if (!granted) return;
          const file = await handle.getFile();
          const proceed = confirmIfLargeAudio(file);
          if (!proceed) {
            // User declined loading the large file for this audio
            clearAudioHandleForAudioRef(audioRefKey).catch((err) =>
              console.error("Failed to clear audio handle:", err),
            );
            return;
          }
          // Load audio file for this session
          const currentState = get();

          // Check if the audio reference is still the same, not just the sessionKey
          // This allows audio loading to continue even if a transcript was added
          // (which changes the sessionKey but keeps the same audioRef)
          const targetAudioRef = session.audioRef;
          if (!isSameFileReference(currentState.audioRef, targetAudioRef)) {
            // Audio reference changed - abort loading
            return;
          }

          // Reuse the session's audioRef identity to avoid creating a new
          // object that would trigger an unnecessary subscription fire and
          // potentially a different sessionKey.
          const fileRef = session.audioRef;
          const url = URL.createObjectURL(file);

          set({
            audioFile: file,
            audioUrl: url,
            audioRef: fileRef,
          });
        })
        .catch((err) => console.error("Failed to restore audio handle:", err));
    }
  },
  createRevision: (name, overwrite) => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    const state = get();
    const sessions = context.getSessionsCache();

    let revisionKey = buildRevisionKey(state.sessionKey);

    if (overwrite) {
      // Find existing revision with this name for the current base session
      const existingEntry = Object.entries(sessions).find(([_key, session]) => {
        return (
          session.kind === "revision" &&
          session.baseSessionKey === state.sessionKey &&
          session.label === trimmedName
        );
      });
      if (existingEntry) {
        revisionKey = existingEntry[0];
      }
    }

    const revisionClone = cloneSessionForRevision({
      ...buildPersistedSession(state),
      kind: "revision",
      label: trimmedName,
      baseSessionKey: state.sessionKey,
      updatedAt: Date.now(),
    });

    const nextSessions = {
      ...sessions,
      [revisionKey]: revisionClone,
    };
    context.setSessionsCache(nextSessions);
    const recentSessions = buildRecentSessions(nextSessions);
    context.setLastRecentSerialized(JSON.stringify(recentSessions));
    set({ recentSessions });
    context.persist(
      { sessions: nextSessions, activeSessionKey: context.getActiveSessionKey() },
      buildGlobalStatePayload(get()),
    );
    return revisionKey;
  },
  deleteSession: (key) => {
    const sessions = context.getSessionsCache();
    if (!sessions[key]) return;

    const nextSessions = { ...sessions };
    delete nextSessions[key];

    const activeKey = context.getActiveSessionKey();
    const nextActiveKey = activeKey === key ? null : activeKey;
    if (activeKey === key) {
      context.setActiveSessionKey(null);
    }

    context.setSessionsCache(nextSessions);
    const recentSessions = buildRecentSessions(nextSessions);
    context.setLastRecentSerialized(JSON.stringify(recentSessions));
    set({ recentSessions });
    context.persist(
      { sessions: nextSessions, activeSessionKey: nextActiveKey },
      buildGlobalStatePayload(get()),
    );
  },
});

export const buildInitialSpeakers = (segments: Segment[]) =>
  Array.from(new Set(segments.map((s) => s.speaker))).map((name, index) => ({
    id: generateId(),
    name,
    color: SPEAKER_COLORS[index % SPEAKER_COLORS.length],
  }));

export const buildInitialHistory = (
  session: {
    segments: Segment[];
    speakers: TranscriptStore["speakers"];
    tags: TranscriptStore["tags"];
    chapters: TranscriptStore["chapters"];
    selectedSegmentId: string | null;
    selectedChapterId: string | null;
    currentTime: number;
    confidenceScoresVersion: number;
  } | null,
) => {
  if (session?.segments.length && session.speakers.length) {
    return {
      history: [
        {
          segments: session.segments,
          speakers: session.speakers,
          tags: session.tags,
          chapters: session.chapters,
          selectedSegmentId: session.selectedSegmentId,
          selectedChapterId: session.selectedChapterId,
          currentTime: session.currentTime,
          confidenceScoresVersion: session.confidenceScoresVersion,
        },
      ],
      historyIndex: 0,
    };
  }
  return { history: [], historyIndex: -1 };
};
