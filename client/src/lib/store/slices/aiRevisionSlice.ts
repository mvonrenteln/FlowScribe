/**
 * AI Revision Slice
 *
 * Zustand slice for managing AI text revision state, including
 * suggestions, processing status, and prompt configuration.
 *
 * Follows the "Custom First" principle - users can create their own
 * prompts, and configure which are shown in quick-access menu.
 */

import type { StoreApi } from "zustand";
import type { RevisionResult } from "@/lib/ai/features/revision";
import type {
  AIPrompt,
  AIRevisionBatchLogEntry,
  AIRevisionConfig,
  AIRevisionSlice,
  AIRevisionSuggestion,
  TranscriptStore,
} from "../types";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

// ==================== Built-in Text Prompts (nicht löschbar, bearbeitbar) ====================

export const DEFAULT_TEXT_PROMPTS: AIPrompt[] = [
  {
    id: "builtin-text-cleanup",
    name: "Transcript Cleanup",
    type: "text",
    isBuiltIn: true,
    isDefault: true,
    quickAccess: true,
    systemPrompt: `You are an expert in transcript correction. Correct the given text.

TASKS:
1. Fix spelling errors
2. Fix grammar errors
3. Remove filler words (um, uh, like, you know) when they disrupt flow
4. Fix transcription errors

RULES:
- Keep the content and meaning exactly the same
- Reply ONLY with the corrected text, no explanations`,
    userPromptTemplate: `Correct this text:

"{{text}}"`,
  },
  {
    id: "builtin-text-clarity",
    name: "Improve Clarity",
    type: "text",
    isBuiltIn: true,
    isDefault: false,
    quickAccess: true,
    systemPrompt: `You are an editor. Improve the phrasing of the given text.

TASKS:
1. Improve sentence structure
2. Simplify complex formulations
3. Fix grammar and spelling

RULES:
- Keep the meaning exactly the same
- Keep the underlying style of the text (epic, lyric, formal, informal, etc.)
- Reply ONLY with the improved text, no explanations
- Avoid changing short phrases or single words unless necessary
- Keep technical terms unchanged
- Do not change the language of the input text; do not translate`,
    userPromptTemplate: `Improve the phrasing:

"{{text}}"`,
  },
  {
    id: "builtin-text-formalize",
    name: "Formalize",
    type: "text",
    isBuiltIn: true,
    isDefault: false,
    quickAccess: false,
    systemPrompt: `You are an expert in professional communication. Convert informal language to formal style.

TASKS:
1. Replace colloquial language with standard language
2. Use professional tone
3. Fix grammar and spelling

RULES:
- Keep the meaning the same
- Naturally professional, not overly formal
- Reply ONLY with the formalized text, no explanations`,
    userPromptTemplate: `Formalize this text:

"{{text}}"`,
  },
];

// ==================== Initial State ====================

export const initialAIRevisionState = {
  aiRevisionSuggestions: [] as AIRevisionSuggestion[],
  aiRevisionIsProcessing: false,
  aiRevisionCurrentSegmentId: null as string | null, // Track which segment is currently being processed
  aiRevisionProcessedCount: 0,
  aiRevisionTotalToProcess: 0,
  aiRevisionConfig: {
    prompts: [...DEFAULT_TEXT_PROMPTS],
    defaultPromptId: "builtin-text-cleanup",
    quickAccessPromptIds: ["builtin-text-cleanup", "builtin-text-clarity"],
    selectedProviderId: undefined,
    selectedModel: undefined,
  } as AIRevisionConfig,
  aiRevisionError: null as string | null,
  aiRevisionAbortController: null as AbortController | null,
  aiRevisionBatchLog: [] as AIRevisionBatchLogEntry[],
  // Track last result per segment for UI feedback
  aiRevisionLastResult: null as {
    segmentId: string;
    status: "success" | "no-changes" | "error";
    message?: string;
    timestamp: number;
  } | null,
};

/**
 * Normalize saved aiRevisionConfig by merging with defaults.
 * Ensures built-in prompts are always present and cannot be removed.
 * IMPORTANT: User edits to built-in prompts are preserved!
 */
