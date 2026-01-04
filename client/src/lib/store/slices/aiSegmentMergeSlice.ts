/**
 * AI Segment Merge Slice
 *
 * Zustand slice for managing AI segment merge suggestion state,
 * including suggestions, processing status, and configuration.
 *
 * Follows the "Manual-First" principle - manual merging is always available,
 * AI suggestions are an optional enhancement.
 */

import type { StoreApi } from "zustand";
import type { MergeAnalysisResult, MergeSuggestion } from "@/lib/ai/features/segmentMerge";
import type {
  AISegmentMergeConfig,
  AISegmentMergeSlice,
  AISegmentMergeSuggestion,
  Segment,
  TranscriptStore,
} from "../types";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

// ==================== Constants ====================

export const DEFAULT_SEGMENT_MERGE_CONFIG: AISegmentMergeConfig = {
  defaultMaxTimeGap: 2.0,
  defaultMinConfidence: "medium",
  defaultEnableSmoothing: true,
  showInlineHints: true,
  batchSize: 20,
};

export const initialAISegmentMergeState = {
  aiSegmentMergeSuggestions: [] as AISegmentMergeSuggestion[],
  aiSegmentMergeIsProcessing: false,
  aiSegmentMergeProcessedCount: 0,
  aiSegmentMergeTotalToProcess: 0,
  aiSegmentMergeConfig: { ...DEFAULT_SEGMENT_MERGE_CONFIG },
  aiSegmentMergeError: null as string | null,
  aiSegmentMergeAbortController: null as AbortController | null,
};

// ==================== Helper Functions ====================

/**
 * Convert store segment to merge analysis segment.
 */
function toMergeAnalysisSegment(segment: Segment) {
  return {
    id: segment.id,
    text: segment.text,
    speaker: segment.speaker,
    start: segment.start,
    end: segment.end,
  };
}

/**
 * Convert AI suggestion to store suggestion.
 */
function toStoreSuggestion(suggestion: MergeSuggestion): AISegmentMergeSuggestion {
  return {
    id: suggestion.id,
    segmentIds: suggestion.segmentIds,
    confidence: suggestion.confidence,
    confidenceScore: suggestion.confidenceScore,
    reason: suggestion.reason,
    status: suggestion.status,
    mergedText: suggestion.mergedText,
    smoothedText: suggestion.smoothing?.smoothedText,
    smoothingChanges: suggestion.smoothing?.changes,
    timeRange: suggestion.timeRange,
    speaker: suggestion.speaker,
    timeGap: suggestion.timeGap,
  };
}

// ==================== Slice Implementation ====================

