import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIRevisionConfig, AIRevisionSlice, TranscriptStore } from "../../types";
import {
  createAIRevisionSlice,
  DEFAULT_TEXT_PROMPTS,
  initialAIRevisionState,
  normalizeAIRevisionConfig,
} from "../aiRevisionSlice";

// Minimal mock store helpers
const createMockStore = () => {
  let state: Partial<TranscriptStore> = {
    ...initialAIRevisionState,
    segments: [
      { id: "seg-1", speaker: "Speaker 1", start: 0, end: 5, text: "Hello world", words: [] },
      { id: "seg-2", speaker: "Speaker 2", start: 5, end: 10, text: "Test text", words: [] },
    ],
    speakers: [{ id: "s1", name: "Speaker 1", color: "#ff0000" }],
    updateSegmentText: vi.fn(),
    updateSegmentsTexts: vi.fn(),
  };

  const set = (partial: Partial<TranscriptStore> | ((s: TranscriptStore) => Partial<TranscriptStore>)) => {
    if (typeof partial === "function") {
      state = { ...state, ...partial(state as TranscriptStore) };
    } else {
      state = { ...state, ...partial };
    }
  };

  const get = () => state as TranscriptStore;

  return { set, get, getState: () => state };
};

describe("aiRevisionSlice", () => {
  let mockStore: ReturnType<typeof createMockStore>;
  let slice: AIRevisionSlice;

  beforeEach(() => {
    mockStore = createMockStore();
    const { set, get } = mockStore as any;
    slice = createAIRevisionSlice(set, get);
  });

  describe("initialAIRevisionState", () => {
    it("has default templates", () => {
      expect(initialAIRevisionState.aiRevisionConfig.prompts).toHaveLength(3);
    });

    it("has a default template ID set", () => {
      expect(initialAIRevisionState.aiRevisionConfig.defaultPromptId).toBe(
        "builtin-text-cleanup",
      );
    });

    it("is not processing by default", () => {
      expect(initialAIRevisionState.aiRevisionIsProcessing).toBe(false);
    });
  });

  describe("normalizeAIRevisionConfig", () => {
    it("returns defaults when null", () => {
      const res = normalizeAIRevisionConfig(null);
      expect(res.prompts).toHaveLength(3);
      expect(res.defaultPromptId).toBe("builtin-text-cleanup");
    });

    it("preserves custom prompts", () => {
      const saved: AIRevisionConfig = {
        prompts: [
          ...DEFAULT_TEXT_PROMPTS,
          {
            id: "custom-1",
            name: "Custom",
            type: "text",
            systemPrompt: "Custom",
            userPromptTemplate: "{{text}}",
            isBuiltIn: false,
            isDefault: false,
            quickAccess: false,
          },
        ],
        defaultPromptId: "custom-1",
        quickAccessPromptIds: ["custom-1"],
      } as AIRevisionConfig;

      const res = normalizeAIRevisionConfig(saved);
      expect(res.prompts.find((p) => p.id === "custom-1")).toBeDefined();
      expect(res.defaultPromptId).toBe("custom-1");
    });
  });

  describe("basic actions (sanity)", () => {
    it("clearRevisions removes suggestions", () => {
      mockStore.set({ aiRevisionSuggestions: [{ segmentId: "seg-1", promptId: "p", originalText: "a", revisedText: "b", status: "pending", changes: [] }] });
      slice.clearRevisions();
      const s = mockStore.getState();
      expect(s.aiRevisionSuggestions?.length).toBe(0);
    });

    it("acceptRevision updates text and removes suggestion", () => {
      mockStore.set({ aiRevisionSuggestions: [{ segmentId: "seg-1", promptId: "p", originalText: "Hello world", revisedText: "Hello universe", status: "pending", changes: [] }] });
      slice.acceptRevision("seg-1");
      const s = mockStore.getState();
      expect(s.updateSegmentText).toHaveBeenCalledWith("seg-1", "Hello universe");
      expect(s.aiRevisionSuggestions?.length).toBe(0);
    });
  });
});
