/**
 * Tests for ReformulationSlice
 */

import { beforeEach, describe, expect, it } from "vitest";
import { create } from "zustand";
import {
  createReformulationSlice,
  initialReformulationState,
  type ReformulationSlice,
} from "../reformulationSlice";

describe("ReformulationSlice", () => {
  let store: ReturnType<typeof create<ReformulationSlice>>;

  beforeEach(() => {
    store = create<ReformulationSlice>()((set, get) => ({
      ...initialReformulationState,
      ...createReformulationSlice(set, get),
    }));
  });

  describe("Initial State", () => {
    it("should have default configuration", () => {
      const state = store.getState();

      expect(state.reformulationConfig).toMatchObject({
        includeContext: true,
        contextWordLimit: 500,
        quickAccessPromptIds: expect.arrayContaining(["builtin-summarize", "builtin-narrative"]),
      });
    });

    it("should have built-in prompts", () => {
      const state = store.getState();

      expect(state.reformulationPrompts.length).toBeGreaterThan(0);
      expect(state.reformulationPrompts[0]).toMatchObject({
        id: "builtin-summarize",
        name: "Summarize",
        isBuiltin: true,
      });
    });

    it("should not be processing initially", () => {
      const state = store.getState();

      expect(state.reformulationInProgress).toBe(false);
      expect(state.reformulationChapterId).toBeNull();
      expect(state.reformulationError).toBeNull();
    });
  });

  describe("Config Management", () => {
    it("should update reformulation config", () => {
      store.getState().updateReformulationConfig({
        includeContext: false,
        contextWordLimit: 1000,
      });

      const state = store.getState();
      expect(state.reformulationConfig.includeContext).toBe(false);
      expect(state.reformulationConfig.contextWordLimit).toBe(1000);
    });

    it("should update partial config", () => {
      const initialConfig = store.getState().reformulationConfig;

      store.getState().updateReformulationConfig({
        contextWordLimit: 750,
      });

      const state = store.getState();
      expect(state.reformulationConfig.includeContext).toBe(initialConfig.includeContext);
      expect(state.reformulationConfig.contextWordLimit).toBe(750);
    });
  });

  describe("Prompt Management", () => {
    it("should add new prompt", () => {
      const initialCount = store.getState().reformulationPrompts.length;

      store.getState().addReformulationPrompt({
        name: "Test Prompt",
        instructions: "Test instructions",
      });

      const state = store.getState();
      expect(state.reformulationPrompts.length).toBe(initialCount + 1);
      expect(state.reformulationPrompts[initialCount]).toMatchObject({
        name: "Test Prompt",
        instructions: "Test instructions",
        isBuiltin: false,
      });
    });

    it("should update prompt", () => {
      store.getState().addReformulationPrompt({
        name: "Original Name",
        instructions: "Original instructions",
      });

      const prompts = store.getState().reformulationPrompts;
      const customPrompt = prompts.find((p) => !p.isBuiltin);
      expect(customPrompt).toBeDefined();

      if (customPrompt) {
        store.getState().updateReformulationPrompt(customPrompt.id, {
          name: "Updated Name",
        });

        const state = store.getState();
        const updated = state.reformulationPrompts.find((p) => p.id === customPrompt.id);
        expect(updated?.name).toBe("Updated Name");
        expect(updated?.instructions).toBe("Original instructions");
      }
    });

    it("should not delete built-in prompt", () => {
      const initialCount = store.getState().reformulationPrompts.length;
      const builtinId = "builtin-summarize";

      store.getState().deleteReformulationPrompt(builtinId);

      const state = store.getState();
      expect(state.reformulationPrompts.length).toBe(initialCount);
      expect(state.reformulationPrompts.find((p) => p.id === builtinId)).toBeDefined();
    });

    it("should delete custom prompt", () => {
      store.getState().addReformulationPrompt({
        name: "Custom Prompt",
        instructions: "Custom instructions",
      });

      const prompts = store.getState().reformulationPrompts;
      const customPrompt = prompts.find((p) => !p.isBuiltin);
      expect(customPrompt).toBeDefined();

      if (customPrompt) {
        const initialCount = prompts.length;
        store.getState().deleteReformulationPrompt(customPrompt.id);

        const state = store.getState();
        expect(state.reformulationPrompts.length).toBe(initialCount - 1);
        expect(state.reformulationPrompts.find((p) => p.id === customPrompt.id)).toBeUndefined();
      }
    });

    it("should set default prompt", () => {
      const newDefaultId = "builtin-narrative";

      store.getState().setDefaultReformulationPrompt(newDefaultId);

      const state = store.getState();
      expect(state.reformulationConfig.defaultPromptId).toBe(newDefaultId);
    });

    it("should toggle quick access", () => {
      const promptId = "builtin-summarize";
      const initialInQuickAccess = store
        .getState()
        .reformulationConfig.quickAccessPromptIds.includes(promptId);

      store.getState().toggleQuickAccessReformulationPrompt(promptId);

      const state = store.getState();
      const nowInQuickAccess = state.reformulationConfig.quickAccessPromptIds.includes(promptId);
      expect(nowInQuickAccess).toBe(!initialInQuickAccess);

      // Toggle back
      store.getState().toggleQuickAccessReformulationPrompt(promptId);

      const finalState = store.getState();
      const finalInQuickAccess =
        finalState.reformulationConfig.quickAccessPromptIds.includes(promptId);
      expect(finalInQuickAccess).toBe(initialInQuickAccess);
    });
  });

  describe("Cancellation", () => {
    it("should cancel reformulation", () => {
      // Simulate in-progress state (normally set by startReformulation)
      store.setState({
        reformulationInProgress: true,
        reformulationChapterId: "chapter-1",
        reformulationAbortController: new AbortController(),
      });

      store.getState().cancelReformulation();

      const state = store.getState();
      expect(state.reformulationInProgress).toBe(false);
      expect(state.reformulationChapterId).toBeNull();
      expect(state.reformulationAbortController).toBeNull();
    });
  });
});
