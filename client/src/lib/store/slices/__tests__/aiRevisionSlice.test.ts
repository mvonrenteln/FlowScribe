import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIRevisionConfig, AIRevisionSlice, TranscriptStore } from "../../types";
import {
  createAIRevisionSlice,
  DEFAULT_TEXT_PROMPTS,
  initialAIRevisionState,
  normalizeAIRevisionConfig,
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
          type: "text",
          systemPrompt: "Test system prompt",
          userPromptTemplate: "Test user prompt",
          isBuiltIn: false,
          quickAccess: false,
        });

        const state = mockStore.getState();
        const templates = state.aiRevisionConfig?.prompts ?? [];
        expect(templates.length).toBe(4); // 3 default + 1 new

        const newTemplate = templates.find((t) => t.name === "Custom Template");
        expect(newTemplate).toBeDefined();
        expect(newTemplate?.isBuiltIn).toBe(false);
      });

      it("addRevisionPrompt adds item to quick access when requested", () => {
        slice.addRevisionPrompt({
          name: "Quick Access Prompt",
          type: "text",
          systemPrompt: "Test system",
          userPromptTemplate: "Test template",
          isBuiltIn: false,
          quickAccess: true,
        });

        const state = mockStore.getState();
        const addedPrompt = state.aiRevisionConfig?.prompts.find(
          (p) => p.name === "Quick Access Prompt",
        );
        expect(addedPrompt).toBeDefined();
        expect(state.aiRevisionConfig?.quickAccessPromptIds).toContain(addedPrompt?.id);
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

      it("updateRevisionPrompt syncs quick access flag", () => {
        const targetId = "builtin-text-formalize";
        slice.updateRevisionPrompt(targetId, { quickAccess: true });
        let state = mockStore.getState();
        expect(state.aiRevisionConfig?.quickAccessPromptIds).toContain(targetId);

        slice.updateRevisionPrompt(targetId, { quickAccess: false });
        state = mockStore.getState();
        expect(state.aiRevisionConfig?.quickAccessPromptIds).not.toContain(targetId);
      });

      it("deleteRevisionPrompt removes custom templates", () => {
        // First add a custom template
        slice.addRevisionPrompt({
          name: "Custom Template",
          type: "text",
          systemPrompt: "Test",
          userPromptTemplate: "Test",
          isBuiltIn: false,
          quickAccess: false,
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
              promptId: "test",
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
              promptId: "test",
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
              promptId: "test",
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
              promptId: "test",
              originalText: "A",
              revisedText: "B",
              status: "pending",
              changes: [],
            },
            {
              segmentId: "seg-2",
              promptId: "test",
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
              promptId: "test",
              originalText: "A",
              revisedText: "B",
              status: "pending",
              changes: [],
            },
            {
              segmentId: "seg-2",
              promptId: "test",
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

  describe("normalizeAIRevisionConfig", () => {
    describe("with null/undefined input", () => {
      it("returns default config when saved is null", () => {
        const result = normalizeAIRevisionConfig(null);

        expect(result.prompts).toHaveLength(3);
        expect(result.defaultPromptId).toBe("builtin-text-cleanup");
        expect(result.quickAccessPromptIds).toContain("builtin-text-cleanup");
      });

      it("returns default config when saved is undefined", () => {
        const result = normalizeAIRevisionConfig(undefined);

        expect(result.prompts).toHaveLength(3);
        expect(result.defaultPromptId).toBe("builtin-text-cleanup");
      });
    });

    describe("ID migration from old format", () => {
      it("migrates default-transcript-cleanup to builtin-text-cleanup", () => {
        const oldConfig: AIRevisionConfig = {
          prompts: [
            {
              id: "default-transcript-cleanup",
              name: "My Edited Cleanup",
              type: "text",
              systemPrompt: "Custom system prompt",
              userPromptTemplate: "Custom user prompt",
              isBuiltIn: true,
              isDefault: true,
              quickAccess: true,
            },
          ],
          defaultPromptId: "default-transcript-cleanup",
          quickAccessPromptIds: ["default-transcript-cleanup"],
        };

        const result = normalizeAIRevisionConfig(oldConfig);

        // Should have migrated the ID
        const migratedPrompt = result.prompts.find((p) => p.id === "builtin-text-cleanup");
        expect(migratedPrompt).toBeDefined();
        expect(migratedPrompt?.name).toBe("My Edited Cleanup");
        expect(migratedPrompt?.systemPrompt).toBe("Custom system prompt");

        // Default prompt ID should also be migrated
        expect(result.defaultPromptId).toBe("builtin-text-cleanup");

        // Quick access should be migrated
        expect(result.quickAccessPromptIds).toContain("builtin-text-cleanup");
      });

      it("migrates default-improve-clarity to builtin-text-clarity", () => {
        const oldConfig: AIRevisionConfig = {
          prompts: [
            {
              id: "default-improve-clarity",
              name: "My Clarity Prompt",
              type: "text",
              systemPrompt: "Clarity prompt",
              userPromptTemplate: "{{text}}",
              isBuiltIn: true,
              isDefault: false,
              quickAccess: false,
            },
          ],
          defaultPromptId: "default-improve-clarity",
          quickAccessPromptIds: ["default-improve-clarity"],
        };

        const result = normalizeAIRevisionConfig(oldConfig);

        const migratedPrompt = result.prompts.find((p) => p.id === "builtin-text-clarity");
        expect(migratedPrompt).toBeDefined();
        expect(migratedPrompt?.name).toBe("My Clarity Prompt");
        expect(result.defaultPromptId).toBe("builtin-text-clarity");
      });

      it("migrates default-formalize to builtin-text-formalize", () => {
        const oldConfig: AIRevisionConfig = {
          prompts: [
            {
              id: "default-formalize",
              name: "My Formalize Prompt",
              type: "text",
              systemPrompt: "Formalize prompt",
              userPromptTemplate: "{{text}}",
              isBuiltIn: true,
              isDefault: false,
              quickAccess: false,
            },
          ],
          defaultPromptId: "default-formalize",
          quickAccessPromptIds: [],
        };

        const result = normalizeAIRevisionConfig(oldConfig);

        const migratedPrompt = result.prompts.find((p) => p.id === "builtin-text-formalize");
        expect(migratedPrompt).toBeDefined();
        expect(migratedPrompt?.name).toBe("My Formalize Prompt");
        expect(result.defaultPromptId).toBe("builtin-text-formalize");
      });

      it("migrates all three old IDs at once", () => {
        const oldConfig: AIRevisionConfig = {
          prompts: [
            {
              id: "default-transcript-cleanup",
              name: "Edited Cleanup",
              type: "text",
              systemPrompt: "Cleanup",
              userPromptTemplate: "{{text}}",
              isBuiltIn: true,
              isDefault: true,
              quickAccess: true,
            },
            {
              id: "default-improve-clarity",
              name: "Edited Clarity",
              type: "text",
              systemPrompt: "Clarity",
              userPromptTemplate: "{{text}}",
              isBuiltIn: true,
              isDefault: false,
              quickAccess: true,
            },
            {
              id: "default-formalize",
              name: "Edited Formalize",
              type: "text",
              systemPrompt: "Formalize",
              userPromptTemplate: "{{text}}",
              isBuiltIn: true,
              isDefault: false,
              quickAccess: false,
            },
          ],
          defaultPromptId: "default-transcript-cleanup",
          quickAccessPromptIds: ["default-transcript-cleanup", "default-improve-clarity"],
        };

        const result = normalizeAIRevisionConfig(oldConfig);

        // All three should be migrated
        expect(result.prompts.find((p) => p.id === "builtin-text-cleanup")?.name).toBe(
          "Edited Cleanup",
        );
        expect(result.prompts.find((p) => p.id === "builtin-text-clarity")?.name).toBe(
          "Edited Clarity",
        );
        expect(result.prompts.find((p) => p.id === "builtin-text-formalize")?.name).toBe(
          "Edited Formalize",
        );

        expect(result.defaultPromptId).toBe("builtin-text-cleanup");
        expect(result.quickAccessPromptIds).toContain("builtin-text-cleanup");
        expect(result.quickAccessPromptIds).toContain("builtin-text-clarity");
        expect(result.quickAccessPromptIds).not.toContain("builtin-text-formalize");
      });
    });

    describe("user edit preservation", () => {
      it("preserves user edits to built-in prompts", () => {
        const savedConfig: AIRevisionConfig = {
          prompts: [
            {
              id: "builtin-text-cleanup",
              name: "My Custom Name",
              type: "text",
              systemPrompt: "My custom system prompt that I carefully crafted",
              userPromptTemplate: "Please fix: {{text}}",
              isBuiltIn: true,
              isDefault: true,
              quickAccess: true,
            },
          ],
          defaultPromptId: "builtin-text-cleanup",
          quickAccessPromptIds: ["builtin-text-cleanup"],
        };

        const result = normalizeAIRevisionConfig(savedConfig);

        const cleanupPrompt = result.prompts.find((p) => p.id === "builtin-text-cleanup");
        expect(cleanupPrompt?.name).toBe("My Custom Name");
        expect(cleanupPrompt?.systemPrompt).toBe(
          "My custom system prompt that I carefully crafted",
        );
        expect(cleanupPrompt?.userPromptTemplate).toBe("Please fix: {{text}}");
      });

      it("preserves all fields of user-edited built-in prompts", () => {
        const customSystemPrompt = "Completely rewritten system prompt for German transcripts";
        const customUserPrompt = "Korrigiere: {{text}}";

        const savedConfig: AIRevisionConfig = {
          prompts: [
            {
              id: "builtin-text-cleanup",
              name: "Transkript-Bereinigung",
              type: "text",
              systemPrompt: customSystemPrompt,
              userPromptTemplate: customUserPrompt,
              isBuiltIn: true,
              isDefault: true,
              quickAccess: true,
            },
            {
              id: "builtin-text-clarity",
              name: "Klarheit verbessern",
              type: "text",
              systemPrompt: "German clarity prompt",
              userPromptTemplate: "Verbessere: {{text}}",
              isBuiltIn: true,
              isDefault: false,
              quickAccess: true,
            },
          ],
          defaultPromptId: "builtin-text-cleanup",
          quickAccessPromptIds: ["builtin-text-cleanup", "builtin-text-clarity"],
        };

        const result = normalizeAIRevisionConfig(savedConfig);

        const cleanupPrompt = result.prompts.find((p) => p.id === "builtin-text-cleanup");
        expect(cleanupPrompt?.name).toBe("Transkript-Bereinigung");
        expect(cleanupPrompt?.systemPrompt).toBe(customSystemPrompt);
        expect(cleanupPrompt?.userPromptTemplate).toBe(customUserPrompt);
        expect(cleanupPrompt?.isBuiltIn).toBe(true);

        const clarityPrompt = result.prompts.find((p) => p.id === "builtin-text-clarity");
        expect(clarityPrompt?.name).toBe("Klarheit verbessern");
      });

      it("adds missing built-in prompts with default values", () => {
        // Only has one prompt saved
        const savedConfig: AIRevisionConfig = {
          prompts: [
            {
              id: "builtin-text-cleanup",
              name: "My Cleanup",
              type: "text",
              systemPrompt: "Custom",
              userPromptTemplate: "{{text}}",
              isBuiltIn: true,
              isDefault: true,
              quickAccess: true,
            },
          ],
          defaultPromptId: "builtin-text-cleanup",
          quickAccessPromptIds: ["builtin-text-cleanup"],
        };

        const result = normalizeAIRevisionConfig(savedConfig);

        // Should have all 3 built-in prompts
        expect(result.prompts).toHaveLength(3);

        // The saved one should keep its custom values
        expect(result.prompts.find((p) => p.id === "builtin-text-cleanup")?.name).toBe(
          "My Cleanup",
        );

        // The missing ones should be added with default values
        const clarityPrompt = result.prompts.find((p) => p.id === "builtin-text-clarity");
        expect(clarityPrompt).toBeDefined();
        expect(clarityPrompt?.name).toBe("Improve Clarity"); // Default name

        const formalizePrompt = result.prompts.find((p) => p.id === "builtin-text-formalize");
        expect(formalizePrompt).toBeDefined();
        expect(formalizePrompt?.name).toBe("Formalize"); // Default name
      });
    });

    describe("custom prompts handling", () => {
      it("preserves custom (non-built-in) prompts", () => {
        const savedConfig: AIRevisionConfig = {
          prompts: [
            ...DEFAULT_TEXT_PROMPTS,
            {
              id: "custom-prompt-1",
              name: "My Custom Prompt",
              type: "text",
              systemPrompt: "Custom system",
              userPromptTemplate: "Custom user",
              isBuiltIn: false,
              isDefault: false,
              quickAccess: false,
            },
          ],
          defaultPromptId: "builtin-text-cleanup",
          quickAccessPromptIds: ["builtin-text-cleanup"],
        };

        const result = normalizeAIRevisionConfig(savedConfig);

        expect(result.prompts).toHaveLength(4); // 3 built-in + 1 custom
        const customPrompt = result.prompts.find((p) => p.id === "custom-prompt-1");
        expect(customPrompt).toBeDefined();
        expect(customPrompt?.name).toBe("My Custom Prompt");
        expect(customPrompt?.isBuiltIn).toBe(false);
      });

      it("preserves multiple custom prompts", () => {
        const savedConfig: AIRevisionConfig = {
          prompts: [
            ...DEFAULT_TEXT_PROMPTS,
            {
              id: "custom-1",
              name: "Custom 1",
              type: "text",
              systemPrompt: "System 1",
              userPromptTemplate: "User 1",
              isBuiltIn: false,
              isDefault: false,
              quickAccess: true,
            },
            {
              id: "custom-2",
              name: "Custom 2",
              type: "text",
              systemPrompt: "System 2",
              userPromptTemplate: "User 2",
              isBuiltIn: false,
              isDefault: false,
              quickAccess: false,
            },
          ],
          defaultPromptId: "custom-1",
          quickAccessPromptIds: ["custom-1"],
        };

        const result = normalizeAIRevisionConfig(savedConfig);

        expect(result.prompts).toHaveLength(5); // 3 built-in + 2 custom
        expect(result.prompts.find((p) => p.id === "custom-1")).toBeDefined();
        expect(result.prompts.find((p) => p.id === "custom-2")).toBeDefined();
        expect(result.defaultPromptId).toBe("custom-1");
      });
    });

    describe("validation", () => {
      it("falls back to default prompt ID if saved one doesn't exist", () => {
        const savedConfig: AIRevisionConfig = {
          prompts: [...DEFAULT_TEXT_PROMPTS],
          defaultPromptId: "non-existent-prompt",
          quickAccessPromptIds: [],
        };

        const result = normalizeAIRevisionConfig(savedConfig);

        expect(result.defaultPromptId).toBe("builtin-text-cleanup");
      });

      it("filters out non-existent quick access IDs", () => {
        const savedConfig: AIRevisionConfig = {
          prompts: [...DEFAULT_TEXT_PROMPTS],
          defaultPromptId: "builtin-text-cleanup",
          quickAccessPromptIds: ["non-existent", "builtin-text-cleanup", "also-non-existent"],
        };

        const result = normalizeAIRevisionConfig(savedConfig);

        expect(result.quickAccessPromptIds).toHaveLength(1);
        expect(result.quickAccessPromptIds).toContain("builtin-text-cleanup");
      });

      it("provides default quick access IDs if all are invalid", () => {
        const savedConfig: AIRevisionConfig = {
          prompts: [...DEFAULT_TEXT_PROMPTS],
          defaultPromptId: "builtin-text-cleanup",
          quickAccessPromptIds: ["non-existent-1", "non-existent-2"],
        };

        const result = normalizeAIRevisionConfig(savedConfig);

        expect(result.quickAccessPromptIds).toContain("builtin-text-cleanup");
        expect(result.quickAccessPromptIds).toContain("builtin-text-clarity");
      });
    });

    describe("edge cases", () => {
      it("handles empty prompts array", () => {
        const savedConfig: AIRevisionConfig = {
          prompts: [],
          defaultPromptId: "builtin-text-cleanup",
          quickAccessPromptIds: [],
        };

        const result = normalizeAIRevisionConfig(savedConfig);

        // Should add all built-in prompts
        expect(result.prompts).toHaveLength(3);
      });

      it("handles missing quickAccessPromptIds", () => {
        const savedConfig = {
          prompts: [...DEFAULT_TEXT_PROMPTS],
          defaultPromptId: "builtin-text-cleanup",
        } as AIRevisionConfig;

        const result = normalizeAIRevisionConfig(savedConfig);

        // Should provide defaults
        expect(result.quickAccessPromptIds.length).toBeGreaterThan(0);
      });

      it("ensures isBuiltIn flag is always true for built-in prompts", () => {
        const savedConfig: AIRevisionConfig = {
          prompts: [
            {
              id: "builtin-text-cleanup",
              name: "Edited",
              type: "text",
              systemPrompt: "Test",
              userPromptTemplate: "Test",
              isBuiltIn: false, // Incorrectly set to false
              isDefault: true,
              quickAccess: true,
            },
          ],
          defaultPromptId: "builtin-text-cleanup",
          quickAccessPromptIds: [],
        };

        const result = normalizeAIRevisionConfig(savedConfig);

        const prompt = result.prompts.find((p) => p.id === "builtin-text-cleanup");
        expect(prompt?.isBuiltIn).toBe(true); // Should be corrected
      });

      it("ensures type is always 'text' for built-in prompts", () => {
        const savedConfig: AIRevisionConfig = {
          prompts: [
            {
              id: "builtin-text-cleanup",
              name: "Edited",
              type: "speaker" as any, // Incorrectly set
              systemPrompt: "Test",
              userPromptTemplate: "Test",
              isBuiltIn: true,
              isDefault: true,
              quickAccess: true,
            },
          ],
          defaultPromptId: "builtin-text-cleanup",
          quickAccessPromptIds: [],
        };

        const result = normalizeAIRevisionConfig(savedConfig);

        const prompt = result.prompts.find((p) => p.id === "builtin-text-cleanup");
        expect(prompt?.type).toBe("text"); // Should be corrected
      });
    });
  });
});
