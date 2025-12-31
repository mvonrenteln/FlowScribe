import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIRevisionSlice, TranscriptStore } from "../../types";
import {
  createAIRevisionSlice,
  DEFAULT_REVISION_TEMPLATES,
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
      expect(initialAIRevisionState.aiRevisionConfig.templates).toHaveLength(3);
    });

    it("has a default template ID set", () => {
      expect(initialAIRevisionState.aiRevisionConfig.defaultTemplateId).toBe(
        "default-transcript-cleanup",
      );
    });

    it("has quick access template IDs", () => {
      expect(initialAIRevisionState.aiRevisionConfig.quickAccessTemplateIds).toContain(
        "default-transcript-cleanup",
      );
      expect(initialAIRevisionState.aiRevisionConfig.quickAccessTemplateIds).toContain(
        "default-improve-clarity",
      );
    });

    it("is not processing by default", () => {
      expect(initialAIRevisionState.aiRevisionIsProcessing).toBe(false);
    });

    it("has no suggestions by default", () => {
      expect(initialAIRevisionState.aiRevisionSuggestions).toHaveLength(0);
    });
  });

  describe("DEFAULT_REVISION_TEMPLATES", () => {
    it("includes Transcript Cleanup template", () => {
      const template = DEFAULT_REVISION_TEMPLATES.find(
        (t) => t.id === "default-transcript-cleanup",
      );
      expect(template).toBeDefined();
      expect(template?.name).toBe("Transcript Cleanup");
      expect(template?.isDefault).toBe(true);
    });

    it("includes Improve Clarity template", () => {
      const template = DEFAULT_REVISION_TEMPLATES.find((t) => t.id === "default-improve-clarity");
      expect(template).toBeDefined();
      expect(template?.name).toBe("Improve Clarity");
      expect(template?.isDefault).toBe(true);
    });

    it("includes Formalize template", () => {
      const template = DEFAULT_REVISION_TEMPLATES.find((t) => t.id === "default-formalize");
      expect(template).toBeDefined();
      expect(template?.name).toBe("Formalize");
      expect(template?.isDefault).toBe(true);
    });

    it("all default templates have system and user prompts", () => {
      for (const template of DEFAULT_REVISION_TEMPLATES) {
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
      slice = createAIRevisionSlice(mockStore.set as any, mockStore.get as any);
    });

    describe("template management", () => {
      it("addRevisionTemplate adds a new template", () => {
        slice.addRevisionTemplate({
          name: "Custom Template",
          systemPrompt: "Test system prompt",
          userPromptTemplate: "Test user prompt",
        });

        const state = mockStore.getState();
        const templates = state.aiRevisionConfig?.templates ?? [];
        expect(templates.length).toBe(4); // 3 default + 1 new

        const newTemplate = templates.find((t) => t.name === "Custom Template");
        expect(newTemplate).toBeDefined();
        expect(newTemplate?.isDefault).toBe(false);
      });

      it("updateRevisionTemplate updates an existing template", () => {
        slice.updateRevisionTemplate("default-transcript-cleanup", {
          name: "Updated Name",
        });

        const state = mockStore.getState();
        const template = state.aiRevisionConfig?.templates.find(
          (t) => t.id === "default-transcript-cleanup",
        );
        expect(template?.name).toBe("Updated Name");
        expect(template?.isDefault).toBe(true); // isDefault cannot be changed
      });

      it("deleteRevisionTemplate removes custom templates", () => {
        // First add a custom template
        slice.addRevisionTemplate({
          name: "Custom Template",
          systemPrompt: "Test",
          userPromptTemplate: "Test",
        });

        const stateAfterAdd = mockStore.getState();
        const customTemplate = stateAfterAdd.aiRevisionConfig?.templates.find(
          (t) => t.name === "Custom Template",
        );
        expect(customTemplate).toBeDefined();

        // Now delete it
        slice.deleteRevisionTemplate(customTemplate!.id);

        const stateAfterDelete = mockStore.getState();
        const deletedTemplate = stateAfterDelete.aiRevisionConfig?.templates.find(
          (t) => t.id === customTemplate!.id,
        );
        expect(deletedTemplate).toBeUndefined();
      });

      it("deleteRevisionTemplate does not remove default templates", () => {
        slice.deleteRevisionTemplate("default-transcript-cleanup");

        const state = mockStore.getState();
        const template = state.aiRevisionConfig?.templates.find(
          (t) => t.id === "default-transcript-cleanup",
        );
        expect(template).toBeDefined(); // Still exists
      });

      it("setDefaultRevisionTemplate changes the default template", () => {
        slice.setDefaultRevisionTemplate("default-formalize");

        const state = mockStore.getState();
        expect(state.aiRevisionConfig?.defaultTemplateId).toBe("default-formalize");
      });

      it("setQuickAccessTemplates sets the quick access list", () => {
        slice.setQuickAccessTemplates(["default-formalize"]);

        const state = mockStore.getState();
        expect(state.aiRevisionConfig?.quickAccessTemplateIds).toEqual(["default-formalize"]);
      });

      it("toggleQuickAccessTemplate adds template if not in list", () => {
        slice.setQuickAccessTemplates([]);
        slice.toggleQuickAccessTemplate("default-formalize");

        const state = mockStore.getState();
        expect(state.aiRevisionConfig?.quickAccessTemplateIds).toContain("default-formalize");
      });

      it("toggleQuickAccessTemplate removes template if already in list", () => {
        slice.setQuickAccessTemplates(["default-formalize", "default-transcript-cleanup"]);
        slice.toggleQuickAccessTemplate("default-formalize");

        const state = mockStore.getState();
        expect(state.aiRevisionConfig?.quickAccessTemplateIds).not.toContain("default-formalize");
        expect(state.aiRevisionConfig?.quickAccessTemplateIds).toContain(
          "default-transcript-cleanup",
        );
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
        slice.startSingleRevision("non-existent", "default-transcript-cleanup");

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
        slice.startSingleRevision("seg-1", "default-transcript-cleanup");

        const state = mockStore.getState();
        expect(state.aiRevisionIsProcessing).toBe(true);
        expect(state.aiRevisionTotalToProcess).toBe(1);
      });
    });
  });
});
