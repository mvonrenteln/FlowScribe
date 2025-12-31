/**
 * AI Revision Slice
 *
 * Zustand slice for managing AI text revision state, including
 * suggestions, processing status, and template configuration.
 *
 * Follows the "Custom First" principle - users can create their own
 * templates, and configure which are shown in quick-access menu.
 */

import type { StoreApi } from "zustand";
import type { RevisionResult } from "@/lib/services/aiRevisionService";
import type {
  AIRevisionConfig,
  AIRevisionSlice,
  AIRevisionSuggestion,
  AIRevisionTemplate,
  TranscriptStore,
} from "../types";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

// ==================== Default Templates (nicht löschbar, bearbeitbar) ====================

export const DEFAULT_REVISION_TEMPLATES: AIRevisionTemplate[] = [
  {
    id: "default-transcript-cleanup",
    name: "Transcript Cleanup",
    isDefault: true,
    isQuickAccess: true,
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
    id: "default-improve-clarity",
    name: "Improve Clarity",
    isDefault: true,
    isQuickAccess: true,
    systemPrompt: `You are an editor. Improve the phrasing of the given text.

TASKS:
1. Improve sentence structure
2. Simplify complex formulations
3. Fix grammar and spelling

RULES:
- Keep the meaning exactly the same
- Reply ONLY with the improved text, no explanations`,
    userPromptTemplate: `Improve the phrasing:

"{{text}}"`,
  },
  {
    id: "default-formalize",
    name: "Formalize",
    isDefault: true,
    isQuickAccess: false,
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
    templates: [...DEFAULT_REVISION_TEMPLATES],
    defaultTemplateId: "default-transcript-cleanup",
    quickAccessTemplateIds: ["default-transcript-cleanup", "default-improve-clarity"],
  } as AIRevisionConfig,
  aiRevisionError: null as string | null,
  aiRevisionAbortController: null as AbortController | null,
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
 * Ensures default templates are always present and cannot be removed.
 */
export function normalizeAIRevisionConfig(saved?: AIRevisionConfig | null): AIRevisionConfig {
  if (!saved) {
    return { ...initialAIRevisionState.aiRevisionConfig };
  }

  // Merge templates: ensure all default templates exist with updated prompts if edited
  const defaultTemplateIds = DEFAULT_REVISION_TEMPLATES.map((t) => t.id);
  const savedTemplatesById = new Map(saved.templates?.map((t) => [t.id, t]) ?? []);

  const mergedTemplates: AIRevisionTemplate[] = [];

  // Add default templates (use saved version if exists, otherwise use default)
  for (const defaultTemplate of DEFAULT_REVISION_TEMPLATES) {
    const savedVersion = savedTemplatesById.get(defaultTemplate.id);
    if (savedVersion) {
      // Use saved version but ensure isDefault flag is preserved
      mergedTemplates.push({ ...savedVersion, isDefault: true });
      savedTemplatesById.delete(defaultTemplate.id);
    } else {
      mergedTemplates.push({ ...defaultTemplate });
    }
  }

  // Add custom (non-default) templates from saved state
  for (const [id, template] of savedTemplatesById) {
    if (!defaultTemplateIds.includes(id)) {
      mergedTemplates.push({ ...template, isDefault: false });
    }
  }

  // Validate defaultTemplateId - must exist
  const validDefaultId = mergedTemplates.some((t) => t.id === saved.defaultTemplateId)
    ? saved.defaultTemplateId
    : "default-transcript-cleanup";

  // Validate quickAccessTemplateIds - filter out non-existent templates
  const templateIds = new Set(mergedTemplates.map((t) => t.id));
  const validQuickAccessIds = (saved.quickAccessTemplateIds ?? []).filter((id) =>
    templateIds.has(id),
  );

  return {
    templates: mergedTemplates,
    defaultTemplateId: validDefaultId,
    quickAccessTemplateIds:
      validQuickAccessIds.length > 0
        ? validQuickAccessIds
        : ["default-transcript-cleanup", "default-improve-clarity"],
  };
}

// ==================== Helper Functions ====================

function generateTemplateId(): string {
  return `template-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ==================== Slice Implementation ====================

export const createAIRevisionSlice = (set: StoreSetter, get: StoreGetter): AIRevisionSlice => ({
  // ==================== Revision Actions ====================

  startSingleRevision: (segmentId, templateId) => {
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

    const template = state.aiRevisionConfig.templates.find((t) => t.id === templateId);
    if (!template) {
      set({ aiRevisionError: `Template ${templateId} not found` });
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
    import("@/lib/services/aiRevisionService").then(({ runRevision }) => {
      runRevision({
        segment,
        template,
        previousSegment,
        nextSegment,
        signal: abortController.signal,
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
            templateId,
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
          const errorMessage = error.message ?? "Revision fehlgeschlagen";
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
    });
  },

  startBatchRevision: (segmentIds, templateId) => {
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

    const template = state.aiRevisionConfig.templates.find((t) => t.id === templateId);
    if (!template) {
      set({ aiRevisionError: `Template ${templateId} not found` });
      return;
    }

    set({
      aiRevisionIsProcessing: true,
      aiRevisionProcessedCount: 0,
      aiRevisionTotalToProcess: segments.length,
      aiRevisionError: null,
      aiRevisionAbortController: abortController,
    });

    // Run batch revision asynchronously - dynamic import to avoid circular dependencies
    import("@/lib/services/aiRevisionService").then(({ runBatchRevision }) => {
      runBatchRevision({
        segments,
        allSegments: state.segments,
        template,
        signal: abortController.signal,
        onProgress: (processed: number, total: number) => {
          set({
            aiRevisionProcessedCount: processed,
            aiRevisionTotalToProcess: total,
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
            templateId,
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

  // ==================== Template Management ====================

  addRevisionTemplate: (template) => {
    const state = get();
    const newTemplate: AIRevisionTemplate = {
      ...template,
      id: generateTemplateId(),
      isDefault: false, // Custom templates are never default
    };

    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        templates: [...state.aiRevisionConfig.templates, newTemplate],
      },
    });
  },

  updateRevisionTemplate: (id, updates) => {
    const state = get();
    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        templates: state.aiRevisionConfig.templates.map((t) =>
          t.id === id ? { ...t, ...updates, id, isDefault: t.isDefault } : t,
        ),
      },
    });
  },

  deleteRevisionTemplate: (id) => {
    const state = get();
    const template = state.aiRevisionConfig.templates.find((t) => t.id === id);

    // Cannot delete default templates
    if (template?.isDefault) {
      console.warn("[AIRevision] Cannot delete default template:", id);
      return;
    }

    const updatedTemplates = state.aiRevisionConfig.templates.filter((t) => t.id !== id);
    const updatedQuickAccess = state.aiRevisionConfig.quickAccessTemplateIds.filter(
      (tid) => tid !== id,
    );

    // If deleted template was the default, reset to first available
    let newDefaultId = state.aiRevisionConfig.defaultTemplateId;
    if (newDefaultId === id) {
      newDefaultId = updatedTemplates[0]?.id ?? null;
    }

    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        templates: updatedTemplates,
        quickAccessTemplateIds: updatedQuickAccess,
        defaultTemplateId: newDefaultId,
      },
    });
  },

  setDefaultRevisionTemplate: (id) => {
    const state = get();
    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        defaultTemplateId: id,
      },
    });
  },

  setQuickAccessTemplates: (ids) => {
    const state = get();
    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        quickAccessTemplateIds: ids,
      },
    });
  },

  toggleQuickAccessTemplate: (id) => {
    const state = get();
    const currentIds = state.aiRevisionConfig.quickAccessTemplateIds;
    const newIds = currentIds.includes(id)
      ? currentIds.filter((tid) => tid !== id)
      : [...currentIds, id];

    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        quickAccessTemplateIds: newIds,
      },
    });
  },
});
