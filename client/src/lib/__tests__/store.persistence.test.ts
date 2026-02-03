import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAudioRefKey,
  clearAudioHandleForAudioRef,
  loadAudioHandleForAudioRef,
  saveAudioHandleForAudioRef,
} from "@/lib/audioHandleStorage";
import { buildSessionKey, type FileReference } from "@/lib/fileReference";
import type { Segment, Speaker } from "@/lib/store";

const audioHandleStorageMock = vi.hoisted(() => ({
  mockLoadAudioHandle: vi.fn(),
  mockSaveAudioHandle: vi.fn(),
  mockClearAudioHandle: vi.fn(),
  mockQueryAudioHandlePermission: vi.fn(),
}));

const mockConfirmIfLargeAudio = vi.hoisted(() => vi.fn());

vi.mock("@/lib/audioHandleStorage", () => ({
  buildAudioRefKey: (audioRef: { name: string; size: number; lastModified: number }) =>
    JSON.stringify(audioRef),
  clearAudioHandleForAudioRef: audioHandleStorageMock.mockClearAudioHandle,
  loadAudioHandleForAudioRef: audioHandleStorageMock.mockLoadAudioHandle,
  saveAudioHandleForAudioRef: audioHandleStorageMock.mockSaveAudioHandle,
  queryAudioHandlePermission: audioHandleStorageMock.mockQueryAudioHandlePermission,
  requestAudioHandlePermission: vi.fn(),
}));

vi.mock("@/lib/confirmLargeFile", () => ({
  default: mockConfirmIfLargeAudio,
  confirmIfLargeAudio: mockConfirmIfLargeAudio,
}));

const { mockClearAudioHandle, mockQueryAudioHandlePermission } = audioHandleStorageMock;

