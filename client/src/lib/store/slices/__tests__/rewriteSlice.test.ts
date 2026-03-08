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
  setChapterRewrite: ReturnType<typeof vi.fn>;
  selectSegmentsInChapter: ReturnType<typeof vi.fn>;
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
  let setChapterRewrite: RewriteSliceTestState["setChapterRewrite"];
  let selectSegmentsInChapter: RewriteSliceTestState["selectSegmentsInChapter"];

  beforeEach(() => {
    const prompt = buildPrompt();
    updateChapterDetectionConfig = vi.fn();
    addChapterDetectionPrompt = vi.fn();
    updateChapterDetectionPrompt = vi.fn();
    deleteChapterDetectionPrompt = vi.fn();
    setChapterRewrite = vi.fn();
    selectSegmentsInChapter = vi.fn(() => [
      {
        id: "seg-1",
        speaker: "Speaker 1",
        start: 0,
        end: 1,
        text: "Hello world",
        words: [],
      },
    ]);

    store = create<RewriteSliceTestState>()((set, get) => ({
      aiChapterDetectionConfig: buildConfig(prompt),
      updateChapterDetectionConfig,
      addChapterDetectionPrompt,
      updateChapterDetectionPrompt,
      deleteChapterDetectionPrompt,
      setChapterRewrite,
      selectSegmentsInChapter,
      updateChapterRewrite: vi.fn(),
      chapters: [
        {
          id: "chapter-1",
          title: "Intro",
        },
      ],
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

    it("should set default rewrite prompt by scope", () => {
      store.getState().setDefaultRewritePromptForScope("chapter", "prompt-1");

      expect(updateChapterDetectionConfig).toHaveBeenCalledWith({
        defaultRewritePromptIdsByScope: {
          chapter: "prompt-1",
        },
      });
    });

    it("should ignore invalid scope default prompt updates", () => {
      store.getState().setDefaultRewritePromptForScope("paragraph", "prompt-1");

      expect(updateChapterDetectionConfig).not.toHaveBeenCalled();
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

    it("updates draft text instead of persisted chapter rewrite when a draft exists", async () => {
      const { rewriteParagraph } = await import("@/lib/ai/features/rewrite/service");
      const prompt = buildPrompt({ rewriteScope: "paragraph" });

      store.setState({
        aiChapterDetectionConfig: buildConfig(prompt),
        rewriteDraftByChapterId: {
          "chapter-1": {
            text: "First paragraph.\n\nSecond paragraph.",
            promptId: "prompt-1",
            providerId: "openai",
            model: "gpt-4.1",
          },
        },
      });

      (rewriteParagraph as ReturnType<typeof vi.fn>).mockResolvedValue({
        rewrittenText: "Updated paragraph.",
        wordCount: 2,
      });

      await store.getState().startParagraphRewrite("chapter-1", 1, prompt.id);

      expect(store.getState().updateChapterRewrite).not.toHaveBeenCalled();
      expect(store.getState().rewriteDraftByChapterId["chapter-1"]?.text).toBe(
        "First paragraph.\n\nUpdated paragraph.",
      );
    });

    it("does not recreate draft when it was cleared while paragraph rewrite was in flight", async () => {
      const { rewriteParagraph } = await import("@/lib/ai/features/rewrite/service");
      const prompt = buildPrompt({ rewriteScope: "paragraph" });

      store.setState({
        aiChapterDetectionConfig: buildConfig(prompt),
        rewriteDraftByChapterId: {
          "chapter-1": {
            text: "First paragraph.\n\nSecond paragraph.",
            promptId: "prompt-1",
            providerId: "openai",
            model: "gpt-4.1",
          },
        },
      });

      let resolveRewrite: ((value: { rewrittenText: string; wordCount: number }) => void) | null =
        null;
      (rewriteParagraph as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise<{ rewrittenText: string; wordCount: number }>((resolve) => {
            resolveRewrite = resolve;
          }),
      );

      const rewritePromise = store.getState().startParagraphRewrite("chapter-1", 1, prompt.id);

      store.getState().clearRewriteDraft("chapter-1");
      resolveRewrite?.({ rewrittenText: "Updated paragraph.", wordCount: 2 });
      await rewritePromise;

      expect(store.getState().rewriteDraftByChapterId["chapter-1"]).toBeUndefined();
      expect(store.getState().updateChapterRewrite).not.toHaveBeenCalled();
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

  describe("Chapter Rewrite Draft", () => {
    it("stores rewrite result as draft until accepted", async () => {
      const { rewriteChapter } = await import("@/lib/ai/features/rewrite/service");

      (rewriteChapter as ReturnType<typeof vi.fn>).mockResolvedValue({
        rewrittenText: "Draft rewritten chapter",
      });

      await store.getState().startRewrite("chapter-1", "prompt-1");

      expect(store.getState().setChapterRewrite).not.toHaveBeenCalled();
      expect(store.getState().rewriteDraftByChapterId["chapter-1"]).toEqual({
        text: "Draft rewritten chapter",
        promptId: "prompt-1",
        providerId: undefined,
        model: undefined,
      });
    });

    it("clears a draft for a chapter", () => {
      store.setState({
        rewriteDraftByChapterId: {
          "chapter-1": {
            text: "Draft rewritten chapter",
            promptId: "prompt-1",
          },
        },
      });

      store.getState().clearRewriteDraft("chapter-1");

      expect(store.getState().rewriteDraftByChapterId["chapter-1"]).toBeUndefined();
    });
  });
});