export function normalizeAIRevisionConfig(saved?: AIRevisionConfig | null): AIRevisionConfig {
  if (!saved) {
    return { ...initialAIRevisionState.aiRevisionConfig };
  }

  // Use saved prompts as-is (no legacy ID migration)
  const migratedPrompts = saved.prompts ?? [];

  // Merge prompts: ensure all built-in prompts exist, but PRESERVE user edits
  const builtInPromptIds = DEFAULT_TEXT_PROMPTS.map((p) => p.id);
  const savedPromptsById = new Map(migratedPrompts.map((p) => [p.id, p]));

  const mergedPrompts: AIPrompt[] = [];

  // Add built-in prompts (PRESERVE saved version if exists, only use default for missing prompts)
  for (const builtInPrompt of DEFAULT_TEXT_PROMPTS) {
    const savedVersion = savedPromptsById.get(builtInPrompt.id);
    if (savedVersion) {
      // PRESERVE user's edits - only ensure isBuiltIn and type flags are correct
      mergedPrompts.push({
        ...savedVersion,
        isBuiltIn: true,
        type: "text",
      });
      savedPromptsById.delete(builtInPrompt.id);
    } else {
      // Only use default if no saved version exists
      mergedPrompts.push({ ...builtInPrompt });
    }
  }

  // Add custom (non-built-in) prompts from saved state
  for (const [id, promptItem] of savedPromptsById) {
    if (!builtInPromptIds.includes(id)) {
      mergedPrompts.push({ ...promptItem, isBuiltIn: false });
    }
  }

  // Validate defaultPromptId - must exist
  const migratedDefaultId = saved.defaultPromptId ?? "builtin-text-cleanup";
  const validDefaultId = mergedPrompts.some((p) => p.id === migratedDefaultId)
    ? migratedDefaultId
    : "builtin-text-cleanup";

  const migratedQuickAccessIds = saved.quickAccessPromptIds ?? [];

  // Validate quickAccessPromptIds - filter out non-existent prompts
  const promptIds = new Set(mergedPrompts.map((p) => p.id));
  const validQuickAccessIds = migratedQuickAccessIds.filter((id) => promptIds.has(id));

  return {
    prompts: mergedPrompts,
    defaultPromptId: validDefaultId,
    quickAccessPromptIds:
      validQuickAccessIds.length > 0
        ? validQuickAccessIds
        : ["builtin-text-cleanup", "builtin-text-clarity"],
    selectedProviderId: saved.selectedProviderId,
    selectedModel: saved.selectedModel,
  };
}

// ==================== Helper Functions ====================

