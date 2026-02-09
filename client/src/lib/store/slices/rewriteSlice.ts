/**
 * Rewrite Slice
 *
 * Zustand slice for chapter rewrite state and configuration.
 *
 * @module store/slices/rewriteSlice
 */

import type { StoreApi } from "zustand";
import { toast } from "@/hooks/use-toast";
import { getI18nInstance } from "@/i18n/config";
import { rewriteChapter, rewriteParagraph } from "@/lib/ai/features/rewrite/service";
import { createLogger } from "@/lib/logging";
import {
  getPreviousParagraphs,
  replaceParagraphAtIndex,
  splitRewrittenParagraphs,
} from "@/lib/rewriteParagraphs";
import type { AIChapterDetectionConfig, AIPrompt, TranscriptStore } from "../types";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

const logger = createLogger({ feature: "RewriteSlice", namespace: "Store" });
const t = getI18nInstance().t.bind(getI18nInstance());

// ==================== Types ====================

export type RewriteConfig = {
  /** Include context (summaries + previous chapter) */
  includeContext: boolean;
  /** Maximum words from previous chapter */
  contextWordLimit: number;
  /** Default prompt ID */
  defaultPromptId: string;
  /** Quick access prompt IDs (shown in popover) */
  quickAccessPromptIds: string[];
  /** Selected provider ID */
  selectedProviderId?: string;
  /** Selected model */
  selectedModel?: string;
};

export interface RewriteSlice {
  // Processing state
  rewriteInProgress: boolean;
  rewriteChapterId: string | null;
  rewriteError: string | null;
  rewriteAbortController: AbortController | null;
  paragraphRewriteInProgress: boolean;
  paragraphRewriteChapterId: string | null;
  paragraphRewriteParagraphIndex: number | null;
  paragraphRewriteError: string | null;
  paragraphRewriteAbortController: AbortController | null;

  // Actions - Configuration
  updateRewriteConfig: (updates: Partial<RewriteConfig>) => void;

  // Actions - Prompts
  addRewritePrompt: (prompt: Omit<AIPrompt, "id">) => void;
  updateRewritePrompt: (
    id: string,
    updates: Partial<Pick<AIPrompt, "name" | "systemPrompt" | "userPromptTemplate">>,
  ) => void;
  deleteRewritePrompt: (id: string) => void;
  toggleQuickAccessRewritePrompt: (id: string) => void;

  // Actions - Processing
  startRewrite: (chapterId: string, promptId: string, customInstructions?: string) => Promise<void>;
  cancelRewrite: () => void;
  startParagraphRewrite: (
    chapterId: string,
    paragraphIndex: number,
    promptId: string,
    customInstructions?: string,
  ) => Promise<void>;
  cancelParagraphRewrite: () => void;
}

// ==================== Initial State ====================

export const initialRewriteState = {
  rewriteInProgress: false,
  rewriteChapterId: null,
  rewriteError: null,
  rewriteAbortController: null,
  paragraphRewriteInProgress: false,
  paragraphRewriteChapterId: null,
  paragraphRewriteParagraphIndex: null,
  paragraphRewriteError: null,
  paragraphRewriteAbortController: null,
};

// ==================== Slice Creator ====================

