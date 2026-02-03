/**
 * Tests for RewriteSlice
 */

import { beforeEach, describe, expect, it } from "vitest";
import { create } from "zustand";
import { createRewriteSlice, initialRewriteState, type RewriteSlice } from "../rewriteSlice";

describe("RewriteSlice", () => {
  let store: ReturnType<typeof create<RewriteSlice>>;

  beforeEach(() => {
    store = create<RewriteSlice>()((set, get) => ({
      ...initialRewriteState,
      ...createRewriteSlice(set, get),
    }));
  });

  describe("Initial State", () => {
    it("should have default configuration", () => {
      const state = store.getState();

      expect(state.rewriteConfig).toMatchObject({
        includeContext: true,
        contextWordLimit: 500,
        quickAccessPromptIds: expect.arrayContaining(["builtin-summarize", "builtin-narrative"]),
      });
    });

    it("should have built-in prompts", () => {
      const state = store.getState();

      expect(state.rewritePrompts.length).toBeGreaterThan(0);
      expect(state.rewritePrompts[0]).toMatchObject({
        id: "builtin-summarize",
        name: "Summarize",
        isBuiltin: true,
      });
    });

    it("should not be processing initially", () => {
      const state = store.getState();

      expect(state.rewriteInProgress).toBe(false);
      expect(state.rewriteChapterId).toBeNull();
      expect(state.rewriteError).toBeNull();
    });
  });

  describe("Config Management", () => {
    it("should update rewrite config", () => {
      store.getState().updateRewriteConfig({
        includeContext: false,
        contextWordLimit: 1000,
      });

      const state = store.getState();
      expect(state.rewriteConfig.includeContext).toBe(false);
      expect(state.rewriteConfig.contextWordLimit).toBe(1000);
    });

    it("should update partial config", () => {
      const initialConfig = store.getState().rewriteConfig;

      store.getState().updateRewriteConfig({
        contextWordLimit: 750,
      });

      const state = store.getState();
      expect(state.rewriteConfig.includeContext).toBe(initialConfig.includeContext);
      expect(state.rewriteConfig.contextWordLimit).toBe(750);
    });
  });

  describe("Prompt Management", () => {
    it("should add new prompt", () => {
      const initialCount = store.getState().rewritePrompts.length;

      store.getState().addRewritePrompt({
        name: "Test Prompt",
        instructions: "Test instructions",
      });

      const state = store.getState();
      expect(state.rewritePrompts.length).toBe(initialCount + 1);
      expect(state.rewritePrompts[initialCount]).toMatchObject({
        name: "Test Prompt",
        instructions: "Test instructions",
        isBuiltin: false,
      });
    });

    it("should update prompt", () => {
      store.getState().addRewritePrompt({
        name: "Original Name",
        instructions: "Original instructions",
      });

      const prompts = store.getState().rewritePrompts;
      const customPrompt = prompts.find((p) => !p.isBuiltin);
      expect(customPrompt).toBeDefined();

      if (customPrompt) {
        store.getState().updateRewritePrompt(customPrompt.id, {
          name: "Updated Name",
        });

        const state = store.getState();
        const updated = state.rewritePrompts.find((p) => p.id === customPrompt.id);
        expect(updated?.name).toBe("Updated Name");
        expect(updated?.instructions).toBe("Original instructions");
      }
    });

    it("should not delete built-in prompt", () => {
      const initialCount = store.getState().rewritePrompts.length;
      const builtinId = "builtin-summarize";

      store.getState().deleteRewritePrompt(builtinId);

      const state = store.getState();
      expect(state.rewritePrompts.length).toBe(initialCount);
      expect(state.rewritePrompts.find((p) => p.id === builtinId)).toBeDefined();
    });

    it("should delete custom prompt", () => {
      store.getState().addRewritePrompt({
        name: "Custom Prompt",
        instructions: "Custom instructions",
      });

      const prompts = store.getState().rewritePrompts;
      const customPrompt = prompts.find((p) => !p.isBuiltin);
      expect(customPrompt).toBeDefined();

      if (customPrompt) {
        const initialCount = prompts.length;
        store.getState().deleteRewritePrompt(customPrompt.id);

        const state = store.getState();
        expect(state.rewritePrompts.length).toBe(initialCount - 1);
        expect(state.rewritePrompts.find((p) => p.id === customPrompt.id)).toBeUndefined();
      }
    });

    it("should set default prompt", () => {
      const newDefaultId = "builtin-narrative";

      store.getState().setDefaultRewritePrompt(newDefaultId);

      const state = store.getState();
      expect(state.rewriteConfig.defaultPromptId).toBe(newDefaultId);
    });

    it("should toggle quick access", () => {
      const promptId = "builtin-summarize";
      const initialInQuickAccess = store
        .getState()
        .rewriteConfig.quickAccessPromptIds.includes(promptId);

      store.getState().toggleQuickAccessRewritePrompt(promptId);

      const state = store.getState();
      const nowInQuickAccess = state.rewriteConfig.quickAccessPromptIds.includes(promptId);
      expect(nowInQuickAccess).toBe(!initialInQuickAccess);

      // Toggle back
      store.getState().toggleQuickAccessRewritePrompt(promptId);

      const finalState = store.getState();
      const finalInQuickAccess = finalState.rewriteConfig.quickAccessPromptIds.includes(promptId);
      expect(finalInQuickAccess).toBe(initialInQuickAccess);
    });
  });

  describe("Cancellation", () => {
    it("should cancel rewrite", () => {
      // Simulate in-progress state (normally set by startRewrite)
      store.setState({
        rewriteInProgress: true,
        rewriteChapterId: "chapter-1",
        rewriteAbortController: new AbortController(),
      });

      store.getState().cancelRewrite();

      const state = store.getState();
      expect(state.rewriteInProgress).toBe(false);
      expect(state.rewriteChapterId).toBeNull();
      expect(state.rewriteAbortController).toBeNull();
    });
  });
});
