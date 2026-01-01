import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIRevisionSlice, TranscriptStore } from "../../types";
import {
  createAIRevisionSlice,
  DEFAULT_TEXT_PROMPTS,
  initialAIRevisionState,
} from "../aiRevisionSlice";

// Mock store setter and getter
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

  const set = (
    partial: Partial<TranscriptStore> | ((s: TranscriptStore) => Partial<TranscriptStore>),
  ) => {
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
  describe("initialAIRevisionState", () => {
    it("has default templates", () => {
      expect(initialAIRevisionState.aiRevisionConfig.prompts).toHaveLength(3);
    });

    it("has a default template ID set", () => {
      expect(initialAIRevisionState.aiRevisionConfig.defaultPromptId).toBe("builtin-text-cleanup");
    });

    it("has quick access template IDs", () => {
      expect(initialAIRevisionState.aiRevisionConfig.quickAccessPromptIds).toContain(
        "builtin-text-cleanup",
      );
      expect(initialAIRevisionState.aiRevisionConfig.quickAccessPromptIds).toContain(
        "builtin-text-clarity",
      );
    });

    it("is not processing by default", () => {
      expect(initialAIRevisionState.aiRevisionIsProcessing).toBe(false);
    });

    it("has no suggestions by default", () => {
      expect(initialAIRevisionState.aiRevisionSuggestions).toHaveLength(0);
    });
  });

  describe("DEFAULT_TEXT_PROMPTS", () => {
    it("includes Transcript Cleanup template", () => {
      const template = DEFAULT_TEXT_PROMPTS.find((t) => t.id === "builtin-text-cleanup");
      expect(template).toBeDefined();
      expect(template?.name).toBe("Transcript Cleanup");
      expect(template?.isBuiltIn).toBe(true);
    });

    it("includes Improve Clarity template", () => {
      const template = DEFAULT_TEXT_PROMPTS.find((t) => t.id === "builtin-text-clarity");
      expect(template).toBeDefined();
      expect(template?.name).toBe("Improve Clarity");
      expect(template?.isBuiltIn).toBe(true);
    });

    it("includes Formalize template", () => {
      const template = DEFAULT_TEXT_PROMPTS.find((t) => t.id === "builtin-text-formalize");
      expect(template).toBeDefined();
      expect(template?.name).toBe("Formalize");
      expect(template?.isBuiltIn).toBe(true);
    });

    it("all default templates have system and user prompts", () => {
      for (const template of DEFAULT_TEXT_PROMPTS) {
        expect(template.systemPrompt).toBeTruthy();
        expect(template.userPromptTemplate).toBeTruthy();
      }
    });
  });

  describe("createAIRevisionSlice", () => {
    let mockStore: ReturnType<typeof createMockStore>;
    let slice: AIRevisionSlice;

    beforeEach(() => {
      mockStore = createMockStore();
      // biome-ignore lint/suspicious/noExplicitAny: Test mock requires type casting
      slice = createAIRevisionSlice(mockStore.set as any, mockStore.get as any);
    });

    describe("template management", () => {
      it("addRevisionPrompt adds a new template", () => {
        slice.addRevisionPrompt({
          name: "Custom Template",
          systemPrompt: "Test system prompt",
          userPromptTemplate: "Test user prompt",
        });

        const state = mockStore.getState();
        const templates = state.aiRevisionConfig?.prompts ?? [];
        expect(templates.length).toBe(4); // 3 default + 1 new

        const newTemplate = templates.find((t) => t.name === "Custom Template");
        expect(newTemplate).toBeDefined();
        expect(newTemplate?.isBuiltIn).toBe(false);
      });

      it("updateRevisionPrompt updates an existing template", () => {
        slice.updateRevisionPrompt("builtin-text-cleanup", {
          name: "Updated Name",
        });

        const state = mockStore.getState();
        const template = state.aiRevisionConfig?.prompts.find(
          (t) => t.id === "builtin-text-cleanup",
        );
        expect(template?.name).toBe("Updated Name");
        expect(template?.isBuiltIn).toBe(true); // isBuiltIn cannot be changed
      });

      it("deleteRevisionPrompt removes custom templates", () => {
        // First add a custom template
        slice.addRevisionPrompt({
          name: "Custom Template",
          systemPrompt: "Test",
          userPromptTemplate: "Test",
        });

        const stateAfterAdd = mockStore.getState();
        const customTemplate = stateAfterAdd.aiRevisionConfig?.prompts.find(
          (t) => t.name === "Custom Template",
        );
        expect(customTemplate).toBeDefined();

        // Now delete it
        if (customTemplate) {
          slice.deleteRevisionPrompt(customTemplate.id);
        }

        const stateAfterDelete = mockStore.getState();
        const deletedTemplate = stateAfterDelete.aiRevisionConfig?.prompts.find(
          (t) => t.id === customTemplate?.id,
        );
        expect(deletedTemplate).toBeUndefined();
      });

      it("deleteRevisionPrompt does not remove default templates", () => {
        slice.deleteRevisionPrompt("builtin-text-cleanup");

        const state = mockStore.getState();
        const template = state.aiRevisionConfig?.prompts.find(
          (t) => t.id === "builtin-text-cleanup",
        );
        expect(template).toBeDefined(); // Still exists
      });

      it("setDefaultRevisionPrompt changes the default template", () => {
        slice.setDefaultRevisionPrompt("builtin-text-formalize");

        const state = mockStore.getState();
        expect(state.aiRevisionConfig?.defaultPromptId).toBe("builtin-text-formalize");
      });

      it("setQuickAccessPrompts sets the quick access list", () => {
        slice.setQuickAccessPrompts(["builtin-text-formalize"]);

        const state = mockStore.getState();
        expect(state.aiRevisionConfig?.quickAccessPromptIds).toEqual(["builtin-text-formalize"]);
      });

      it("toggleQuickAccessPrompt adds template if not in list", () => {
        slice.setQuickAccessPrompts([]);
        slice.toggleQuickAccessPrompt("builtin-text-formalize");

        const state = mockStore.getState();
        expect(state.aiRevisionConfig?.quickAccessPromptIds).toContain("builtin-text-formalize");
      });

      it("toggleQuickAccessPrompt removes template if already in list", () => {
        slice.setQuickAccessPrompts(["builtin-text-formalize", "builtin-text-cleanup"]);
        slice.toggleQuickAccessPrompt("builtin-text-formalize");

        const state = mockStore.getState();
        expect(state.aiRevisionConfig?.quickAccessPromptIds).not.toContain(
          "builtin-text-formalize",
        );
        expect(state.aiRevisionConfig?.quickAccessPromptIds).toContain("builtin-text-cleanup");
      });
    });

    describe("revision actions", () => {
      it("cancelRevision sets isProcessing to false", () => {
        // Manually set processing state
        mockStore.set({ aiRevisionIsProcessing: true });

        slice.cancelRevision();

        const state = mockStore.getState();
        expect(state.aiRevisionIsProcessing).toBe(false);
      });

      it("clearRevisions removes all suggestions", () => {
        mockStore.set({
          aiRevisionSuggestions: [
            {
              segmentId: "seg-1",
              templateId: "test",
              originalText: "Original",
              revisedText: "Revised",
              status: "pending",
              changes: [],
            },
          ],
        });

        slice.clearRevisions();

        const state = mockStore.getState();
        expect(state.aiRevisionSuggestions).toHaveLength(0);
      });

      it("acceptRevision removes suggestion and updates text", () => {
        mockStore.set({
          aiRevisionSuggestions: [
            {
              segmentId: "seg-1",
              templateId: "test",
              originalText: "Hello world",
              revisedText: "Hello universe",
              status: "pending",
              changes: [],
            },
          ],
        });

        slice.acceptRevision("seg-1");

        const state = mockStore.getState();
        // Suggestion should be removed, not just marked as accepted
        const suggestion = state.aiRevisionSuggestions?.find((s) => s.segmentId === "seg-1");
        expect(suggestion).toBeUndefined();
        expect(state.aiRevisionSuggestions?.length).toBe(0);
        expect(state.updateSegmentText).toHaveBeenCalledWith("seg-1", "Hello universe");
      });

      it("rejectRevision removes suggestion without updating text", () => {
        mockStore.set({
          aiRevisionSuggestions: [
            {
              segmentId: "seg-1",
              templateId: "test",
              originalText: "Hello world",
              revisedText: "Hello universe",
              status: "pending",
              changes: [],
            },
          ],
        });

        slice.rejectRevision("seg-1");

        const state = mockStore.getState();
        // Suggestion should be removed
        const suggestion = state.aiRevisionSuggestions?.find((s) => s.segmentId === "seg-1");
        expect(suggestion).toBeUndefined();
        expect(state.updateSegmentText).not.toHaveBeenCalled();
      });

      it("acceptAllRevisions removes all pending suggestions", () => {
        mockStore.set({
          aiRevisionSuggestions: [
            {
              segmentId: "seg-1",
              templateId: "test",
              originalText: "A",
              revisedText: "B",
              status: "pending",
              changes: [],
            },
            {
              segmentId: "seg-2",
              templateId: "test",
              originalText: "C",
              revisedText: "D",
              status: "pending",
              changes: [],
            },
          ],
        });

        slice.acceptAllRevisions();

        const state = mockStore.getState();
        // All pending suggestions should be removed
        expect(state.aiRevisionSuggestions?.length).toBe(0);
        expect(state.updateSegmentsTexts).toHaveBeenCalled();
      });

      it("rejectAllRevisions removes all pending suggestions", () => {
        mockStore.set({
          aiRevisionSuggestions: [
            {
              segmentId: "seg-1",
              templateId: "test",
              originalText: "A",
              revisedText: "B",
              status: "pending",
              changes: [],
            },
            {
              segmentId: "seg-2",
              templateId: "test",
              originalText: "C",
              revisedText: "D",
              status: "pending",
              changes: [],
            },
          ],
        });

        slice.rejectAllRevisions();

        const state = mockStore.getState();
        // All pending suggestions should be removed
        expect(state.aiRevisionSuggestions?.length).toBe(0);
      });
    });

    describe("startSingleRevision", () => {
      it("sets error if segment not found", () => {
        slice.startSingleRevision("non-existent", "builtin-text-cleanup");

        const state = mockStore.getState();
        expect(state.aiRevisionError).toContain("not found");
      });

      it("sets error if template not found", () => {
        slice.startSingleRevision("seg-1", "non-existent-template");

        const state = mockStore.getState();
        expect(state.aiRevisionError).toContain("not found");
      });

      it("sets processing state when starting revision", () => {
        // Note: This will trigger async code that we can't fully test here
        // The actual AI call is mocked out in integration tests
        slice.startSingleRevision("seg-1", "builtin-text-cleanup");

        const state = mockStore.getState();
        expect(state.aiRevisionIsProcessing).toBe(true);
        expect(state.aiRevisionTotalToProcess).toBe(1);
      });
    });
  });
});
