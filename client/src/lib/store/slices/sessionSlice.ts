import type { StoreApi } from "zustand";
import { buildSessionKey, isSameFileReference } from "@/lib/fileReference";
import { buildRecentSessions } from "@/lib/storage";
import { SPEAKER_COLORS } from "../constants";
import type { StoreContext } from "../context";
import type {
  PersistedSession,
  Segment,
  SessionKind,
  SessionSlice,
  TranscriptStore,
} from "../types";
import { buildGlobalStateSnapshot } from "../utils/globalState";
import { generateId } from "../utils/id";
import { buildRevisionKey, cloneSessionForSnapshot } from "../utils/session";

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
  selectedSegmentId: state.selectedSegmentId,
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
    const sessionKey =
      state.transcriptRef === null
        ? state.sessionKey
        : buildSessionKey(reference, state.transcriptRef);
    const session = context.getSessionsCache()[sessionKey];
    const shouldPromoteCurrent = !session && state.segments.length > 0;
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
    const sessionKind = getSessionKind(session, state.sessionKind);
    const sessionLabel = getSessionLabel(
      session,
      state.sessionLabel ?? state.transcriptRef?.name ?? null,
    );
    const baseSessionKey = getBaseSessionKey(session, state.baseSessionKey);
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
      sessionKind,
      sessionLabel,
      baseSessionKey,
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
    const session = context.getSessionsCache()[sessionKey];
    const shouldPromoteCurrent = !session && state.segments.length > 0;
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
      sessionKind,
      sessionLabel,
      baseSessionKey,
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
    const session = context.getSessionsCache()[key];
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
      sessionKind: session.kind ?? "current",
      sessionLabel: session.label ?? null,
      baseSessionKey: session.baseSessionKey ?? null,
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
  createRevision: (name) => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    const state = get();
    const snapshot = cloneSessionForSnapshot({
      ...buildPersistedSession(state),
      kind: "revision",
      label: trimmedName,
      baseSessionKey: state.sessionKey,
      updatedAt: Date.now(),
    });
    const revisionKey = buildRevisionKey(state.sessionKey);
    const nextSessions = {
      ...context.getSessionsCache(),
      [revisionKey]: snapshot,
    };
    context.setSessionsCache(nextSessions);
    const recentSessions = buildRecentSessions(nextSessions);
    context.setLastRecentSerialized(JSON.stringify(recentSessions));
    set({ recentSessions });
    context.persist(
      { sessions: nextSessions, activeSessionKey: context.getActiveSessionKey() },
      buildGlobalStateSnapshot(get()),
    );
    return revisionKey;
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
    selectedSegmentId: string | null;
  } | null,
) => {
  if (session?.segments.length && session.speakers.length) {
    return {
      history: [
        {
          segments: session.segments,
          speakers: session.speakers,
          selectedSegmentId: session.selectedSegmentId,
        },
      ],
      historyIndex: 0,
    };
  }
  return { history: [], historyIndex: -1 };
};
