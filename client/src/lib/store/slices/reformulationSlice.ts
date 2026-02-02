/**
 * Reformulation Slice
 *
 * Zustand slice for chapter reformulation state and configuration.
 *
 * @module store/slices/reformulationSlice
 */

import type { StoreApi } from "zustand";
import {
  BUILTIN_REFORMULATION_PROMPTS,
  getDefaultReformulationPrompt,
} from "@/lib/ai/features/reformulation/config";
import { reformulateChapter } from "@/lib/ai/features/reformulation/service";
import type { ReformulationPrompt } from "@/lib/ai/features/reformulation/types";
import type { TranscriptStore } from "../types";
import { generateId } from "../utils/id";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

// ==================== Types ====================

// Re-export types for external use
export type { ReformulationPrompt };

export type ReformulationConfig = {
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

export interface ReformulationSlice {
  // Configuration
  reformulationConfig: ReformulationConfig;
  reformulationPrompts: ReformulationPrompt[];

  // Processing state
  reformulationInProgress: boolean;
  reformulationChapterId: string | null;
  reformulationError: string | null;
  reformulationAbortController: AbortController | null;

  // Actions - Configuration
  updateReformulationConfig: (updates: Partial<ReformulationConfig>) => void;

  // Actions - Prompts
  addReformulationPrompt: (prompt: Omit<ReformulationPrompt, "id">) => void;
  updateReformulationPrompt: (id: string, updates: Partial<ReformulationPrompt>) => void;
  deleteReformulationPrompt: (id: string) => void;
  setDefaultReformulationPrompt: (id: string) => void;
  toggleQuickAccessReformulationPrompt: (id: string) => void;

  // Actions - Processing
  startReformulation: (chapterId: string, promptId: string) => Promise<void>;
  cancelReformulation: () => void;
}

// ==================== Initial State ====================

const defaultPrompt = getDefaultReformulationPrompt();

export const initialReformulationState = {
  reformulationConfig: {
    includeContext: true,
    contextWordLimit: 500,
    defaultPromptId: defaultPrompt.id,
    quickAccessPromptIds: BUILTIN_REFORMULATION_PROMPTS.map((p) => p.id),
    selectedProviderId: undefined,
    selectedModel: undefined,
  } satisfies ReformulationConfig,
  reformulationPrompts: [...BUILTIN_REFORMULATION_PROMPTS],
  reformulationInProgress: false,
  reformulationChapterId: null,
  reformulationError: null,
  reformulationAbortController: null,
};

// ==================== Slice Creator ====================

export const createReformulationSlice = (
  set: StoreSetter,
  get: StoreGetter,
): ReformulationSlice => ({
  ...initialReformulationState,

  // Configuration
  updateReformulationConfig: (updates) => {
    set((state) => ({
      reformulationConfig: {
        ...state.reformulationConfig,
        ...updates,
      },
    }));
  },

  // Prompts
  addReformulationPrompt: (prompt) => {
    const newPrompt: ReformulationPrompt = {
      ...prompt,
      id: generateId(),
      isBuiltin: false,
    };

    set((state) => ({
      reformulationPrompts: [...state.reformulationPrompts, newPrompt],
    }));
  },

  updateReformulationPrompt: (id, updates) => {
    set((state) => ({
      reformulationPrompts: state.reformulationPrompts.map((p) =>
        p.id === id ? { ...p, ...updates } : p,
      ),
    }));
  },

  deleteReformulationPrompt: (id) => {
    const state = get();
    const prompt = state.reformulationPrompts.find((p) => p.id === id);

    // Cannot delete built-in prompts
    if (prompt?.isBuiltin) {
      console.warn("[Reformulation Slice] Cannot delete built-in prompt:", id);
      return;
    }

    set((state) => ({
      reformulationPrompts: state.reformulationPrompts.filter((p) => p.id !== id),
      reformulationConfig: {
        ...state.reformulationConfig,
        // Update default if deleted
        defaultPromptId:
          state.reformulationConfig.defaultPromptId === id
            ? getDefaultReformulationPrompt().id
            : state.reformulationConfig.defaultPromptId,
        // Remove from quick access
        quickAccessPromptIds: state.reformulationConfig.quickAccessPromptIds.filter(
          (pid) => pid !== id,
        ),
      },
    }));
  },

  setDefaultReformulationPrompt: (id) => {
    set((state) => ({
      reformulationConfig: {
        ...state.reformulationConfig,
        defaultPromptId: id,
      },
    }));
  },

  toggleQuickAccessReformulationPrompt: (id) => {
    set((state) => {
      const isInQuickAccess = state.reformulationConfig.quickAccessPromptIds.includes(id);
      return {
        reformulationConfig: {
          ...state.reformulationConfig,
          quickAccessPromptIds: isInQuickAccess
            ? state.reformulationConfig.quickAccessPromptIds.filter((pid) => pid !== id)
            : [...state.reformulationConfig.quickAccessPromptIds, id],
        },
      };
    });
  },

  // Processing
  startReformulation: async (chapterId, promptId) => {
    const state = get();

    // Find chapter
    const chapter = state.chapters.find((c) => c.id === chapterId);
    if (!chapter) {
      console.error("[Reformulation Slice] Chapter not found:", chapterId);
      return;
    }

    // Find prompt
    const prompt = state.reformulationPrompts.find((p) => p.id === promptId);
    if (!prompt) {
      console.error("[Reformulation Slice] Prompt not found:", promptId);
      return;
    }

    // Get segments in chapter
    const segments = state.selectSegmentsInChapter(chapterId);
    if (!segments.length) {
      console.error("[Reformulation Slice] No segments in chapter:", chapterId);
      return;
    }

    // Create abort controller
    const abortController = new AbortController();

    // Set processing state
    set({
      reformulationInProgress: true,
      reformulationChapterId: chapterId,
      reformulationError: null,
      reformulationAbortController: abortController,
    });

    try {
      const result = await reformulateChapter({
        chapter,
        segments,
        allChapters: state.chapters,
        prompt,
        providerId: state.reformulationConfig.selectedProviderId,
        model: state.reformulationConfig.selectedModel,
        signal: abortController.signal,
        includeContext: state.reformulationConfig.includeContext,
        contextWordLimit: state.reformulationConfig.contextWordLimit,
      });

      // Clear processing state first
      set({
        reformulationInProgress: false,
        reformulationChapterId: null,
        reformulationAbortController: null,
      });

      // Update chapter with reformulated text using the chapter slice action
      // This ensures proper history management
      // Use get() to get fresh state after async operation
      get().setChapterReformulation(chapterId, result.reformulatedText, {
        promptId,
        providerId: state.reformulationConfig.selectedProviderId,
        model: state.reformulationConfig.selectedModel,
      });
    } catch (error) {
      console.error("[Reformulation Slice] Reformulation failed:", error);

      set({
        reformulationInProgress: false,
        reformulationChapterId: null,
        reformulationError: error instanceof Error ? error.message : "Unknown error",
        reformulationAbortController: null,
      });
    }
  },

  cancelReformulation: () => {
    const state = get();
    state.reformulationAbortController?.abort();

    set({
      reformulationInProgress: false,
      reformulationChapterId: null,
      reformulationAbortController: null,
    });
  },
});