export const createRewriteSlice = (set: StoreSetter, get: StoreGetter): RewriteSlice => ({
  ...initialRewriteState,

  // Configuration
  updateRewriteConfig: (updates) => {
    const configUpdates: Partial<AIChapterDetectionConfig> = {};
    if (typeof updates.includeContext === "boolean") {
      configUpdates.includeContext = updates.includeContext;
    }
    if (typeof updates.contextWordLimit === "number") {
      configUpdates.contextWordLimit = updates.contextWordLimit;
    }
    if (updates.selectedProviderId !== undefined) {
      configUpdates.selectedProviderId = updates.selectedProviderId;
    }
    if (updates.selectedModel !== undefined) {
      configUpdates.selectedModel = updates.selectedModel;
    }
    get().updateChapterDetectionConfig(configUpdates);
  },

  // Prompts
  addRewritePrompt: (prompt) => {
    const nextPrompt: Omit<AIPrompt, "id"> = {
      name: prompt.name,
      type: "chapter-detect",
      operation: "rewrite",
      systemPrompt: prompt.systemPrompt,
      userPromptTemplate: prompt.userPromptTemplate,
      isBuiltIn: Boolean(prompt.isBuiltIn),
      quickAccess: false,
    };
    get().addChapterDetectionPrompt(nextPrompt);
  },

  updateRewritePrompt: (id, updates) => {
    const promptUpdates: Partial<AIPrompt> = {};
    if (updates.name !== undefined) {
      promptUpdates.name = updates.name;
    }
    if (updates.systemPrompt !== undefined) {
      promptUpdates.systemPrompt = updates.systemPrompt;
    }
    if (updates.userPromptTemplate !== undefined) {
      promptUpdates.userPromptTemplate = updates.userPromptTemplate;
    }
    get().updateChapterDetectionPrompt(id, promptUpdates);
  },

  deleteRewritePrompt: (id) => {
    get().deleteChapterDetectionPrompt(id);
  },

  toggleQuickAccessRewritePrompt: (id) => {
    const prompt = get().aiChapterDetectionConfig.prompts.find((p) => p.id === id);
    if (prompt) {
      get().updateChapterDetectionPrompt(id, { quickAccess: !prompt.quickAccess });
    }
  },

  // Processing
  startRewrite: async (chapterId, promptId, customInstructions) => {
    const state = get();

    // Find chapter
    const chapter = state.chapters.find((c) => c.id === chapterId);
    if (!chapter) {
      logger.error("Chapter not found.", { chapterId });
      return;
    }

    // Find prompt in unified config
    const prompt = state.aiChapterDetectionConfig.prompts.find((p) => p.id === promptId);
    if (!prompt) {
      logger.error("Prompt not found.", { promptId });
      return;
    }
    if (!prompt.systemPrompt?.trim() || !prompt.userPromptTemplate?.trim()) {
      logger.error("Rewrite prompt missing systemPrompt or userPromptTemplate.", { promptId });
      return;
    }

    // Get segments in chapter
    const segments = state.selectSegmentsInChapter(chapterId);
    if (!segments.length) {
      logger.error("No segments in chapter.", { chapterId });
      return;
    }

    // Create abort controller
    const abortController = new AbortController();

    // Set processing state
    set({
      rewriteInProgress: true,
      rewriteChapterId: chapterId,
      rewriteError: null,
      rewriteAbortController: abortController,
    });

    try {
      const result = await rewriteChapter({
        chapter,
        segments,
        allChapters: state.chapters,
        prompt,
        providerId: state.aiChapterDetectionConfig.selectedProviderId,
        model: state.aiChapterDetectionConfig.selectedModel,
        signal: abortController.signal,
        includeContext: state.aiChapterDetectionConfig.includeContext,
        contextWordLimit: state.aiChapterDetectionConfig.contextWordLimit,
        customInstructions: customInstructions,
      });

      // Clear processing state first
      set({
        rewriteInProgress: false,
        rewriteChapterId: null,
        rewriteAbortController: null,
      });

      // Update chapter with rewritten text using the chapter slice action
      // This ensures proper history management
      // Use get() to get fresh state after async operation
      get().setChapterRewrite(chapterId, result.rewrittenText, {
        promptId,
        providerId: state.aiChapterDetectionConfig.selectedProviderId,
        model: state.aiChapterDetectionConfig.selectedModel,
      });
    } catch (error) {
      logger.error("Rewrite failed.", { error });

      set({
        rewriteInProgress: false,
        rewriteChapterId: null,
        rewriteError: error instanceof Error ? error.message : "Unknown error",
        rewriteAbortController: null,
      });
    }
  },

  cancelRewrite: () => {
    const state = get();
    state.rewriteAbortController?.abort();

    set({
      rewriteInProgress: false,
      rewriteChapterId: null,
      rewriteAbortController: null,
    });
  },

  startParagraphRewrite: async (chapterId, paragraphIndex, promptId, customInstructions) => {
    const state = get();

    const chapter = state.chapters.find((c) => c.id === chapterId);
    if (!chapter || !chapter.rewrittenText) {
      logger.error("Chapter or rewritten text not found.", { chapterId });
      return;
    }

    const prompt = state.aiChapterDetectionConfig.prompts.find((p) => p.id === promptId);
    if (!prompt) {
      logger.error("Prompt not found.", { promptId });
      return;
    }
    if (prompt.operation !== "rewrite" || prompt.rewriteScope !== "paragraph") {
      logger.error("Prompt is not a paragraph rewrite prompt.", { promptId });
      return;
    }
    if (!prompt.systemPrompt?.trim() || !prompt.userPromptTemplate?.trim()) {
      logger.error("Rewrite prompt missing systemPrompt or userPromptTemplate.", { promptId });
      return;
    }

    const paragraphs = splitRewrittenParagraphs(chapter.rewrittenText);
    const paragraph = paragraphs[paragraphIndex];
    if (!paragraph) {
      logger.error("Paragraph index out of bounds.", { paragraphIndex });
      return;
    }

    const previousParagraphs = getPreviousParagraphs(
      paragraphs,
      paragraphIndex,
      state.aiChapterDetectionConfig.paragraphContextCount,
    );

    const abortController = new AbortController();

    set({
      paragraphRewriteInProgress: true,
      paragraphRewriteChapterId: chapterId,
      paragraphRewriteParagraphIndex: paragraphIndex,
      paragraphRewriteError: null,
      paragraphRewriteAbortController: abortController,
    });

    try {
      const result = await rewriteParagraph({
        chapter,
        paragraphContent: paragraph,
        previousParagraphs,
        paragraphContextCount: state.aiChapterDetectionConfig.paragraphContextCount,
        prompt,
        providerId: state.aiChapterDetectionConfig.selectedProviderId,
        model: state.aiChapterDetectionConfig.selectedModel,
        signal: abortController.signal,
        includeParagraphContext: state.aiChapterDetectionConfig.includeParagraphContext,
        customInstructions,
      });

      set({
        paragraphRewriteInProgress: false,
        paragraphRewriteChapterId: null,
        paragraphRewriteParagraphIndex: null,
        paragraphRewriteAbortController: null,
      });

      const updatedText = replaceParagraphAtIndex(
        chapter.rewrittenText,
        paragraphIndex,
        result.rewrittenText,
      );
      get().updateChapterRewrite(chapterId, updatedText);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Paragraph rewrite failed.", { error });

      set({
        paragraphRewriteInProgress: false,
        paragraphRewriteChapterId: null,
        paragraphRewriteParagraphIndex: null,
        paragraphRewriteError: message,
        paragraphRewriteAbortController: null,
      });

      toast({
        title: t("rewrite.paragraph.errorTitle", { defaultValue: "Paragraph rewrite failed" }),
        description: message,
        variant: "destructive",
      });
    }
  },

  cancelParagraphRewrite: () => {
    const state = get();
    state.paragraphRewriteAbortController?.abort();

    set({
      paragraphRewriteInProgress: false,
      paragraphRewriteChapterId: null,
      paragraphRewriteParagraphIndex: null,
      paragraphRewriteAbortController: null,
    });
  },
});
