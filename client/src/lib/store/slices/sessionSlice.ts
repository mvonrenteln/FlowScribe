import type { StoreApi } from "zustand";
import { buildSessionKey, isSameFileReference } from "@/lib/fileReference";
import { SPEAKER_COLORS } from "../constants";
import type { StoreContext } from "../context";
import type { Segment, SessionSlice, TranscriptStore } from "../types";
import { generateId } from "../utils/id";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

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
          audioRef: reference,
          transcriptRef: state.transcriptRef,
          segments: state.segments,
          speakers: state.speakers,
          selectedSegmentId: state.selectedSegmentId,
          currentTime: state.currentTime,
          isWhisperXFormat: state.isWhisperXFormat,
          updatedAt: Date.now(),
        },
      });
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
    const session = context.getSessionsCache()[sessionKey];
    const shouldPromoteCurrent = !session && state.segments.length > 0;
    if (shouldPromoteCurrent) {
      context.setSessionsCache({
        ...context.getSessionsCache(),
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
      });
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
