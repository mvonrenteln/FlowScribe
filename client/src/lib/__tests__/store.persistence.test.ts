import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSessionKey, type FileReference } from "@/lib/fileReference";
import type { Segment, Speaker } from "@/lib/store";

const SESSIONS_STORAGE_KEY = "flowscribe:sessions";

const makeRef = (name: string, size = 1): FileReference => ({
  name,
  size,
  lastModified: size,
});

const makeSegment = (id: string, speaker = "SPEAKER_00"): Segment => ({
  id,
  speaker,
  start: 0,
  end: 1,
  text: id,
  words: [{ word: id, start: 0, end: 1 }],
});

const makeSpeaker = (id: string, name = "SPEAKER_00"): Speaker => ({
  id,
  name,
  color: "red",
});

const loadStore = async () => {
  vi.resetModules();
  const mod = await import("@/lib/store");
  return mod.useTranscriptStore;
};

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("useTranscriptStore persistence", () => {
  it("selects the most recent session when no active key is stored", async () => {
    const sessionAKey = buildSessionKey(makeRef("audio-a"), makeRef("transcript-a"));
    const sessionBKey = buildSessionKey(makeRef("audio-b"), makeRef("transcript-b"));
    const sessions = {
      [sessionAKey]: {
        audioRef: makeRef("audio-a"),
        transcriptRef: makeRef("transcript-a"),
        segments: [makeSegment("seg-a")],
        speakers: [makeSpeaker("speaker-a")],
        selectedSegmentId: "seg-a",
        currentTime: 4,
        isWhisperXFormat: false,
        updatedAt: 10,
      },
      [sessionBKey]: {
        audioRef: makeRef("audio-b"),
        transcriptRef: makeRef("transcript-b"),
        segments: [makeSegment("seg-b")],
        speakers: [makeSpeaker("speaker-b")],
        selectedSegmentId: "seg-b",
        currentTime: 2,
        isWhisperXFormat: true,
        updatedAt: 20,
      },
    };
    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify({ sessions, activeSessionKey: null }),
    );

    const store = await loadStore();
    const state = store.getState();
    expect(state.sessionKey).toBe(sessionBKey);
    expect(state.recentSessions[0]?.key).toBe(sessionBKey);
  });

  it("ignores malformed session storage and starts empty", async () => {
    window.localStorage.setItem(SESSIONS_STORAGE_KEY, "{not-json");

    const store = await loadStore();
    const state = store.getState();
    expect(state.segments).toEqual([]);
    expect(state.recentSessions).toEqual([]);
  });

  // Global-based lexicon/spellcheck persistence tests removed (legacy global persistence deleted)

  it("loads an existing session instead of overwriting it when transcript ref matches", async () => {
    const transcriptRef = makeRef("transcript-a");
    const sessionKey = buildSessionKey(null, transcriptRef);
    const sessions = {
      [sessionKey]: {
        audioRef: null,
        transcriptRef,
        segments: [makeSegment("stored-seg")],
        speakers: [makeSpeaker("stored-speaker")],
        selectedSegmentId: "stored-seg",
        currentTime: 3,
        isWhisperXFormat: true,
        updatedAt: 42,
      },
    };
    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify({ sessions, activeSessionKey: sessionKey }),
    );

    const store = await loadStore();
    store.getState().loadTranscript({
      segments: [makeSegment("incoming-seg")],
      reference: transcriptRef,
      isWhisperXFormat: false,
    });

    const state = store.getState();
    expect(state.segments[0]?.id).toBe("stored-seg");
    expect(state.isWhisperXFormat).toBe(true);
  });

  it("clears transcript state when assigning a new audio reference", async () => {
    const store = await loadStore();
    store.setState({
      transcriptRef: makeRef("transcript-1"),
      segments: [makeSegment("seg-1")],
      speakers: [makeSpeaker("speaker-1")],
      selectedSegmentId: "seg-1",
      currentTime: 1.5,
    });

    const audioRef = makeRef("audio-new");
    store.getState().setAudioReference(audioRef);

    const state = store.getState();
    expect(state.audioRef).toEqual(audioRef);
    expect(state.transcriptRef).toBeNull();
    expect(state.segments).toHaveLength(0);
    expect(state.speakers).toHaveLength(0);
    expect(state.tags).toHaveLength(0);
    expect(state.historyIndex).toBe(-1);
    expect(state.sessionKey).toBe(buildSessionKey(audioRef, null));
  });

  it("repairs invalid session selection when reapplying the same audio reference", async () => {
    const audioRef = makeRef("audio-a");
    const sessionKey = buildSessionKey(audioRef, null);
    const sessions = {
      [sessionKey]: {
        audioRef,
        transcriptRef: null,
        segments: [makeSegment("seg-1")],
        speakers: [makeSpeaker("speaker-1")],
        selectedSegmentId: "missing-seg",
        currentTime: 0,
        isWhisperXFormat: false,
        updatedAt: 1,
      },
    };
    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify({ sessions, activeSessionKey: sessionKey }),
    );

    const store = await loadStore();
    store.getState().setAudioReference(audioRef);

    expect(store.getState().selectedSegmentId).toBe("seg-1");
  });

  it("clears audio only when activating a session with a different audio reference", async () => {
    const audioRefA = makeRef("audio-a");
    const audioRefB = makeRef("audio-b");
    const sessionKeyA = buildSessionKey(audioRefA, null);
    const sessionKeyB = buildSessionKey(audioRefB, null);
    const sessions = {
      [sessionKeyA]: {
        audioRef: audioRefA,
        transcriptRef: null,
        segments: [makeSegment("seg-a")],
        speakers: [makeSpeaker("speaker-a")],
        selectedSegmentId: "seg-a",
        currentTime: 0,
        isWhisperXFormat: false,
        updatedAt: 2,
      },
      [sessionKeyB]: {
        audioRef: audioRefB,
        transcriptRef: null,
        segments: [makeSegment("seg-b")],
        speakers: [makeSpeaker("speaker-b")],
        selectedSegmentId: "seg-b",
        currentTime: 1,
        isWhisperXFormat: false,
        updatedAt: 3,
      },
    };
    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify({ sessions, activeSessionKey: sessionKeyA }),
    );

    const store = await loadStore();
    store.setState({
      audioFile: new File(["data"], "audio-a.mp3", { type: "audio/mpeg" }),
      audioUrl: "blob:audio-a",
    });

    store.getState().activateSession(sessionKeyA);
    expect(store.getState().audioFile).not.toBeNull();

    store.getState().activateSession(sessionKeyB);
    expect(store.getState().audioFile).toBeNull();
    expect(store.getState().audioUrl).toBeNull();
  });

  it("restores chapters, selectedChapterId and currentTime from session cache", async () => {
    const transcriptRef = makeRef("transcript-chapters");
    const sessionKey = buildSessionKey(null, transcriptRef);
    const sessions = {
      [sessionKey]: {
        audioRef: null,
        transcriptRef,
        segments: [makeSegment("stored-seg")],
        speakers: [makeSpeaker("stored-speaker")],
        selectedSegmentId: "stored-seg",
        selectedChapterId: "stored-chapter",
        chapters: [
          {
            id: "stored-chapter",
            title: "Stored",
            startSegmentId: "stored-seg",
            endSegmentId: "stored-seg",
            segmentCount: 1,
            createdAt: 1,
            source: "ai",
          },
        ],
        currentTime: 7,
        isWhisperXFormat: true,
        updatedAt: 42,
      },
    };
    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify({ sessions, activeSessionKey: sessionKey }),
    );

    const store = await loadStore();
    store.getState().loadTranscript({
      segments: [makeSegment("incoming-seg")],
      reference: transcriptRef,
      isWhisperXFormat: false,
    });

    const state = store.getState();
    expect(state.chapters).toHaveLength(1);
    expect(state.chapters[0]?.id).toBe("stored-chapter");
    expect(state.selectedChapterId).toBe("stored-chapter");
    expect(state.currentTime).toBe(7);
  });
});