function generatePromptId(): string {
  return `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ==================== Slice Implementation ====================

export const createAIRevisionSlice = (set: StoreSetter, get: StoreGetter): AIRevisionSlice => ({
  // ==================== Revision Actions ====================

  startSingleRevision: (segmentId, promptId) => {
    const state = get();

    // Cancel any existing revision
    if (state.aiRevisionAbortController) {
      state.aiRevisionAbortController.abort();
    }

    const abortController = new AbortController();
    const segment = state.segments.find((s) => s.id === segmentId);

    if (!segment) {
      set({ aiRevisionError: `Segment ${segmentId} not found` });
      return;
    }

    const selectedPrompt = state.aiRevisionConfig.prompts.find((p) => p.id === promptId);
    if (!selectedPrompt) {
      set({ aiRevisionError: `Prompt ${promptId} not found` });
      return;
    }

    set({
      aiRevisionIsProcessing: true,
      aiRevisionCurrentSegmentId: segmentId,
      aiRevisionProcessedCount: 0,
      aiRevisionTotalToProcess: 1,
      aiRevisionError: null,
      aiRevisionAbortController: abortController,
    });

    // Find context segments
    const segmentIndex = state.segments.findIndex((s) => s.id === segmentId);
    const previousSegment = segmentIndex > 0 ? state.segments[segmentIndex - 1] : undefined;
    const nextSegment =
      segmentIndex < state.segments.length - 1 ? state.segments[segmentIndex + 1] : undefined;

    // Run revision asynchronously - dynamic import to avoid circular dependencies
    console.log("[AIRevision] Starting async import for segment:", segmentId);
    import("@/lib/ai/features/revision")
      .then(({ reviseSegment }) => {
        console.log("[AIRevision] Import successful, calling reviseSegment");
        return reviseSegment({
          segment,
          prompt: selectedPrompt,
          previousSegment,
          nextSegment,
          signal: abortController.signal,
          providerId: state.aiRevisionConfig.selectedProviderId,
          model: state.aiRevisionConfig.selectedModel,
        });
      })
      .then((result: RevisionResult) => {
        const currentState = get();
        if (!currentState.aiRevisionIsProcessing) return; // Cancelled

        // Check if the text is actually different
        const trimmedOriginal = segment.text.trim();
        const trimmedRevised = result.revisedText.trim();

        if (trimmedOriginal === trimmedRevised) {
          // No changes - don't create a suggestion, show "no changes" status
          console.log("[AIRevision] No changes needed for segment:", segmentId);
          set({
            aiRevisionIsProcessing: false,
            aiRevisionCurrentSegmentId: null,
            aiRevisionProcessedCount: 1,
            aiRevisionError: null,
            aiRevisionLastResult: {
              segmentId,
              status: "no-changes",
              message: "No changes needed",
              timestamp: Date.now(),
            },
          });
          return;
        }

        const suggestion: AIRevisionSuggestion = {
          segmentId,
          promptId,
          originalText: segment.text,
          revisedText: result.revisedText,
          status: "pending",
          changes: result.changes,
          changeSummary: result.changeSummary,
          reasoning: result.reasoning,
        };

        set({
          aiRevisionSuggestions: [...currentState.aiRevisionSuggestions, suggestion],
          aiRevisionIsProcessing: false,
          aiRevisionCurrentSegmentId: null,
          aiRevisionProcessedCount: 1,
          aiRevisionLastResult: {
            segmentId,
            status: "success",
            timestamp: Date.now(),
          },
        });
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        console.error("[AIRevision] Error in startSingleRevision:", error);
        const errorMessage = error.message ?? "Revision failed";
        set({
          aiRevisionError: errorMessage,
          aiRevisionIsProcessing: false,
          aiRevisionCurrentSegmentId: null,
          aiRevisionLastResult: {
            segmentId,
            status: "error",
            message: errorMessage,
            timestamp: Date.now(),
          },
        });
      });
  },

  startBatchRevision: (segmentIds, promptId) => {
    const state = get();

    // Cancel any existing revision
    if (state.aiRevisionAbortController) {
      state.aiRevisionAbortController.abort();
    }

    const abortController = new AbortController();
    const segments = state.segments.filter((s) => segmentIds.includes(s.id));

    if (segments.length === 0) {
      set({ aiRevisionError: "No segments found" });
      return;
    }

    const selectedPrompt = state.aiRevisionConfig.prompts.find((p) => p.id === promptId);
    if (!selectedPrompt) {
      set({ aiRevisionError: `Prompt ${promptId} not found` });
      return;
    }

    set({
      aiRevisionIsProcessing: true,
      aiRevisionProcessedCount: 0,
      aiRevisionTotalToProcess: segments.length,
      aiRevisionError: null,
      aiRevisionAbortController: abortController,
      aiRevisionBatchLog: [],
    });

    // Run batch revision asynchronously - dynamic import to avoid circular dependencies
    import("@/lib/ai/features/revision").then(({ reviseSegmentsBatch }) => {
      reviseSegmentsBatch({
        segments,
        allSegments: state.segments,
        prompt: selectedPrompt,
        signal: abortController.signal,
        providerId: state.aiRevisionConfig.selectedProviderId,
        model: state.aiRevisionConfig.selectedModel,
        onProgress: (processed: number, total: number) => {
          set({
            aiRevisionProcessedCount: processed,
            aiRevisionTotalToProcess: total,
          });
        },
        onItemComplete: (entry) => {
          const currentState = get();
          set({
            aiRevisionBatchLog: [...currentState.aiRevisionBatchLog, entry],
          });
        },
        onResult: (result: RevisionResult) => {
          const currentState = get();
          if (!currentState.aiRevisionIsProcessing) return; // Cancelled

          const segment = segments.find((s) => s.id === result.segmentId);
          if (!segment) return;

          // Check if the text is actually different
          const trimmedOriginal = segment.text.trim();
          const trimmedRevised = result.revisedText.trim();

          if (trimmedOriginal === trimmedRevised) {
            // No changes needed for this segment, skip creating suggestion
            console.log("[AIRevision] No changes needed for segment:", result.segmentId);
            return;
          }

          const suggestion: AIRevisionSuggestion = {
            segmentId: result.segmentId,
            promptId,
            originalText: segment.text,
            revisedText: result.revisedText,
            status: "pending",
            changes: result.changes,
            changeSummary: result.changeSummary,
            reasoning: result.reasoning,
          };

          set({
            aiRevisionSuggestions: [...currentState.aiRevisionSuggestions, suggestion],
          });
        },
      })
        .then(() => {
          set({ aiRevisionIsProcessing: false, aiRevisionCurrentSegmentId: null });
        })
        .catch((error: Error) => {
          if (error.name === "AbortError") return;
          set({
            aiRevisionError: error.message ?? "Batch revision failed",
            aiRevisionIsProcessing: false,
            aiRevisionCurrentSegmentId: null,
          });
        });
    });
  },

  cancelRevision: () => {
    const state = get();
    if (state.aiRevisionAbortController) {
      state.aiRevisionAbortController.abort();
    }
    set({
      aiRevisionIsProcessing: false,
      aiRevisionCurrentSegmentId: null,
      aiRevisionAbortController: null,
    });
  },

  acceptRevision: (segmentId) => {
    const state = get();
    const suggestion = state.aiRevisionSuggestions.find(
      (s) => s.segmentId === segmentId && s.status === "pending",
    );

    if (!suggestion) return;

    // Update segment text through the segments slice (includes history)
    state.updateSegmentText(segmentId, suggestion.revisedText);

    // Remove the suggestion from the list
    set({
      aiRevisionSuggestions: state.aiRevisionSuggestions.filter(
        (s) => !(s.segmentId === segmentId && s.status === "pending"),
      ),
    });
  },

  rejectRevision: (segmentId) => {
    const state = get();
    // Remove the suggestion from the list
    set({
      aiRevisionSuggestions: state.aiRevisionSuggestions.filter(
        (s) => !(s.segmentId === segmentId && s.status === "pending"),
      ),
    });
  },

  acceptAllRevisions: () => {
    const state = get();
    const pendingSuggestions = state.aiRevisionSuggestions.filter((s) => s.status === "pending");

    // Batch update all segment texts
    const updates = pendingSuggestions.map((s) => ({
      id: s.segmentId,
      text: s.revisedText,
    }));

    if (updates.length > 0) {
      state.updateSegmentsTexts(updates);
    }

    // Remove all pending suggestions
    set({
      aiRevisionSuggestions: state.aiRevisionSuggestions.filter((s) => s.status !== "pending"),
    });
  },

  rejectAllRevisions: () => {
    const state = get();
    // Remove all pending suggestions
    set({
      aiRevisionSuggestions: state.aiRevisionSuggestions.filter((s) => s.status !== "pending"),
    });
  },

  clearRevisions: () => {
    set({
      aiRevisionSuggestions: [],
      aiRevisionError: null,
    });
  },

  updateRevisionConfig: (config) => {
    const state = get();
    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        ...config,
      },
    });
  },

  // ==================== Prompt Management ====================

  addRevisionPrompt: (promptData) => {
    const state = get();
    const newPrompt: AIPrompt = {
      ...promptData,
      id: generatePromptId(),
      isBuiltIn: false, // Custom prompts are never built-in
    };

    const nextQuickAccessIds = promptData.quickAccess
      ? Array.from(new Set([...state.aiRevisionConfig.quickAccessPromptIds, newPrompt.id]))
      : state.aiRevisionConfig.quickAccessPromptIds;

    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        prompts: [...state.aiRevisionConfig.prompts, newPrompt],
        quickAccessPromptIds: nextQuickAccessIds,
      },
    });
  },

  updateRevisionPrompt: (id, updates) => {
    const state = get();
    let nextQuickAccessIds = state.aiRevisionConfig.quickAccessPromptIds;

    if (typeof updates.quickAccess === "boolean") {
      nextQuickAccessIds = updates.quickAccess
        ? Array.from(new Set([...nextQuickAccessIds, id]))
        : nextQuickAccessIds.filter((pid) => pid !== id);
    }

    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        prompts: state.aiRevisionConfig.prompts.map((p) =>
          p.id === id ? { ...p, ...updates, id, isBuiltIn: p.isBuiltIn } : p,
        ),
        quickAccessPromptIds: nextQuickAccessIds,
      },
    });
  },

  deleteRevisionPrompt: (id) => {
    const state = get();
    const promptItem = state.aiRevisionConfig.prompts.find((p) => p.id === id);

    // Cannot delete built-in prompts
    if (promptItem?.isBuiltIn) {
      console.warn("[AIRevision] Cannot delete built-in prompt:", id);
      return;
    }

    const updatedPrompts = state.aiRevisionConfig.prompts.filter((p) => p.id !== id);
    const updatedQuickAccess = state.aiRevisionConfig.quickAccessPromptIds.filter(
      (pid) => pid !== id,
    );

    // If deleted prompt was the default, reset to first available
    let newDefaultId = state.aiRevisionConfig.defaultPromptId;
    if (newDefaultId === id) {
      newDefaultId = updatedPrompts[0]?.id ?? null;
    }

    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        prompts: updatedPrompts,
        quickAccessPromptIds: updatedQuickAccess,
        defaultPromptId: newDefaultId,
      },
    });
  },

  setDefaultRevisionPrompt: (id) => {
    const state = get();
    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        defaultPromptId: id,
      },
    });
  },

  setQuickAccessPrompts: (ids) => {
    const state = get();
    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        quickAccessPromptIds: ids,
      },
    });
  },

  toggleQuickAccessPrompt: (id) => {
    const state = get();
    const currentIds = state.aiRevisionConfig.quickAccessPromptIds;
    const newIds = currentIds.includes(id)
      ? currentIds.filter((pid) => pid !== id)
      : [...currentIds, id];

    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        quickAccessPromptIds: newIds,
      },
    });
  },
});
