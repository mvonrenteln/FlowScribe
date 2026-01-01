import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSessionKey, type FileReference } from "@/lib/fileReference";
import type { Segment, Speaker } from "@/lib/store";

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

  it("normalizes global lexicon and spellcheck settings", async () => {
    window.localStorage.setItem(
      GLOBAL_STORAGE_KEY,
      JSON.stringify({
        lexiconTerms: ["Glymbar", 123],
        spellcheckLanguages: "en,fr",
        spellcheckIgnoreWords: ["  Test  ", "test", "123"],
        spellcheckCustomEnabled: false,
      }),
    );

    const store = await loadStore();
    const state = store.getState();
    expect(state.lexiconEntries).toEqual([
      { term: "Glymbar", variants: [], falsePositives: [] },
      { term: "123", variants: [], falsePositives: [] },
    ]);
    expect(state.lexiconThreshold).toBe(0.82);
    expect(state.spellcheckLanguages).toEqual(["en"]);
    expect(state.spellcheckIgnoreWords).toEqual(["test", "123"]);
  });

  it("prefers custom spellcheck selection over stored languages", async () => {
    window.localStorage.setItem(
      GLOBAL_STORAGE_KEY,
      JSON.stringify({
        spellcheckLanguages: ["en"],
        spellcheckCustomEnabled: true,
      }),
    );

    const store = await loadStore();
    const state = store.getState();
    expect(state.spellcheckCustomEnabled).toBe(true);
    expect(state.spellcheckLanguages).toEqual([]);
  });

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

  it("promotes the current session when assigning a new audio reference", async () => {
    const store = await loadStore();
    store.setState({
      segments: [makeSegment("seg-1")],
      speakers: [makeSpeaker("speaker-1")],
      selectedSegmentId: "seg-1",
      currentTime: 1.5,
    });

    const audioRef = makeRef("audio-new");
    store.getState().setAudioReference(audioRef);

    const state = store.getState();
    expect(state.audioRef).toEqual(audioRef);
    expect(state.segments).toHaveLength(1);
    expect(state.historyIndex).toBe(0);
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

  describe("aiRevisionConfig persistence", () => {
    it("persists aiRevisionConfig changes to localStorage", async () => {
      const store = await loadStore();

      // Add a custom prompt
      store.getState().addRevisionPrompt({
        name: "My Custom Prompt",
        type: "text",
        systemPrompt: "Custom system prompt",
        userPromptTemplate: "Custom user template",
        isBuiltIn: false,
        quickAccess: false,
      });

      // Trigger persistence
      vi.advanceTimersByTime(500);

      // Check localStorage
      const storedGlobal = JSON.parse(window.localStorage.getItem(GLOBAL_STORAGE_KEY) || "{}");
      expect(storedGlobal.aiRevisionConfig).toBeDefined();
      expect(storedGlobal.aiRevisionConfig.prompts).toHaveLength(4); // 3 built-in + 1 custom

      const customPrompt = storedGlobal.aiRevisionConfig.prompts.find(
        (p: { name: string }) => p.name === "My Custom Prompt",
      );
      expect(customPrompt).toBeDefined();
      expect(customPrompt.isBuiltIn).toBe(false);
    });

    it("persists edits to built-in prompts", async () => {
      const store = await loadStore();

      // Edit a built-in prompt
      store.getState().updateRevisionPrompt("builtin-text-cleanup", {
        name: "Custom Cleanup Name",
        systemPrompt: "My custom system prompt for cleanup",
      });

      // Trigger persistence
      vi.advanceTimersByTime(500);

      // Check localStorage
      const storedGlobal = JSON.parse(window.localStorage.getItem(GLOBAL_STORAGE_KEY) || "{}");
      const cleanupPrompt = storedGlobal.aiRevisionConfig.prompts.find(
        (p: { id: string }) => p.id === "builtin-text-cleanup",
      );
      expect(cleanupPrompt.name).toBe("Custom Cleanup Name");
      expect(cleanupPrompt.systemPrompt).toBe("My custom system prompt for cleanup");
    });

    it("restores custom prompts from localStorage on reload", async () => {
      // Pre-populate localStorage with custom config
      const customConfig = {
        prompts: [
          {
            id: "builtin-text-cleanup",
            name: "Transcript Cleanup",
            type: "text",
            systemPrompt: "Default",
            userPromptTemplate: "{{text}}",
            isBuiltIn: true,
            isDefault: true,
            quickAccess: true,
          },
          {
            id: "custom-saved-prompt",
            name: "My Saved Custom Prompt",
            type: "text",
            systemPrompt: "Saved system prompt",
            userPromptTemplate: "Saved user template",
            isBuiltIn: false,
            isDefault: false,
            quickAccess: false,
          },
        ],
        defaultPromptId: "builtin-text-cleanup",
        quickAccessPromptIds: ["builtin-text-cleanup"],
      };

      window.localStorage.setItem(
        GLOBAL_STORAGE_KEY,
        JSON.stringify({ aiRevisionConfig: customConfig }),
      );

      const store = await loadStore();

      const prompts = store.getState().aiRevisionConfig.prompts;
      // Should have 3 built-in + 1 custom = 4 (missing built-ins are added)
      expect(prompts.length).toBeGreaterThanOrEqual(4);

      const customPrompt = prompts.find((p) => p.id === "custom-saved-prompt");
      expect(customPrompt).toBeDefined();
      expect(customPrompt?.name).toBe("My Saved Custom Prompt");
    });

    it("restores edited built-in prompts from localStorage", async () => {
      // Pre-populate localStorage with edited built-in prompt
      const customConfig = {
        prompts: [
          {
            id: "builtin-text-cleanup",
            name: "My Edited Cleanup",
            type: "text",
            systemPrompt: "Completely custom system prompt",
            userPromptTemplate: "Custom template: {{text}}",
            isBuiltIn: true,
            isDefault: true,
            quickAccess: true,
          },
        ],
        defaultPromptId: "builtin-text-cleanup",
        quickAccessPromptIds: ["builtin-text-cleanup"],
      };

      window.localStorage.setItem(
        GLOBAL_STORAGE_KEY,
        JSON.stringify({ aiRevisionConfig: customConfig }),
      );

      const store = await loadStore();

      const cleanupPrompt = store
        .getState()
        .aiRevisionConfig.prompts.find((p) => p.id === "builtin-text-cleanup");
      expect(cleanupPrompt?.name).toBe("My Edited Cleanup");
      expect(cleanupPrompt?.systemPrompt).toBe("Completely custom system prompt");
      expect(cleanupPrompt?.userPromptTemplate).toBe("Custom template: {{text}}");
    });

    it("persists defaultPromptId changes", async () => {
      const store = await loadStore();

      store.getState().setDefaultRevisionPrompt("builtin-text-formalize");
      vi.advanceTimersByTime(500);

      const storedGlobal = JSON.parse(window.localStorage.getItem(GLOBAL_STORAGE_KEY) || "{}");
      expect(storedGlobal.aiRevisionConfig.defaultPromptId).toBe("builtin-text-formalize");
    });

    it("persists quickAccessPromptIds changes", async () => {
      const store = await loadStore();

      store.getState().setQuickAccessPrompts(["builtin-text-formalize"]);
      vi.advanceTimersByTime(500);

      const storedGlobal = JSON.parse(window.localStorage.getItem(GLOBAL_STORAGE_KEY) || "{}");
      expect(storedGlobal.aiRevisionConfig.quickAccessPromptIds).toEqual([
        "builtin-text-formalize",
      ]);
    });

    it("survives page reload with all custom prompts intact", async () => {
      // Simulate first page load - add custom prompts
      let store = await loadStore();

      store.getState().addRevisionPrompt({
        name: "Prompt A",
        type: "text",
        systemPrompt: "System A",
        userPromptTemplate: "Template A",
        isBuiltIn: false,
        quickAccess: true,
      });

      store.getState().addRevisionPrompt({
        name: "Prompt B",
        type: "text",
        systemPrompt: "System B",
        userPromptTemplate: "Template B",
        isBuiltIn: false,
        quickAccess: false,
      });

      // Edit a built-in prompt
      store.getState().updateRevisionPrompt("builtin-text-cleanup", {
        name: "Customized Cleanup",
      });

      // Trigger persistence
      vi.advanceTimersByTime(500);

      // Simulate page reload by reloading the store module
      store = await loadStore();

      const prompts = store.getState().aiRevisionConfig.prompts;

      // Should have 3 built-in + 2 custom = 5
      expect(prompts).toHaveLength(5);

      // Custom prompts should exist
      expect(prompts.find((p) => p.name === "Prompt A")).toBeDefined();
      expect(prompts.find((p) => p.name === "Prompt B")).toBeDefined();

      // Built-in prompt should have custom name
      expect(prompts.find((p) => p.id === "builtin-text-cleanup")?.name).toBe("Customized Cleanup");
    });
  });
});
