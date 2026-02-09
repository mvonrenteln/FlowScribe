/**
 * Tests for RewriteSlice
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreApi } from "zustand";
import { create } from "zustand";
import type { AIChapterDetectionConfig, AIPrompt, TranscriptStore } from "@/lib/store/types";
import { createRewriteSlice, initialRewriteState, type RewriteSlice } from "../rewriteSlice";

vi.mock("@/lib/ai/features/rewrite/service", () => ({
  rewriteChapter: vi.fn(),
  rewriteParagraph: vi.fn(),
}));

type RewriteSliceTestState = RewriteSlice & {
  aiChapterDetectionConfig: AIChapterDetectionConfig;
  updateChapterDetectionConfig: ReturnType<typeof vi.fn>;
  addChapterDetectionPrompt: ReturnType<typeof vi.fn>;
  updateChapterDetectionPrompt: ReturnType<typeof vi.fn>;
  deleteChapterDetectionPrompt: ReturnType<typeof vi.fn>;
  updateChapterRewrite: ReturnType<typeof vi.fn>;
  chapters: Array<{
    id: string;
    title: string;
    rewrittenText?: string;
    summary?: string;
    notes?: string;
    tags?: string[];
  }>;
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
  includeParagraphContext: true,
  paragraphContextCount: 2,
});

describe("RewriteSlice", () => {
  let store: ReturnType<typeof create<RewriteSliceTestState>>;
  let updateChapterDetectionConfig: RewriteSliceTestState["updateChapterDetectionConfig"];
  let addChapterDetectionPrompt: RewriteSliceTestState["addChapterDetectionPrompt"];
  let updateChapterDetectionPrompt: RewriteSliceTestState["updateChapterDetectionPrompt"];
  let deleteChapterDetectionPrompt: RewriteSliceTestState["deleteChapterDetectionPrompt"];

  beforeEach(() => {
    const prompt = buildPrompt();
    updateChapterDetectionConfig = vi.fn();
    addChapterDetectionPrompt = vi.fn();
    updateChapterDetectionPrompt = vi.fn();
    deleteChapterDetectionPrompt = vi.fn();

    store = create<RewriteSliceTestState>()((set, get) => ({
      aiChapterDetectionConfig: buildConfig(prompt),
      updateChapterDetectionConfig,
      addChapterDetectionPrompt,
      updateChapterDetectionPrompt,
      deleteChapterDetectionPrompt,
      updateChapterRewrite: vi.fn(),
      chapters: [],
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

  describe("Paragraph Rewrite", () => {
    it("updates only the target paragraph", async () => {
      const { rewriteParagraph } = await import("@/lib/ai/features/rewrite/service");
      const prompt = buildPrompt({ rewriteScope: "paragraph" });

      store.setState({
        aiChapterDetectionConfig: buildConfig(prompt),
        chapters: [
          {
            id: "chapter-1",
            title: "Intro",
            rewrittenText: "First paragraph.\n\nSecond paragraph.",
          },
        ],
      });

      (rewriteParagraph as ReturnType<typeof vi.fn>).mockResolvedValue({
        rewrittenText: "Updated paragraph.",
        wordCount: 2,
      });

      await store.getState().startParagraphRewrite("chapter-1", 1, prompt.id);

      expect(store.getState().updateChapterRewrite).toHaveBeenCalledWith(
        "chapter-1",
        "First paragraph.\n\nUpdated paragraph.",
      );
      expect(store.getState().paragraphRewriteInProgress).toBe(false);
    });

    it("ignores invalid paragraph indices", async () => {
      const prompt = buildPrompt({ rewriteScope: "paragraph" });
      store.setState({
        aiChapterDetectionConfig: buildConfig(prompt),
        chapters: [
          {
            id: "chapter-1",
            title: "Intro",
            rewrittenText: "Only paragraph.",
          },
        ],
      });

      await store.getState().startParagraphRewrite("chapter-1", 5, prompt.id);

      expect(store.getState().updateChapterRewrite).not.toHaveBeenCalled();
    });
  });
});
