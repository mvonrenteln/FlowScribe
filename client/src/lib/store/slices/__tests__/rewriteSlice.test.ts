/**
 * Tests for RewriteSlice
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreApi } from "zustand";
import { create } from "zustand";
import type { AIChapterDetectionConfig, AIPrompt, TranscriptStore } from "@/lib/store/types";
import { createRewriteSlice, initialRewriteState, type RewriteSlice } from "../rewriteSlice";

type RewriteSliceTestState = RewriteSlice & {
  aiChapterDetectionConfig: AIChapterDetectionConfig;
  updateChapterDetectionConfig: ReturnType<typeof vi.fn>;
  addChapterDetectionPrompt: ReturnType<typeof vi.fn>;
  updateChapterDetectionPrompt: ReturnType<typeof vi.fn>;
  deleteChapterDetectionPrompt: ReturnType<typeof vi.fn>;
  setActiveChapterDetectionPrompt: ReturnType<typeof vi.fn>;
};

const buildPrompt = (overrides?: Partial<AIPrompt>): AIPrompt => ({
  id: "prompt-1",
  name: "Rewrite Prompt",
  type: "chapter-detect",
  operation: "rewrite",
  systemPrompt: "You are an expert editor.",
  userPromptTemplate: "Rewrite: {{chapterContent}}",
  isBuiltIn: false,
  quickAccess: false,
  ...overrides,
});

const buildConfig = (prompt: AIPrompt): AIChapterDetectionConfig => ({
  batchSize: 100,
  minChapterLength: 10,
  maxChapterLength: 80,
  tagIds: [],
  selectedProviderId: undefined,
  selectedModel: undefined,
  activePromptId: prompt.id,
  prompts: [prompt],
  includeContext: true,
  contextWordLimit: 500,
});

describe("RewriteSlice", () => {
  let store: ReturnType<typeof create<RewriteSliceTestState>>;
  let updateChapterDetectionConfig: RewriteSliceTestState["updateChapterDetectionConfig"];
  let addChapterDetectionPrompt: RewriteSliceTestState["addChapterDetectionPrompt"];
  let updateChapterDetectionPrompt: RewriteSliceTestState["updateChapterDetectionPrompt"];
  let deleteChapterDetectionPrompt: RewriteSliceTestState["deleteChapterDetectionPrompt"];
  let setActiveChapterDetectionPrompt: RewriteSliceTestState["setActiveChapterDetectionPrompt"];

  beforeEach(() => {
    const prompt = buildPrompt();
    updateChapterDetectionConfig = vi.fn();
    addChapterDetectionPrompt = vi.fn();
    updateChapterDetectionPrompt = vi.fn();
    deleteChapterDetectionPrompt = vi.fn();
    setActiveChapterDetectionPrompt = vi.fn();

    store = create<RewriteSliceTestState>()((set, get) => ({
      aiChapterDetectionConfig: buildConfig(prompt),
      updateChapterDetectionConfig,
      addChapterDetectionPrompt,
      updateChapterDetectionPrompt,
      deleteChapterDetectionPrompt,
      setActiveChapterDetectionPrompt,
      ...initialRewriteState,
      ...createRewriteSlice(
        set as StoreApi<TranscriptStore>["setState"],
        get as StoreApi<TranscriptStore>["getState"],
      ),
    }));
  });

  describe("Initial State", () => {
    it("should not be processing initially", () => {
      const state = store.getState();

      expect(state.rewriteInProgress).toBe(false);
      expect(state.rewriteChapterId).toBeNull();
      expect(state.rewriteError).toBeNull();
    });
  });

  describe("Config Management", () => {
    it("should forward rewrite config updates to chapter detection config", () => {
      store.getState().updateRewriteConfig({
        includeContext: false,
        contextWordLimit: 750,
      });

      expect(updateChapterDetectionConfig).toHaveBeenCalledWith({
        includeContext: false,
        contextWordLimit: 750,
      });
    });
  });

  describe("Prompt Management", () => {
    it("should add new prompt via chapter detection prompts", () => {
      store.getState().addRewritePrompt({
        name: "Custom Prompt",
        systemPrompt: "You are an editor.",
        userPromptTemplate: "Rewrite: {{chapterContent}}",
        type: "chapter-detect",
        operation: "rewrite",
        isBuiltIn: false,
        quickAccess: false,
      });

      expect(addChapterDetectionPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Custom Prompt",
          systemPrompt: "You are an editor.",
          userPromptTemplate: "Rewrite: {{chapterContent}}",
          type: "chapter-detect",
          operation: "rewrite",
        }),
      );
    });

    it("should update prompt via chapter detection prompts", () => {
      store.getState().updateRewritePrompt("prompt-1", {
        name: "Updated Name",
      });

      expect(updateChapterDetectionPrompt).toHaveBeenCalledWith("prompt-1", {
        name: "Updated Name",
      });
    });

    it("should delete prompt via chapter detection prompts", () => {
      store.getState().deleteRewritePrompt("prompt-1");

      expect(deleteChapterDetectionPrompt).toHaveBeenCalledWith("prompt-1");
    });

    it("should set default prompt via chapter detection config", () => {
      store.getState().setDefaultRewritePrompt("prompt-1");

      expect(setActiveChapterDetectionPrompt).toHaveBeenCalledWith("prompt-1");
    });

    it("should toggle quick access for rewrite prompt", () => {
      store.getState().toggleQuickAccessRewritePrompt("prompt-1");

      expect(updateChapterDetectionPrompt).toHaveBeenCalledWith("prompt-1", {
        quickAccess: true,
      });
    });
  });

  describe("Cancellation", () => {
    it("should cancel rewrite", () => {
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