export const createAISegmentMergeSlice = (
  set: StoreSetter,
  get: StoreGetter,
): AISegmentMergeSlice => ({
  startMergeAnalysis: (options) => {
    const state = get();

    // Cancel any existing analysis
    if (state.aiSegmentMergeAbortController) {
      state.aiSegmentMergeAbortController.abort();
    }

    const abortController = new AbortController();
    const config = state.aiSegmentMergeConfig;

    // Determine which segments to analyze
    let segmentsToAnalyze = state.segments;
    if (options.segmentIds && options.segmentIds.length > 0) {
      segmentsToAnalyze = state.segments.filter((s) => options.segmentIds?.includes(s.id));
    }

    if (segmentsToAnalyze.length < 2) {
      set({ aiSegmentMergeError: "At least 2 segments required for merge analysis" });
      return;
    }

    set({
      aiSegmentMergeIsProcessing: true,
      aiSegmentMergeProcessedCount: 0,
      aiSegmentMergeTotalToProcess: segmentsToAnalyze.length - 1,
      aiSegmentMergeError: null,
      aiSegmentMergeAbortController: abortController,
      aiSegmentMergeSuggestions: [], // Clear previous suggestions
    });

    // Prepare analysis parameters
    const analysisParams = {
      segments: segmentsToAnalyze.map(toMergeAnalysisSegment),
      maxTimeGap: options.maxTimeGap ?? config.defaultMaxTimeGap,
      minConfidence: options.minConfidence ?? config.defaultMinConfidence,
      sameSpeakerOnly: options.sameSpeakerOnly ?? true,
      enableSmoothing: options.enableSmoothing ?? config.defaultEnableSmoothing,
      signal: abortController.signal,
    };

    // Run analysis asynchronously - dynamic import to avoid circular dependencies
    console.log("[AISegmentMerge] Starting analysis for", segmentsToAnalyze.length, "segments");
    import("@/lib/ai/features/segmentMerge")
      .then(({ analyzeMergeCandidates }) => {
        console.log("[AISegmentMerge] Import successful, calling analyzeMergeCandidates");
        return analyzeMergeCandidates(analysisParams);
      })
      .then((result: MergeAnalysisResult) => {
        const currentState = get();
        if (!currentState.aiSegmentMergeIsProcessing) return; // Cancelled

        const storeSuggestions = result.suggestions.map(toStoreSuggestion);

        console.log("[AISegmentMerge] Analysis complete:", {
          found: result.summary.found,
          byConfidence: result.summary.byConfidence,
        });

        set({
          aiSegmentMergeSuggestions: storeSuggestions,
          aiSegmentMergeIsProcessing: false,
          aiSegmentMergeProcessedCount: result.summary.analyzed,
          aiSegmentMergeError:
            result.issues.length > 0 ? result.issues.map((i) => i.message).join("; ") : null,
        });
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        console.error("[AISegmentMerge] Analysis error:", error);
        set({
          aiSegmentMergeError: error.message ?? "Analysis failed",
          aiSegmentMergeIsProcessing: false,
        });
      });
  },

  cancelMergeAnalysis: () => {
    const state = get();
    if (state.aiSegmentMergeAbortController) {
      state.aiSegmentMergeAbortController.abort();
    }
    set({
      aiSegmentMergeIsProcessing: false,
      aiSegmentMergeAbortController: null,
    });
  },

  acceptMergeSuggestion: (suggestionId) => {
    const state = get();
    const suggestion = state.aiSegmentMergeSuggestions.find((s) => s.id === suggestionId);

    if (!suggestion || suggestion.status !== "pending") {
      return;
    }

    // Perform the actual merge using the existing mergeSegments function
    const [firstSegmentId, secondSegmentId] = suggestion.segmentIds;

    if (firstSegmentId && secondSegmentId) {
      // Use the store's merge function
      const mergedId = state.mergeSegments(firstSegmentId, secondSegmentId);

      if (mergedId) {
        // If smoothing was applied, update the merged segment text
        if (suggestion.smoothedText && suggestion.smoothedText !== suggestion.mergedText) {
          state.updateSegmentText(mergedId, suggestion.smoothedText);
        }

        // Mark suggestion as accepted
        set({
          aiSegmentMergeSuggestions: state.aiSegmentMergeSuggestions.map((s) =>
            s.id === suggestionId ? { ...s, status: "accepted" as const } : s,
          ),
        });
      }
    }
  },

  rejectMergeSuggestion: (suggestionId) => {
    const state = get();
    set({
      aiSegmentMergeSuggestions: state.aiSegmentMergeSuggestions.map((s) =>
        s.id === suggestionId ? { ...s, status: "rejected" as const } : s,
      ),
    });
  },

  acceptAllHighConfidence: () => {
    const state = get();
    const highConfidenceSuggestions = state.aiSegmentMergeSuggestions.filter(
      (s) => s.status === "pending" && s.confidence === "high",
    );

    // Process suggestions in order (important: after a merge, segment IDs may change)
    for (const suggestion of highConfidenceSuggestions) {
      // Re-check if the suggestion is still valid (segments exist)
      const currentState = get();
      const segmentsExist = suggestion.segmentIds.every((id) =>
        currentState.segments.some((s) => s.id === id),
      );

      if (segmentsExist) {
        currentState.acceptMergeSuggestion(suggestion.id);
      } else {
        // Mark as rejected if segments no longer exist
        set({
          aiSegmentMergeSuggestions: currentState.aiSegmentMergeSuggestions.map((s) =>
            s.id === suggestion.id ? { ...s, status: "rejected" as const } : s,
          ),
        });
      }
    }
  },

  rejectAllSuggestions: () => {
    const state = get();
    set({
      aiSegmentMergeSuggestions: state.aiSegmentMergeSuggestions.map((s) =>
        s.status === "pending" ? { ...s, status: "rejected" as const } : s,
      ),
    });
  },

  clearMergeSuggestions: () => {
    set({
      aiSegmentMergeSuggestions: [],
      aiSegmentMergeError: null,
    });
  },

  updateMergeConfig: (configUpdate) => {
    const state = get();
    set({
      aiSegmentMergeConfig: {
        ...state.aiSegmentMergeConfig,
        ...configUpdate,
      },
    });
  },
});