const SESSIONS_STORAGE_KEY = "flowscribe:sessions";
const GLOBAL_STORAGE_KEY = "flowscribe:global";

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
  vi.clearAllMocks();
  // Mock confirmIfLargeAudio to always return true (proceed)
  mockConfirmIfLargeAudio.mockReturnValue(true);
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
});

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
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

  it("falls back to most recent session with content when active session is empty on reload", async () => {
    const emptySessionKey = buildSessionKey(makeRef("audio-new"), null);
    const contentSessionKey = buildSessionKey(makeRef("audio-old"), makeRef("transcript-old"));
    const sessions = {
      [emptySessionKey]: {
        audioRef: makeRef("audio-new"),
        transcriptRef: null,
        segments: [],
        speakers: [],
        selectedSegmentId: null,
        currentTime: 0,
        isWhisperXFormat: false,
        updatedAt: 50,
      },
      [contentSessionKey]: {
        audioRef: makeRef("audio-old"),
        transcriptRef: makeRef("transcript-old"),
        segments: [makeSegment("old-seg")],
        speakers: [makeSpeaker("old-speaker")],
        selectedSegmentId: "old-seg",
        currentTime: 5,
        isWhisperXFormat: false,
        updatedAt: 40,
      },
    };
    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify({ sessions, activeSessionKey: emptySessionKey }),
    );

    const store = await loadStore();
    const state = store.getState();
    // Should fall back to the session with content instead of the empty active one
    expect(state.sessionKey).toBe(contentSessionKey);
    expect(state.segments[0]?.id).toBe("old-seg");
  });

  it("keeps empty active session when no other session has content", async () => {
    const emptySessionKey = buildSessionKey(makeRef("audio-new"), null);
    const sessions = {
      [emptySessionKey]: {
        audioRef: makeRef("audio-new"),
        transcriptRef: null,
        segments: [],
        speakers: [],
        selectedSegmentId: null,
        currentTime: 0,
        isWhisperXFormat: false,
        updatedAt: 50,
      },
    };
    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify({ sessions, activeSessionKey: emptySessionKey }),
    );

    const store = await loadStore();
    const state = store.getState();
    // No fallback possible - stays on the empty session
    expect(state.sessionKey).toBe(emptySessionKey);
    expect(state.segments).toHaveLength(0);
  });

  it("flushes current session to localStorage synchronously when switching audio (crash protection)", async () => {
    const audioRef0 = makeRef("audio-0");
    const transcriptRef0 = makeRef("transcript-0");
    const sessionKey0 = buildSessionKey(audioRef0, transcriptRef0);
    const sessions = {
      [sessionKey0]: {
        audioRef: audioRef0,
        transcriptRef: transcriptRef0,
        segments: [makeSegment("seg-0")],
        speakers: [makeSpeaker("speaker-0")],
        selectedSegmentId: "seg-0",
        currentTime: 0,
        isWhisperXFormat: false,
        updatedAt: 1,
      },
    };
    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify({ sessions, activeSessionKey: sessionKey0 }),
    );

    const store = await loadStore();

    // Advance timers to persist initial state
    vi.advanceTimersByTime(600);

    // Load Audio1 (clears segments because audio changed)
    const audioRef1 = makeRef("audio-1");
    store.getState().setAudioReference(audioRef1);

    // Load Transkript1 (adds segments for audio1+transkript1)
    const transcriptRef1 = makeRef("transcript-1");
    store.getState().loadTranscript({
      segments: [makeSegment("seg-1")],
      reference: transcriptRef1,
      isWhisperXFormat: false,
    });

    const sessionKey1 = buildSessionKey(audioRef1, transcriptRef1);
    expect(store.getState().sessionKey).toBe(sessionKey1);
    expect(store.getState().segments[0]?.id).toBe("seg-1");

    // Load Audio2 (simulates loading a large file that will crash the tab)
    // This should trigger a sync flush of audio1+transkript1 to localStorage
    const audioRef2 = makeRef("audio-2");
    store.getState().setAudioReference(audioRef2);

    // DO NOT advance timers - simulates tab crash before throttled persist fires
    const persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
    const persistedSessions = persisted.sessions ?? {};

    // Audio1+Transkript1 must be in localStorage (crash protection via sync flush)
    expect(persistedSessions[sessionKey1]).toBeDefined();
    expect(persistedSessions[sessionKey1].segments[0].id).toBe("seg-1");

    // Audio0+Transkript0 must still be there
    expect(persistedSessions[sessionKey0]).toBeDefined();
    expect(persistedSessions[sessionKey0].segments[0].id).toBe("seg-0");
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
    // Mock loadAudioHandleForAudioRef to return null (no audio handles stored)
    vi.mocked(loadAudioHandleForAudioRef).mockResolvedValue(null);

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

  it("does not modify existing revision entries when loading a new audio (creates new session instead)", async () => {
    const transcriptRef = makeRef("transcript-a");
    const baseKey = buildSessionKey(null, transcriptRef);
    const revisionKey = `${baseKey}|revision:oldrev`;

    const sessions = {
      [baseKey]: {
        audioRef: null,
        transcriptRef,
        segments: [makeSegment("base-seg")],
        speakers: [makeSpeaker("base-speaker")],
        selectedSegmentId: "base-seg",
        currentTime: 3,
        isWhisperXFormat: false,
        updatedAt: 10,
      },
      [revisionKey]: {
        audioRef: null,
        transcriptRef,
        segments: [makeSegment("rev-seg")],
        speakers: [makeSpeaker("rev-speaker")],
        selectedSegmentId: "rev-seg",
        currentTime: 1,
        isWhisperXFormat: false,
        updatedAt: 20,
        kind: "revision",
        baseSessionKey: baseKey,
      },
    };

    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify({ sessions, activeSessionKey: baseKey }),
    );

    const store = await loadStore();

    // Simulate loading a new audio file (different audioRef)
    const newAudioRef = makeRef("audio-new");
    store.getState().setAudioReference(newAudioRef);

    // Advance timers to allow persistence to write to localStorage
    vi.advanceTimersByTime(500);

    const persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
    const persistedSessions = persisted.sessions ?? {};

    // The revision entry must remain untouched
    expect(persistedSessions[revisionKey]).toBeDefined();
    expect(persistedSessions[revisionKey].segments[0].id).toBe("rev-seg");
  });

  it("does not overwrite existing revision entries when reapplying the same audio reference", async () => {
    const audioRef = makeRef("audio-a");
    const sessionKey = buildSessionKey(audioRef, null);
    const revisionKey = `${sessionKey}|revision:oldrev`;

    const sessions = {
      [sessionKey]: {
        audioRef,
        transcriptRef: null,
        segments: [makeSegment("stored-seg")],
        speakers: [makeSpeaker("stored-speaker")],
        selectedSegmentId: "stored-seg",
        currentTime: 0,
        isWhisperXFormat: false,
        updatedAt: 1,
      },
      [revisionKey]: {
        audioRef,
        transcriptRef: null,
        segments: [makeSegment("rev-stored-seg")],
        speakers: [makeSpeaker("rev-stored-speaker")],
        selectedSegmentId: "rev-stored-seg",
        currentTime: 0,
        isWhisperXFormat: false,
        updatedAt: 2,
        kind: "revision",
        baseSessionKey: sessionKey,
      },
    };

    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify({ sessions, activeSessionKey: sessionKey }),
    );

    const store = await loadStore();

    // Re-apply same audioRef
    store.getState().setAudioReference(audioRef);

    vi.advanceTimersByTime(500);

    const persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
    const persistedSessions = persisted.sessions ?? {};

    expect(persistedSessions[revisionKey]).toBeDefined();
    expect(persistedSessions[revisionKey].segments[0].id).toBe("rev-stored-seg");
  });

  it("preserves audioFile set before setAudioReference (no stale clearing)", async () => {
    const transcriptRef = makeRef("transcript-a");
    const audioRef1 = makeRef("audio-1");
    const sessionKey1 = buildSessionKey(audioRef1, transcriptRef);

    const sessions = {
      [sessionKey1]: {
        audioRef: audioRef1,
        transcriptRef,
        segments: [makeSegment("seg-1")],
        speakers: [makeSpeaker("speaker-1")],
        selectedSegmentId: "seg-1",
        currentTime: 0,
        isWhisperXFormat: false,
        updatedAt: 1,
      },
    };

    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify({ sessions, activeSessionKey: sessionKey1 }),
    );

    const store = await loadStore();

    // Set audioFile and audioUrl to simulate a loaded audio
    const mockFile = new File(["data"], "audio-1.mp3", { type: "audio/mpeg" });
    store.setState({
      audioFile: mockFile,
      audioUrl: "blob:audio-1",
    });

    // Now load a different audio reference (simulates user loading new audio)
    const audioRef2 = makeRef("audio-2");
    store.getState().setAudioReference(audioRef2);

    // audioFile/audioUrl should NOT be cleared by setAudioReference
    // (clearing happens in activateSession when switching sessions, not here)
    const state = store.getState();
    expect(state.audioFile).toBe(mockFile);
    expect(state.audioUrl).toBe("blob:audio-1");

    // Advance timers to allow persistence to write
    vi.advanceTimersByTime(500);

    // The original session (session1) should still exist and be intact
    const persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
    const persistedSessions = persisted.sessions ?? {};
    expect(persistedSessions[sessionKey1]).toBeDefined();
    expect(persistedSessions[sessionKey1].segments[0].id).toBe("seg-1");
  });

  it("persists a new session with reused transcript across session switches and reload", async () => {
    vi.mocked(loadAudioHandleForAudioRef).mockResolvedValue(null);

    // Set up 4 existing sessions
    const audioRef1 = makeRef("audio-1");
    const transcriptRef1 = makeRef("transcript-1");
    const sessionKey1 = buildSessionKey(audioRef1, transcriptRef1);

    const audioRef2 = makeRef("audio-2");
    const transcriptRef2 = makeRef("transcript-2");
    const sessionKey2 = buildSessionKey(audioRef2, transcriptRef2);

    const audioRef3 = makeRef("audio-3");
    const transcriptRef3 = makeRef("transcript-3");
    const sessionKey3 = buildSessionKey(audioRef3, transcriptRef3);

    const audioRef4 = makeRef("audio-4");
    const transcriptRef4 = makeRef("transcript-4");
    const sessionKey4 = buildSessionKey(audioRef4, transcriptRef4);

    const sessions = {
      [sessionKey1]: {
        audioRef: audioRef1,
        transcriptRef: transcriptRef1,
        segments: [makeSegment("seg-1")],
        speakers: [makeSpeaker("speaker-1")],
        selectedSegmentId: "seg-1",
        currentTime: 0,
        isWhisperXFormat: false,
        updatedAt: 10,
      },
      [sessionKey2]: {
        audioRef: audioRef2,
        transcriptRef: transcriptRef2,
        segments: [makeSegment("seg-2")],
        speakers: [makeSpeaker("speaker-2")],
        selectedSegmentId: "seg-2",
        currentTime: 0,
        isWhisperXFormat: false,
        updatedAt: 20,
      },
      [sessionKey3]: {
        audioRef: audioRef3,
        transcriptRef: transcriptRef3,
        segments: [makeSegment("seg-3")],
        speakers: [makeSpeaker("speaker-3")],
        selectedSegmentId: "seg-3",
        currentTime: 0,
        isWhisperXFormat: false,
        updatedAt: 30,
      },
      [sessionKey4]: {
        audioRef: audioRef4,
        transcriptRef: transcriptRef4,
        segments: [makeSegment("seg-4")],
        speakers: [makeSpeaker("speaker-4")],
        selectedSegmentId: "seg-4",
        currentTime: 0,
        isWhisperXFormat: false,
        updatedAt: 40,
      },
    };

    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify({ sessions, activeSessionKey: sessionKey4 }),
    );

    const store = await loadStore();

    // Let initial state persist
    vi.advanceTimersByTime(600);

    // Load Audio5
    const audioRef5 = makeRef("audio-5");
    store.getState().setAudioReference(audioRef5);

    // Load Transkript4 (reusing the same transcript reference as session 4)
    store.getState().loadTranscript({
      segments: [makeSegment("seg-5")],
      reference: transcriptRef4,
      isWhisperXFormat: false,
    });

    const sessionKey5 = buildSessionKey(audioRef5, transcriptRef4);
    expect(store.getState().sessionKey).toBe(sessionKey5);
    expect(store.getState().segments[0]?.id).toBe("seg-5");

    // Let persist fire
    vi.advanceTimersByTime(600);

    // Verify Session 5 is in localStorage after initial persist
    let persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
    expect(persisted.sessions?.[sessionKey5]).toBeDefined();
    expect(persisted.sessions[sessionKey5].segments[0].id).toBe("seg-5");

    // Switch to Session 1
    store.getState().activateSession(sessionKey1);
    await vi.advanceTimersByTimeAsync(600);

    // Switch to Session 3
    store.getState().activateSession(sessionKey3);
    await vi.advanceTimersByTimeAsync(600);

    // Switch back to Session 5
    store.getState().activateSession(sessionKey5);
    await vi.advanceTimersByTimeAsync(600);

    // Session 5 must still be in localStorage after switching
    persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
    expect(persisted.sessions?.[sessionKey5]).toBeDefined();
    expect(persisted.sessions[sessionKey5].segments[0].id).toBe("seg-5");

    // All original sessions must also still exist
    expect(persisted.sessions?.[sessionKey1]).toBeDefined();
    expect(persisted.sessions?.[sessionKey2]).toBeDefined();
    expect(persisted.sessions?.[sessionKey3]).toBeDefined();
    expect(persisted.sessions?.[sessionKey4]).toBeDefined();

    // Simulate page reload
    const store2 = await loadStore();
    const recentSessions = store2.getState().recentSessions;

    // Session 5 must be in recent sessions after reload
    const session5InRecent = recentSessions.find((s) => s.key === sessionKey5);
    expect(session5InRecent).toBeDefined();
  });

  describe("Audio Handle Isolation", () => {
    it("stores and retrieves audio handles separately per audio file", async () => {
      const audioRefA = makeRef("audio-a.mp3");
      const audioRefB = makeRef("audio-b.mp3");
      const audioRefKeyA = buildAudioRefKey(audioRefA);
      const audioRefKeyB = buildAudioRefKey(audioRefB);

      const handleA = {
        getFile: vi.fn().mockResolvedValue(new File(["audio-a"], "audio-a.mp3")),
      } as unknown as FileSystemFileHandle;
      const handleB = {
        getFile: vi.fn().mockResolvedValue(new File(["audio-b"], "audio-b.mp3")),
      } as unknown as FileSystemFileHandle;

      // Mock the storage functions
      const handleStorage = new Map<string, FileSystemFileHandle>();
      vi.mocked(saveAudioHandleForAudioRef).mockImplementation(async (key, handle) => {
        handleStorage.set(key, handle);
      });
      vi.mocked(loadAudioHandleForAudioRef).mockImplementation(async (key) => {
        return handleStorage.get(key) ?? null;
      });

      // Save handles for both audio files
      await saveAudioHandleForAudioRef(audioRefKeyA, handleA);
      await saveAudioHandleForAudioRef(audioRefKeyB, handleB);

      // Verify handles are stored separately per audio file
      const loadedHandleA = await loadAudioHandleForAudioRef(audioRefKeyA);
      const loadedHandleB = await loadAudioHandleForAudioRef(audioRefKeyB);

      expect(loadedHandleA).toBe(handleA);
      expect(loadedHandleB).toBe(handleB);
    });

    it("clearing audio handle for one audio file does not affect other audio files", async () => {
      const audioRefA = makeRef("audio-a.mp3");
      const audioRefB = makeRef("audio-b.mp3");
      const audioRefKeyA = buildAudioRefKey(audioRefA);
      const audioRefKeyB = buildAudioRefKey(audioRefB);

      const handleA = {
        getFile: vi.fn().mockResolvedValue(new File(["audio-a"], "audio-a.mp3")),
      } as unknown as FileSystemFileHandle;
      const handleB = {
        getFile: vi.fn().mockResolvedValue(new File(["audio-b"], "audio-b.mp3")),
      } as unknown as FileSystemFileHandle;

      // Mock the storage functions
      const handleStorage = new Map<string, FileSystemFileHandle>();
      vi.mocked(saveAudioHandleForAudioRef).mockImplementation(async (key, handle) => {
        handleStorage.set(key, handle);
      });
      vi.mocked(loadAudioHandleForAudioRef).mockImplementation(async (key) => {
        return handleStorage.get(key) ?? null;
      });
      vi.mocked(clearAudioHandleForAudioRef).mockImplementation(async (key) => {
        handleStorage.delete(key);
      });

      // Save handles for both audio files
      await saveAudioHandleForAudioRef(audioRefKeyA, handleA);
      await saveAudioHandleForAudioRef(audioRefKeyB, handleB);

      // Clear handle for audio B
      await clearAudioHandleForAudioRef(audioRefKeyB);

      // Verify audio A's handle remains intact
      const loadedHandleA = await loadAudioHandleForAudioRef(audioRefKeyA);
      const loadedHandleB = await loadAudioHandleForAudioRef(audioRefKeyB);

      expect(loadedHandleA).toBe(handleA);
      expect(loadedHandleB).toBeNull();
    });

    it("declining large file load for one audio file does not affect other audio files", async () => {
      const audioRefA = makeRef("audio-a.mp3");
      const audioRefB = makeRef("audio-b-large.wav");
      const audioRefKeyA = buildAudioRefKey(audioRefA);
      const audioRefKeyB = buildAudioRefKey(audioRefB);

      const handleA = {
        getFile: vi.fn().mockResolvedValue(new File(["audio-a"], "audio-a.mp3")),
      } as unknown as FileSystemFileHandle;
      const handleB = {
        getFile: vi.fn().mockResolvedValue(new File(["audio-b"], "audio-b-large.wav")),
      } as unknown as FileSystemFileHandle;

      // Mock the storage functions
      const handleStorage = new Map<string, FileSystemFileHandle>([
        [audioRefKeyA, handleA],
        [audioRefKeyB, handleB],
      ]);
      vi.mocked(saveAudioHandleForAudioRef).mockImplementation(async (key, handle) => {
        handleStorage.set(key, handle);
      });
      vi.mocked(loadAudioHandleForAudioRef).mockImplementation(async (key) => {
        return handleStorage.get(key) ?? null;
      });
      vi.mocked(clearAudioHandleForAudioRef).mockImplementation(async (key) => {
        handleStorage.delete(key);
      });

      // Simulate clearing audio B's handle after user declines
      await clearAudioHandleForAudioRef(audioRefKeyB);

      // Verify audio A's handle is still available
      const loadedHandleA = await loadAudioHandleForAudioRef(audioRefKeyA);
      expect(loadedHandleA).toBe(handleA);
    });
  });

  describe("Session Activation Audio Restore", () => {
    it("does not attempt to restore audio when activating session with same audio reference", async () => {
      // Mock loadAudioHandleForAudioRef to return null (no restore needed)
      vi.mocked(loadAudioHandleForAudioRef).mockResolvedValue(null);

      const audioRef = makeRef("audio-a");
      const sessionKey = buildSessionKey(audioRef, makeRef("transcript-a"));
      const sessions = {
        [sessionKey]: {
          audioRef,
          transcriptRef: makeRef("transcript-a"),
          segments: [makeSegment("seg-a")],
          speakers: [makeSpeaker("speaker-a")],
          selectedSegmentId: "seg-a",
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

      // Set current audio file to simulate already loaded audio
      const mockFile = new File(["data"], "audio-a.mp3", { type: "audio/mpeg" });
      store.setState({ audioFile: mockFile, audioUrl: "blob:audio-a" });

      // Clear the mock call count
      vi.clearAllMocks();

      // Activate the same session
      store.getState().activateSession(sessionKey);

      // Should not clear audio or attempt to restore since audio ref is the same
      expect(store.getState().audioFile).toBe(mockFile);
      expect(store.getState().audioUrl).toBe("blob:audio-a");

      // Wait a bit to ensure no async audio restore was triggered
      await vi.advanceTimersByTimeAsync(100);

      expect(vi.mocked(loadAudioHandleForAudioRef)).not.toHaveBeenCalled();
    });

    it("attempts to restore audio when activating session with different audio reference", async () => {
      const audioRefA = makeRef("audio-a");
      const audioRefB = makeRef("audio-b");
      const audioRefKeyB = buildAudioRefKey(audioRefB);
      const sessionKeyA = buildSessionKey(audioRefA, null);
      const sessionKeyB = buildSessionKey(audioRefB, null);

      const handleB = {
        getFile: vi.fn().mockResolvedValue(new File(["audio-b"], "audio-b.mp3")),
        queryPermission: vi.fn().mockResolvedValue("granted"),
      } as unknown as FileSystemFileHandle;

      // Mock loadAudioHandleForAudioRef to return handleB for audioRefB
      vi.mocked(loadAudioHandleForAudioRef).mockImplementation(async (key) => {
        if (key === audioRefKeyB) return handleB;
        return null;
      });

      const sessions = {
        [sessionKeyA]: {
          audioRef: audioRefA,
          transcriptRef: null,
          segments: [makeSegment("seg-a")],
          speakers: [makeSpeaker("speaker-a")],
          selectedSegmentId: "seg-a",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 1,
        },
        [sessionKeyB]: {
          audioRef: audioRefB,
          transcriptRef: null,
          segments: [makeSegment("seg-b")],
          speakers: [makeSpeaker("speaker-b")],
          selectedSegmentId: "seg-b",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 2,
        },
      };

      window.localStorage.setItem(
        SESSIONS_STORAGE_KEY,
        JSON.stringify({ sessions, activeSessionKey: sessionKeyA }),
      );

      const store = await loadStore();

      // Set audio file for session A
      const mockFileA = new File(["data-a"], "audio-a.mp3", { type: "audio/mpeg" });
      store.setState({ audioFile: mockFileA, audioUrl: "blob:audio-a" });

      // Activate session B (different audio)
      store.getState().activateSession(sessionKeyB);

      // Should clear audio immediately
      expect(store.getState().audioFile).toBeNull();
      expect(store.getState().audioUrl).toBeNull();

      // Should attempt to restore audio handle for audio B
      await vi.advanceTimersByTimeAsync(100);

      expect(vi.mocked(loadAudioHandleForAudioRef)).toHaveBeenCalledWith(audioRefKeyB);
    });

    it("does not restore audio when permission is denied during session activation", async () => {
      const audioRefA = makeRef("audio-a");
      const audioRefB = makeRef("audio-b");
      const audioRefKeyB = buildAudioRefKey(audioRefB);
      const sessionKeyA = buildSessionKey(audioRefA, null);
      const sessionKeyB = buildSessionKey(audioRefB, null);

      const handleB = {
        getFile: vi.fn().mockResolvedValue(new File(["audio-b"], "audio-b.mp3")),
      } as unknown as FileSystemFileHandle;

      vi.mocked(loadAudioHandleForAudioRef).mockImplementation(async (key) => {
        if (key === audioRefKeyB) return handleB;
        return null;
      });
      mockQueryAudioHandlePermission.mockResolvedValue(false);

      const sessions = {
        [sessionKeyA]: {
          audioRef: audioRefA,
          transcriptRef: null,
          segments: [makeSegment("seg-a")],
          speakers: [makeSpeaker("speaker-a")],
          selectedSegmentId: "seg-a",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 1,
        },
        [sessionKeyB]: {
          audioRef: audioRefB,
          transcriptRef: null,
          segments: [makeSegment("seg-b")],
          speakers: [makeSpeaker("speaker-b")],
          selectedSegmentId: "seg-b",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 2,
        },
      };

      window.localStorage.setItem(
        SESSIONS_STORAGE_KEY,
        JSON.stringify({ sessions, activeSessionKey: sessionKeyA }),
      );

      const store = await loadStore();
      store.setState({
        audioFile: new File(["data-a"], "audio-a.mp3", { type: "audio/mpeg" }),
        audioUrl: "blob:audio-a",
      });

      store.getState().activateSession(sessionKeyB);
      await vi.advanceTimersByTimeAsync(100);

      // Permission denied: audio should not be restored
      expect(store.getState().audioFile).toBeNull();
      expect(store.getState().audioUrl).toBeNull();
      expect(handleB.getFile).not.toHaveBeenCalled();
    });

    it("clears handle when user declines large file during session activation", async () => {
      const audioRefA = makeRef("audio-a");
      const audioRefB = makeRef("audio-b");
      const audioRefKeyB = buildAudioRefKey(audioRefB);
      const sessionKeyA = buildSessionKey(audioRefA, null);
      const sessionKeyB = buildSessionKey(audioRefB, null);

      const handleB = {
        getFile: vi.fn().mockResolvedValue(new File(["audio-b"], "audio-b.mp3")),
      } as unknown as FileSystemFileHandle;

      vi.mocked(loadAudioHandleForAudioRef).mockImplementation(async (key) => {
        if (key === audioRefKeyB) return handleB;
        return null;
      });
      mockQueryAudioHandlePermission.mockResolvedValue(true);
      mockConfirmIfLargeAudio.mockReturnValue(false);

      const sessions = {
        [sessionKeyA]: {
          audioRef: audioRefA,
          transcriptRef: null,
          segments: [makeSegment("seg-a")],
          speakers: [makeSpeaker("speaker-a")],
          selectedSegmentId: "seg-a",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 1,
        },
        [sessionKeyB]: {
          audioRef: audioRefB,
          transcriptRef: null,
          segments: [makeSegment("seg-b")],
          speakers: [makeSpeaker("speaker-b")],
          selectedSegmentId: "seg-b",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 2,
        },
      };

      window.localStorage.setItem(
        SESSIONS_STORAGE_KEY,
        JSON.stringify({ sessions, activeSessionKey: sessionKeyA }),
      );

      const store = await loadStore();
      store.setState({
        audioFile: new File(["data-a"], "audio-a.mp3", { type: "audio/mpeg" }),
        audioUrl: "blob:audio-a",
      });

      store.getState().activateSession(sessionKeyB);
      await vi.advanceTimersByTimeAsync(100);

      // User declined: handle should be cleared, audio not loaded
      expect(mockClearAudioHandle).toHaveBeenCalledWith(audioRefKeyB);
      expect(store.getState().audioFile).toBeNull();
      expect(store.getState().audioUrl).toBeNull();
    });

    it("both sessions intact in localStorage after activation + reload (S6)", async () => {
      vi.mocked(loadAudioHandleForAudioRef).mockResolvedValue(null);

      const audioRefA = makeRef("audio-a");
      const transcriptRefA = makeRef("transcript-a");
      const sessionKeyA = buildSessionKey(audioRefA, transcriptRefA);
      const audioRefB = makeRef("audio-b");
      const transcriptRefB = makeRef("transcript-b");
      const sessionKeyB = buildSessionKey(audioRefB, transcriptRefB);
      const sessions = {
        [sessionKeyA]: {
          audioRef: audioRefA,
          transcriptRef: transcriptRefA,
          segments: [makeSegment("seg-a")],
          speakers: [makeSpeaker("speaker-a")],
          selectedSegmentId: "seg-a",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 10,
        },
        [sessionKeyB]: {
          audioRef: audioRefB,
          transcriptRef: transcriptRefB,
          segments: [makeSegment("seg-b")],
          speakers: [makeSpeaker("speaker-b")],
          selectedSegmentId: "seg-b",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 20,
        },
      };
      window.localStorage.setItem(
        SESSIONS_STORAGE_KEY,
        JSON.stringify({ sessions, activeSessionKey: sessionKeyA }),
      );

      const store = await loadStore();
      vi.advanceTimersByTime(600);

      store.getState().activateSession(sessionKeyB);
      await vi.advanceTimersByTimeAsync(600);

      // Simulate beforeunload
      window.dispatchEvent(new Event("beforeunload"));

      // Reload
      const store2 = await loadStore();
      const persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
      expect(persisted.sessions?.[sessionKeyA]).toBeDefined();
      expect(persisted.sessions?.[sessionKeyA].segments[0].id).toBe("seg-a");
      expect(persisted.sessions?.[sessionKeyB]).toBeDefined();
      expect(persisted.sessions?.[sessionKeyB].segments[0].id).toBe("seg-b");
      expect(store2.getState().recentSessions).toHaveLength(2);
    });
  });

  describe("readSessionsState fallback boundaries", () => {
    it("does NOT fallback when active session has segments but no transcriptRef (R5)", async () => {
      const activeKey = buildSessionKey(makeRef("audio-a"), null);
      const otherKey = buildSessionKey(makeRef("audio-b"), makeRef("transcript-b"));
      const sessions = {
        [activeKey]: {
          audioRef: makeRef("audio-a"),
          transcriptRef: null,
          segments: [makeSegment("seg-a")],
          speakers: [makeSpeaker("speaker-a")],
          selectedSegmentId: "seg-a",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 50,
        },
        [otherKey]: {
          audioRef: makeRef("audio-b"),
          transcriptRef: makeRef("transcript-b"),
          segments: [makeSegment("seg-b")],
          speakers: [makeSpeaker("speaker-b")],
          selectedSegmentId: "seg-b",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 40,
        },
      };
      window.localStorage.setItem(
        SESSIONS_STORAGE_KEY,
        JSON.stringify({ sessions, activeSessionKey: activeKey }),
      );

      const store = await loadStore();
      expect(store.getState().sessionKey).toBe(activeKey);
      expect(store.getState().segments[0]?.id).toBe("seg-a");
    });

    it("does NOT fallback when active session has transcriptRef but no segments (R6)", async () => {
      const activeKey = buildSessionKey(makeRef("audio-a"), makeRef("transcript-a"));
      const otherKey = buildSessionKey(makeRef("audio-b"), makeRef("transcript-b"));
      const sessions = {
        [activeKey]: {
          audioRef: makeRef("audio-a"),
          transcriptRef: makeRef("transcript-a"),
          segments: [],
          speakers: [],
          selectedSegmentId: null,
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 50,
        },
        [otherKey]: {
          audioRef: makeRef("audio-b"),
          transcriptRef: makeRef("transcript-b"),
          segments: [makeSegment("seg-b")],
          speakers: [makeSpeaker("speaker-b")],
          selectedSegmentId: "seg-b",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 40,
        },
      };
      window.localStorage.setItem(
        SESSIONS_STORAGE_KEY,
        JSON.stringify({ sessions, activeSessionKey: activeKey }),
      );

      // readSessionsState fallback checks: segments=0 AND !transcriptRef
      // Here transcriptRef IS set, so no fallback should occur
      const store = await loadStore();
      expect(store.getState().sessionKey).toBe(activeKey);
    });

    it("does NOT fallback when active session has both segments and transcriptRef (R7)", async () => {
      const activeKey = buildSessionKey(makeRef("audio-a"), makeRef("transcript-a"));
      const otherKey = buildSessionKey(makeRef("audio-b"), makeRef("transcript-b"));
      const sessions = {
        [activeKey]: {
          audioRef: makeRef("audio-a"),
          transcriptRef: makeRef("transcript-a"),
          segments: [makeSegment("seg-a")],
          speakers: [makeSpeaker("speaker-a")],
          selectedSegmentId: "seg-a",
          currentTime: 5,
          isWhisperXFormat: false,
          updatedAt: 50,
        },
        [otherKey]: {
          audioRef: makeRef("audio-b"),
          transcriptRef: makeRef("transcript-b"),
          segments: [makeSegment("seg-b")],
          speakers: [makeSpeaker("speaker-b")],
          selectedSegmentId: "seg-b",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 60,
        },
      };
      window.localStorage.setItem(
        SESSIONS_STORAGE_KEY,
        JSON.stringify({ sessions, activeSessionKey: activeKey }),
      );

      const store = await loadStore();
      expect(store.getState().sessionKey).toBe(activeKey);
      expect(store.getState().segments[0]?.id).toBe("seg-a");
    });
  });

  describe("Subscription → Cache → localStorage roundtrip", () => {
    it("persists session after text edit + throttle wait (W1)", async () => {
      const audioRef = makeRef("audio-w1");
      const transcriptRef = makeRef("transcript-w1");
      const sessionKey = buildSessionKey(audioRef, transcriptRef);
      const sessions = {
        [sessionKey]: {
          audioRef,
          transcriptRef,
          segments: [makeSegment("seg-w1")],
          speakers: [makeSpeaker("speaker-w1")],
          selectedSegmentId: "seg-w1",
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
      vi.advanceTimersByTime(600);

      store.getState().updateSegmentText("seg-w1", "edited text");
      vi.advanceTimersByTime(600);

      const persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
      expect(persisted.sessions?.[sessionKey].segments[0].text).toBe("edited text");
    });

    it("persists session after text edit via beforeunload without throttle wait (W2)", async () => {
      const audioRef = makeRef("audio-w2");
      const transcriptRef = makeRef("transcript-w2");
      const sessionKey = buildSessionKey(audioRef, transcriptRef);
      const sessions = {
        [sessionKey]: {
          audioRef,
          transcriptRef,
          segments: [makeSegment("seg-w2")],
          speakers: [makeSpeaker("speaker-w2")],
          selectedSegmentId: "seg-w2",
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
      vi.advanceTimersByTime(600);

      store.getState().updateSegmentText("seg-w2", "edited before unload");

      // Do NOT advance timers — fire beforeunload immediately
      window.dispatchEvent(new Event("beforeunload"));

      const persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
      expect(persisted.sessions?.[sessionKey].segments[0].text).toBe("edited before unload");
    });

    it("preserves both sessions after session switch + beforeunload (W3)", async () => {
      vi.mocked(loadAudioHandleForAudioRef).mockResolvedValue(null);

      const audioRefA = makeRef("audio-w3a");
      const transcriptRefA = makeRef("transcript-w3a");
      const sessionKeyA = buildSessionKey(audioRefA, transcriptRefA);
      const audioRefB = makeRef("audio-w3b");
      const transcriptRefB = makeRef("transcript-w3b");
      const sessionKeyB = buildSessionKey(audioRefB, transcriptRefB);

      const sessions = {
        [sessionKeyA]: {
          audioRef: audioRefA,
          transcriptRef: transcriptRefA,
          segments: [makeSegment("seg-a")],
          speakers: [makeSpeaker("speaker-a")],
          selectedSegmentId: "seg-a",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 10,
        },
        [sessionKeyB]: {
          audioRef: audioRefB,
          transcriptRef: transcriptRefB,
          segments: [makeSegment("seg-b")],
          speakers: [makeSpeaker("speaker-b")],
          selectedSegmentId: "seg-b",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 20,
        },
      };
      window.localStorage.setItem(
        SESSIONS_STORAGE_KEY,
        JSON.stringify({ sessions, activeSessionKey: sessionKeyA }),
      );

      const store = await loadStore();
      vi.advanceTimersByTime(600);

      // Edit session A
      store.getState().updateSegmentText("seg-a", "edited-a");

      // Switch to session B
      store.getState().activateSession(sessionKeyB);
      await vi.advanceTimersByTimeAsync(100);

      // Fire beforeunload immediately
      window.dispatchEvent(new Event("beforeunload"));

      const persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
      expect(persisted.sessions?.[sessionKeyA]).toBeDefined();
      expect(persisted.sessions?.[sessionKeyA].segments[0].text).toBe("edited-a");
      expect(persisted.sessions?.[sessionKeyB]).toBeDefined();
      expect(persisted.sessions?.[sessionKeyB].segments[0].id).toBe("seg-b");
    });

    it("persists newly created session (audio + transcript) via beforeunload (W4)", async () => {
      const store = await loadStore();
      vi.advanceTimersByTime(600);

      const audioRef = makeRef("audio-w4");
      store.getState().setAudioReference(audioRef);

      const transcriptRef = makeRef("transcript-w4");
      store.getState().loadTranscript({
        segments: [makeSegment("seg-w4")],
        reference: transcriptRef,
        isWhisperXFormat: false,
      });

      const sessionKey = buildSessionKey(audioRef, transcriptRef);
      expect(store.getState().sessionKey).toBe(sessionKey);

      // Immediately fire beforeunload without waiting for throttle
      window.dispatchEvent(new Event("beforeunload"));

      const persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
      expect(persisted.sessions?.[sessionKey]).toBeDefined();
      expect(persisted.sessions?.[sessionKey].segments[0].id).toBe("seg-w4");
    });

    it("does not lose session during rapid session switching (W6)", async () => {
      vi.mocked(loadAudioHandleForAudioRef).mockResolvedValue(null);

      const refs = Array.from({ length: 4 }, (_, i) => ({
        audioRef: makeRef(`audio-${i}`),
        transcriptRef: makeRef(`transcript-${i}`),
      }));
      const sessionKeys = refs.map((r) => buildSessionKey(r.audioRef, r.transcriptRef));
      const sessions = Object.fromEntries(
        refs.map((r, i) => [
          sessionKeys[i],
          {
            audioRef: r.audioRef,
            transcriptRef: r.transcriptRef,
            segments: [makeSegment(`seg-${i}`)],
            speakers: [makeSpeaker(`speaker-${i}`)],
            selectedSegmentId: `seg-${i}`,
            currentTime: 0,
            isWhisperXFormat: false,
            updatedAt: (i + 1) * 10,
          },
        ]),
      );
      window.localStorage.setItem(
        SESSIONS_STORAGE_KEY,
        JSON.stringify({ sessions, activeSessionKey: sessionKeys[0] }),
      );

      const store = await loadStore();
      vi.advanceTimersByTime(600);

      // Rapid switching
      store.getState().activateSession(sessionKeys[1]);
      store.getState().activateSession(sessionKeys[2]);
      store.getState().activateSession(sessionKeys[3]);
      store.getState().activateSession(sessionKeys[0]);

      // beforeunload
      window.dispatchEvent(new Event("beforeunload"));

      const persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
      for (let i = 0; i < 4; i++) {
        expect(persisted.sessions?.[sessionKeys[i]]).toBeDefined();
        expect(persisted.sessions[sessionKeys[i]].segments[0].id).toBe(`seg-${i}`);
      }
    });

    it("beforeunload writes newer data than pending worker response (W7)", async () => {
      const audioRef = makeRef("audio-w7");
      const transcriptRef = makeRef("transcript-w7");
      const sessionKey = buildSessionKey(audioRef, transcriptRef);
      const sessions = {
        [sessionKey]: {
          audioRef,
          transcriptRef,
          segments: [makeSegment("seg-w7")],
          speakers: [makeSpeaker("speaker-w7")],
          selectedSegmentId: "seg-w7",
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
      vi.advanceTimersByTime(600);

      // First edit triggers throttled persist
      store.getState().updateSegmentText("seg-w7", "old edit");
      // Don't let throttle fire yet

      // Second edit — more recent
      store.getState().updateSegmentText("seg-w7", "new edit");

      // beforeunload fires before throttle completes
      window.dispatchEvent(new Event("beforeunload"));

      const persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
      expect(persisted.sessions?.[sessionKey].segments[0].text).toBe("new edit");
    });
  });

  describe("setAudioReference persistence", () => {
    it("does NOT set activeSessionKey for empty intermediate session (A6)", async () => {
      const audioRefOld = makeRef("audio-old");
      const transcriptRefOld = makeRef("transcript-old");
      const sessionKeyOld = buildSessionKey(audioRefOld, transcriptRefOld);
      const sessions = {
        [sessionKeyOld]: {
          audioRef: audioRefOld,
          transcriptRef: transcriptRefOld,
          segments: [makeSegment("seg-old")],
          speakers: [makeSpeaker("speaker-old")],
          selectedSegmentId: "seg-old",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 10,
        },
      };
      window.localStorage.setItem(
        SESSIONS_STORAGE_KEY,
        JSON.stringify({ sessions, activeSessionKey: sessionKeyOld }),
      );

      const store = await loadStore();
      vi.advanceTimersByTime(600);

      // Switch to new audio — creates empty intermediate session
      const audioRefNew = makeRef("audio-new");
      store.getState().setAudioReference(audioRefNew);

      // beforeunload now
      window.dispatchEvent(new Event("beforeunload"));

      const persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
      // activeSessionKey should still point to the old session, not the empty intermediate
      expect(persisted.activeSessionKey).toBe(sessionKeyOld);

      // Reload: should restore the old session with data
      const store2 = await loadStore();
      expect(store2.getState().segments[0]?.id).toBe("seg-old");
    });

    it("old session remains in recentSessions after audio switch (A7)", async () => {
      const audioRefOld = makeRef("audio-old");
      const transcriptRefOld = makeRef("transcript-old");
      const sessionKeyOld = buildSessionKey(audioRefOld, transcriptRefOld);
      const sessions = {
        [sessionKeyOld]: {
          audioRef: audioRefOld,
          transcriptRef: transcriptRefOld,
          segments: [makeSegment("seg-old")],
          speakers: [makeSpeaker("speaker-old")],
          selectedSegmentId: "seg-old",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 10,
        },
      };
      window.localStorage.setItem(
        SESSIONS_STORAGE_KEY,
        JSON.stringify({ sessions, activeSessionKey: sessionKeyOld }),
      );

      const store = await loadStore();
      vi.advanceTimersByTime(600);

      // Switch audio
      const audioRefNew = makeRef("audio-new");
      store.getState().setAudioReference(audioRefNew);
      vi.advanceTimersByTime(600);

      // Old session must remain in recentSessions
      const recent = store.getState().recentSessions;
      expect(recent.some((s) => s.key === sessionKeyOld)).toBe(true);
    });
  });

  describe("loadTranscript persistence", () => {
    it("newly loaded transcript visible in recentSessions after persist (L4)", async () => {
      const store = await loadStore();
      vi.advanceTimersByTime(600);

      const audioRef = makeRef("audio-l4");
      store.getState().setAudioReference(audioRef);

      const transcriptRef = makeRef("transcript-l4");
      store.getState().loadTranscript({
        segments: [makeSegment("seg-l4")],
        reference: transcriptRef,
        isWhisperXFormat: false,
      });

      vi.advanceTimersByTime(600);

      const sessionKey = buildSessionKey(audioRef, transcriptRef);
      const recent = store.getState().recentSessions;
      expect(recent.some((s) => s.key === sessionKey)).toBe(true);
    });
  });

  describe("Ghost session cleanup", () => {
    it("empty intermediate sessions do not appear in recentSessions (G1)", async () => {
      const audioRefA = makeRef("audio-a");
      const transcriptRefA = makeRef("transcript-a");
      const sessionKeyA = buildSessionKey(audioRefA, transcriptRefA);
      const sessions = {
        [sessionKeyA]: {
          audioRef: audioRefA,
          transcriptRef: transcriptRefA,
          segments: [makeSegment("seg-a")],
          speakers: [makeSpeaker("speaker-a")],
          selectedSegmentId: "seg-a",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 10,
        },
      };
      window.localStorage.setItem(
        SESSIONS_STORAGE_KEY,
        JSON.stringify({ sessions, activeSessionKey: sessionKeyA }),
      );

      const store = await loadStore();
      vi.advanceTimersByTime(600);

      // Create empty intermediate session by switching audio
      store.getState().setAudioReference(makeRef("audio-ghost"));
      vi.advanceTimersByTime(600);

      const recent = store.getState().recentSessions;
      // Ghost session (no segments, no transcript) must not appear
      const ghostKey = buildSessionKey(makeRef("audio-ghost"), null);
      expect(recent.some((s) => s.key === ghostKey)).toBe(false);
      // Original must still be there
      expect(recent.some((s) => s.key === sessionKeyA)).toBe(true);
    });

    it("empty sessions are cleaned from localStorage on next persist (G2)", async () => {
      const audioRefA = makeRef("audio-a");
      const transcriptRefA = makeRef("transcript-a");
      const sessionKeyA = buildSessionKey(audioRefA, transcriptRefA);
      // Pre-seed with a ghost session
      const ghostKey = buildSessionKey(makeRef("audio-ghost"), null);
      const sessions = {
        [sessionKeyA]: {
          audioRef: audioRefA,
          transcriptRef: transcriptRefA,
          segments: [makeSegment("seg-a")],
          speakers: [makeSpeaker("speaker-a")],
          selectedSegmentId: "seg-a",
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 10,
        },
        [ghostKey]: {
          audioRef: makeRef("audio-ghost"),
          transcriptRef: null,
          segments: [],
          speakers: [],
          selectedSegmentId: null,
          currentTime: 0,
          isWhisperXFormat: false,
          updatedAt: 20,
        },
      };
      window.localStorage.setItem(
        SESSIONS_STORAGE_KEY,
        JSON.stringify({ sessions, activeSessionKey: sessionKeyA }),
      );

      const store = await loadStore();
      // Trigger a persist by making any change
      store.getState().updateSegmentText("seg-a", "trigger persist");
      vi.advanceTimersByTime(600);

      window.dispatchEvent(new Event("beforeunload"));

      const persisted = JSON.parse(window.localStorage.getItem(SESSIONS_STORAGE_KEY) || "{}");
      // Ghost session should have been cleaned
      expect(persisted.sessions?.[ghostKey]).toBeUndefined();
      // Real session still present
      expect(persisted.sessions?.[sessionKeyA]).toBeDefined();
    });
  });

  describe("QuotaExceeded handling", () => {
    it("writeSessionsSync returns false on QuotaExceededError (Q1)", async () => {
      // Load the store first so the module is initialized, then get writeSessionsSync
      await loadStore();
      const { writeSessionsSync: writeFn } = await import("@/lib/storage");
      const quotaError = new DOMException("quota exceeded", "QuotaExceededError");
      const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw quotaError;
      });

      const result = writeFn({ sessions: {}, activeSessionKey: null });
      expect(result).toBe(false);

      spy.mockRestore();
    });

    it("dispatches flowscribe:storage-quota-exceeded event on QuotaExceededError (Q2)", async () => {
      await loadStore();
      const { writeSessionsSync: writeFn } = await import("@/lib/storage");
      const quotaError = new DOMException("quota exceeded", "QuotaExceededError");
      const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw quotaError;
      });

      const handler = vi.fn();
      window.addEventListener("flowscribe:storage-quota-exceeded", handler);

      writeFn({ sessions: {}, activeSessionKey: null });
      expect(handler).toHaveBeenCalledTimes(1);

      window.removeEventListener("flowscribe:storage-quota-exceeded", handler);
      spy.mockRestore();
    });

    it("quota error flag is set in store after quota event (Q3)", async () => {
      const store = await loadStore();
      expect(store.getState().quotaErrorShown).toBe(false);

      store.getState().setQuotaErrorShown(true);
      expect(store.getState().quotaErrorShown).toBe(true);
    });
  });

  describe("AI Chapter Detection persistence", () => {
    it("persists chapter detection prompt changes to global storage", async () => {
      const store = await loadStore();
      store.getState().addChapterDetectionPrompt({
        name: "Persisted Chapter Prompt",
        type: "chapter-detect",
        systemPrompt: "Persisted system",
        userPromptTemplate: "Persisted user",
        isBuiltIn: false,
        isDefault: false,
        quickAccess: false,
      });

      vi.runAllTimers();

      const persistedRaw = window.localStorage.getItem(GLOBAL_STORAGE_KEY);
      expect(persistedRaw).toBeTruthy();
      const persisted = JSON.parse(persistedRaw ?? "{}") as {
        aiChapterDetectionConfig?: { prompts?: Array<{ name: string }> };
      };
      expect(
        persisted.aiChapterDetectionConfig?.prompts?.some(
          (prompt) => prompt.name === "Persisted Chapter Prompt",
        ),
      ).toBe(true);
    });
  });
});
