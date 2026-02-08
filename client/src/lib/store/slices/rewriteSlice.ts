/**
 * Rewrite Slice
 *
 * Zustand slice for chapter rewrite state and configuration.
 *
 * @module store/slices/rewriteSlice
 */

import type { StoreApi } from "zustand";
import { rewriteChapter } from "@/lib/ai/features/rewrite/service";
import type { RewritePrompt } from "@/lib/ai/features/rewrite/types";
import { createLogger } from "@/lib/logging";
import type { AIChapterDetectionConfig, AIPrompt, TranscriptStore } from "../types";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

const logger = createLogger({ feature: "RewriteSlice", namespace: "Store" });

// ==================== Types ====================

// Re-export types for external use
export type { RewritePrompt };

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

  // Actions - Configuration
  updateRewriteConfig: (updates: Partial<RewriteConfig>) => void;

  // Actions - Prompts
  addRewritePrompt: (prompt: Omit<RewritePrompt, "id">) => void;
  updateRewritePrompt: (id: string, updates: Partial<RewritePrompt>) => void;
  deleteRewritePrompt: (id: string) => void;
  setDefaultRewritePrompt: (id: string) => void;
  toggleQuickAccessRewritePrompt: (id: string) => void;

  // Actions - Processing
  startRewrite: (chapterId: string, promptId: string) => Promise<void>;
  cancelRewrite: () => void;
}

// ==================== Initial State ====================

export const initialRewriteState = {
  rewriteInProgress: false,
  rewriteChapterId: null,
  rewriteError: null,
  rewriteAbortController: null,
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
      systemPrompt: "",
      userPromptTemplate: "",
      instructions: prompt.instructions,
      isBuiltIn: Boolean(prompt.isBuiltin),
      quickAccess: false,
    };
    get().addChapterDetectionPrompt(nextPrompt);
  },

  updateRewritePrompt: (id, updates) => {
    const promptUpdates: Partial<AIPrompt> = {};
    if (updates.name !== undefined) {
      promptUpdates.name = updates.name;
    }
    if (updates.instructions !== undefined) {
      promptUpdates.instructions = updates.instructions;
    }
    get().updateChapterDetectionPrompt(id, promptUpdates);
  },

  deleteRewritePrompt: (id) => {
    get().deleteChapterDetectionPrompt(id);
  },

  setDefaultRewritePrompt: (id) => {
    get().setActiveChapterDetectionPrompt(id);
  },

  toggleQuickAccessRewritePrompt: (id) => {
    const prompt = get().aiChapterDetectionConfig.prompts.find((p) => p.id === id);
    if (prompt) {
      get().updateChapterDetectionPrompt(id, { quickAccess: !prompt.quickAccess });
    }
  },

  // Processing
  startRewrite: async (chapterId, promptId) => {
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
    if (!prompt.instructions?.trim()) {
      logger.error("Rewrite prompt missing instructions.", { promptId });
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
        prompt: {
          id: prompt.id,
          name: prompt.name,
          instructions: prompt.instructions,
          isBuiltin: prompt.isBuiltIn,
        },
        providerId: state.aiChapterDetectionConfig.selectedProviderId,
        model: state.aiChapterDetectionConfig.selectedModel,
        signal: abortController.signal,
        includeContext: state.aiChapterDetectionConfig.includeContext,
        contextWordLimit: state.aiChapterDetectionConfig.contextWordLimit,
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
});
