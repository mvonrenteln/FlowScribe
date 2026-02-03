/**
 * Rewrite Slice
 *
 * Zustand slice for chapter rewrite state and configuration.
 *
 * @module store/slices/rewriteSlice
 */

import type { StoreApi } from "zustand";
import {
  BUILTIN_REFORMULATION_PROMPTS,
  getDefaultRewritePrompt,
} from "@/lib/ai/features/rewrite/config";
import { rewriteChapter } from "@/lib/ai/features/rewrite/service";
import type { RewritePrompt } from "@/lib/ai/features/rewrite/types";
import type { TranscriptStore } from "../types";
import { generateId } from "../utils/id";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

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
  // Configuration
  rewriteConfig: RewriteConfig;
  rewritePrompts: RewritePrompt[];

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

const defaultPrompt = getDefaultRewritePrompt();

export const initialRewriteState = {
  rewriteConfig: {
    includeContext: true,
    contextWordLimit: 500,
    defaultPromptId: defaultPrompt.id,
    quickAccessPromptIds: BUILTIN_REFORMULATION_PROMPTS.map((p) => p.id),
    selectedProviderId: undefined,
    selectedModel: undefined,
  } satisfies RewriteConfig,
  rewritePrompts: [...BUILTIN_REFORMULATION_PROMPTS],
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
    set((state) => ({
      rewriteConfig: {
        ...state.rewriteConfig,
        ...updates,
      },
    }));
  },

  // Prompts
  addRewritePrompt: (prompt) => {
    const newPrompt: RewritePrompt = {
      ...prompt,
      id: generateId(),
      isBuiltin: false,
    };

    set((state) => ({
      rewritePrompts: [...state.rewritePrompts, newPrompt],
    }));
  },

  updateRewritePrompt: (id, updates) => {
    set((state) => ({
      rewritePrompts: state.rewritePrompts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  },

  deleteRewritePrompt: (id) => {
    const state = get();
    const prompt = state.rewritePrompts.find((p) => p.id === id);

    // Cannot delete built-in prompts
    if (prompt?.isBuiltin) {
      console.warn("[Rewrite Slice] Cannot delete built-in prompt:", id);
      return;
    }

    set((state) => ({
      rewritePrompts: state.rewritePrompts.filter((p) => p.id !== id),
      rewriteConfig: {
        ...state.rewriteConfig,
        // Update default if deleted
        defaultPromptId:
          state.rewriteConfig.defaultPromptId === id
            ? getDefaultRewritePrompt().id
            : state.rewriteConfig.defaultPromptId,
        // Remove from quick access
        quickAccessPromptIds: state.rewriteConfig.quickAccessPromptIds.filter((pid) => pid !== id),
      },
    }));
  },

  setDefaultRewritePrompt: (id) => {
    set((state) => ({
      rewriteConfig: {
        ...state.rewriteConfig,
        defaultPromptId: id,
      },
    }));
  },

  toggleQuickAccessRewritePrompt: (id) => {
    set((state) => {
      const isInQuickAccess = state.rewriteConfig.quickAccessPromptIds.includes(id);
      return {
        rewriteConfig: {
          ...state.rewriteConfig,
          quickAccessPromptIds: isInQuickAccess
            ? state.rewriteConfig.quickAccessPromptIds.filter((pid) => pid !== id)
            : [...state.rewriteConfig.quickAccessPromptIds, id],
        },
      };
    });
  },

  // Processing
  startRewrite: async (chapterId, promptId) => {
    const state = get();

    // Find chapter
    const chapter = state.chapters.find((c) => c.id === chapterId);
    if (!chapter) {
      console.error("[Rewrite Slice] Chapter not found:", chapterId);
      return;
    }

    // Find prompt
    const prompt = state.rewritePrompts.find((p) => p.id === promptId);
    if (!prompt) {
      console.error("[Rewrite Slice] Prompt not found:", promptId);
      return;
    }

    // Get segments in chapter
    const segments = state.selectSegmentsInChapter(chapterId);
    if (!segments.length) {
      console.error("[Rewrite Slice] No segments in chapter:", chapterId);
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
        providerId: state.rewriteConfig.selectedProviderId,
        model: state.rewriteConfig.selectedModel,
        signal: abortController.signal,
        includeContext: state.rewriteConfig.includeContext,
        contextWordLimit: state.rewriteConfig.contextWordLimit,
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
        providerId: state.rewriteConfig.selectedProviderId,
        model: state.rewriteConfig.selectedModel,
      });
    } catch (error) {
      console.error("[Rewrite Slice] Rewrite failed:", error);

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
