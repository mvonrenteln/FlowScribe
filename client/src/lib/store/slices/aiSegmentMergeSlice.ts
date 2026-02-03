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
import { buildSuggestionKeySet, createMergePairKey } from "@/lib/ai/core/suggestionKeys";
import type {
  MergeAnalysisResult,
  MergeBatchLogEntry,
  MergeSuggestion,
} from "@/lib/ai/features/segmentMerge";
import { indexById } from "@/lib/arrayUtils";
import type {
  AIPrompt,
  AISegmentMergeSlice,
  AISegmentMergeSuggestion,
  Segment,
  TranscriptStore,
} from "../types";
import { normalizeAISegmentMergeConfig } from "../utils/aiSegmentMergeConfig";
import { generateId } from "../utils/id";
import { applyTextUpdateToSegment } from "../utils/segmentText";
import { addToHistory } from "./historySlice";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

// ==================== Initial State ====================

export const initialAISegmentMergeState = {
  aiSegmentMergeSuggestions: [] as AISegmentMergeSuggestion[],
  aiSegmentMergeIsProcessing: false,
  aiSegmentMergeProcessedCount: 0,
  aiSegmentMergeTotalToProcess: 0,
  aiSegmentMergeConfig: normalizeAISegmentMergeConfig(),
  aiSegmentMergeError: null as string | null,
  aiSegmentMergeAbortController: null as AbortController | null,
  aiSegmentMergeBatchLog: [] as MergeBatchLogEntry[],
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

interface MergeApplyResult {
  segments: Segment[];
  mergedId: string;
  removedIds: [string, string];
  scoresChanged: boolean;
}

const buildMergedSegment = (first: Segment, second: Segment) => ({
  id: generateId(),
  speaker: first.speaker,
  tags: Array.from(new Set([...(first.tags ?? []), ...(second.tags ?? [])])),
  start: first.start,
  end: second.end,
  text: `${first.text} ${second.text}`,
  words: [...first.words, ...second.words],
});

const applyMergeToSegments = (
  segments: Segment[],
  suggestion: AISegmentMergeSuggestion,
  applySmoothing: boolean,
): MergeApplyResult | null => {
  const [firstSegmentId, secondSegmentId] = suggestion.segmentIds;
  if (!firstSegmentId || !secondSegmentId) return null;

  const indexByIdMap = indexById(segments);
  const index1 = indexByIdMap.get(firstSegmentId) ?? -1;
  const index2 = indexByIdMap.get(secondSegmentId) ?? -1;
  if (index1 === -1 || index2 === -1) return null;
  if (Math.abs(index1 - index2) !== 1) return null;

  const [first, second] =
    index1 < index2 ? [segments[index1], segments[index2]] : [segments[index2], segments[index1]];

  const mergedBase = buildMergedSegment(first, second);
  const mergedText =
    applySmoothing && suggestion.smoothedText ? suggestion.smoothedText : suggestion.mergedText;
  const scoresChanged = mergedText.trim() !== mergedBase.text;
  const mergedSegment = applyTextUpdateToSegment(mergedBase, mergedText) ?? mergedBase;

  const minIndex = Math.min(index1, index2);
  const nextSegments = [
    ...segments.slice(0, minIndex),
    mergedSegment,
    ...segments.slice(Math.max(index1, index2) + 1),
  ];

  return {
    segments: nextSegments,
    mergedId: mergedSegment.id,
    removedIds: [first.id, second.id],
    scoresChanged,
  };
};

const isSuggestionInvalid = (suggestion: AISegmentMergeSuggestion, invalidIds: Set<string>) =>
  suggestion.segmentIds.some((id) => Boolean(id) && invalidIds.has(id));

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

    const existingPairKeys = buildSuggestionKeySet(state.aiSegmentMergeSuggestions, (suggestion) =>
      createMergePairKey(suggestion.segmentIds),
    );

    set({
      aiSegmentMergeIsProcessing: true,
      aiSegmentMergeProcessedCount: 0,
      aiSegmentMergeTotalToProcess: segmentsToAnalyze.length - 1,
      aiSegmentMergeError: null,
      aiSegmentMergeAbortController: abortController,
      aiSegmentMergeBatchLog: [],
    });

    // Prepare analysis parameters
    const activePrompt = config.prompts.find((p) => p.id === config.activePromptId);
    const analysisParams = {
      segments: segmentsToAnalyze.map(toMergeAnalysisSegment),
      maxTimeGap: options.maxTimeGap ?? config.defaultMaxTimeGap,
      minConfidence: options.minConfidence ?? config.defaultMinConfidence,
      sameSpeakerOnly: options.sameSpeakerOnly ?? true,
      enableSmoothing: options.enableSmoothing ?? config.defaultEnableSmoothing,
      batchSize: options.batchSize ?? 10,
      providerId: options.providerId ?? config.selectedProviderId,
      model: options.model ?? config.selectedModel,
      skipPairKeys: existingPairKeys,
      signal: abortController.signal,
      systemPrompt: activePrompt?.systemPrompt,
      userTemplate: activePrompt?.userPromptTemplate,
      onProgress: (progress: {
        batchIndex: number;
        totalBatches: number;
        batchSuggestions: MergeSuggestion[];
        processedCount: number;
        batchLogEntry?: MergeBatchLogEntry;
      }) => {
        // Update UI after each batch
        const currentState = get();
        const currentSuggestions = currentState.aiSegmentMergeSuggestions;
        const existingKeys = buildSuggestionKeySet(currentSuggestions, (suggestion) =>
          createMergePairKey(suggestion.segmentIds),
        );
        const newSuggestions = progress.batchSuggestions
          .map(toStoreSuggestion)
          .filter((suggestion) => !existingKeys.has(createMergePairKey(suggestion.segmentIds)));
        const nextBatchLog = progress.batchLogEntry
          ? [
              ...currentState.aiSegmentMergeBatchLog,
              { ...progress.batchLogEntry, loggedAt: Date.now() },
            ]
          : currentState.aiSegmentMergeBatchLog;

        set({
          aiSegmentMergeSuggestions: [...currentSuggestions, ...newSuggestions],
          aiSegmentMergeProcessedCount: progress.processedCount,
          aiSegmentMergeTotalToProcess: segmentsToAnalyze.length - 1,
          aiSegmentMergeBatchLog: nextBatchLog,
        });

        console.log(
          `[AISegmentMerge] Batch ${progress.batchIndex}/${progress.totalBatches} complete:`,
          {
            batchSuggestions: progress.batchSuggestions.length,
            totalSuggestions: currentSuggestions.length + newSuggestions.length,
          },
        );
      },
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

        console.log("[AISegmentMerge] Full analysis result:", result);
        if (result.issues && result.issues.length > 0) {
          console.warn("[AISegmentMerge] Analysis issues:", result.issues);
        }

        const storeSuggestions = result.suggestions.map(toStoreSuggestion);
        const existingKeys = buildSuggestionKeySet(
          currentState.aiSegmentMergeSuggestions,
          (suggestion) => createMergePairKey(suggestion.segmentIds),
        );
        const newSuggestions = storeSuggestions.filter(
          (suggestion) => !existingKeys.has(createMergePairKey(suggestion.segmentIds)),
        );

        console.log("[AISegmentMerge] Analysis complete:", {
          found: result.summary.found,
          byConfidence: result.summary.byConfidence,
        });

        set({
          aiSegmentMergeSuggestions: [...currentState.aiSegmentMergeSuggestions, ...newSuggestions],
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

  acceptMergeSuggestion: (suggestionId, options) => {
    const state = get();
    const suggestion = state.aiSegmentMergeSuggestions.find((s) => s.id === suggestionId);

    if (suggestion?.status !== "pending") {
      return;
    }

    const applySmoothing = options?.applySmoothing ?? true;
    const mergeResult = applyMergeToSegments(state.segments, suggestion, applySmoothing);
    if (!mergeResult) {
      set({
        aiSegmentMergeSuggestions: state.aiSegmentMergeSuggestions.map((s) =>
          s.id === suggestionId ? { ...s, status: "rejected" as const } : s,
        ),
      });
      return;
    }

    const invalidSegmentIds = new Set<string>(mergeResult.removedIds);
    const nextSelectedSegmentId =
      state.selectedSegmentId && !invalidSegmentIds.has(state.selectedSegmentId)
        ? state.selectedSegmentId
        : mergeResult.mergedId;

    const nextConfidenceScoresVersion = mergeResult.scoresChanged
      ? state.confidenceScoresVersion + 1
      : state.confidenceScoresVersion;
    const nextHistory = addToHistory(state.history, state.historyIndex, {
      segments: mergeResult.segments,
      speakers: state.speakers,
      selectedSegmentId: nextSelectedSegmentId,
      selectedChapterId: state.selectedChapterId,
      currentTime: state.currentTime,
      tags: state.tags,
      chapters: state.chapters,
      confidenceScoresVersion: nextConfidenceScoresVersion,
    });

    set({
      segments: mergeResult.segments,
      selectedSegmentId: nextSelectedSegmentId,
      confidenceScoresVersion: nextConfidenceScoresVersion,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
      aiSegmentMergeSuggestions: state.aiSegmentMergeSuggestions.map((s) => {
        if (s.id === suggestionId) {
          return { ...s, status: "accepted" as const };
        }
        if (s.status === "pending" && isSuggestionInvalid(s, invalidSegmentIds)) {
          return { ...s, status: "rejected" as const };
        }
        return s;
      }),
    });
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

    if (highConfidenceSuggestions.length === 0) return;

    let workingSegments = state.segments;
    let updatedSuggestions = state.aiSegmentMergeSuggestions.map((s) => ({ ...s }));
    const suggestionIndexById = new Map(updatedSuggestions.map((s, i) => [s.id, i]));
    const invalidSegmentIds = new Set<string>();
    let nextSelectedSegmentId = state.selectedSegmentId;
    let mergedAny = false;
    let scoresChanged = false;

    for (const suggestion of highConfidenceSuggestions) {
      const suggestionIndex = suggestionIndexById.get(suggestion.id) ?? -1;
      if (suggestionIndex === -1) continue;

      if (updatedSuggestions[suggestionIndex]?.status !== "pending") continue;
      if (isSuggestionInvalid(suggestion, invalidSegmentIds)) {
        updatedSuggestions[suggestionIndex] = { ...suggestion, status: "rejected" as const };
        continue;
      }

      const mergeResult = applyMergeToSegments(workingSegments, suggestion, true);
      if (!mergeResult) {
        updatedSuggestions[suggestionIndex] = { ...suggestion, status: "rejected" as const };
        continue;
      }

      mergedAny = true;
      workingSegments = mergeResult.segments;
      scoresChanged = scoresChanged || mergeResult.scoresChanged;
      invalidSegmentIds.add(mergeResult.removedIds[0]);
      invalidSegmentIds.add(mergeResult.removedIds[1]);

      if (nextSelectedSegmentId && invalidSegmentIds.has(nextSelectedSegmentId)) {
        nextSelectedSegmentId = mergeResult.mergedId;
      }

      updatedSuggestions = updatedSuggestions.map((current) => {
        if (current.id === suggestion.id) {
          return { ...current, status: "accepted" as const };
        }
        if (current.status === "pending" && isSuggestionInvalid(current, invalidSegmentIds)) {
          return { ...current, status: "rejected" as const };
        }
        return current;
      });
    }

    const finalSelectedSegmentId =
      nextSelectedSegmentId && workingSegments.some((s) => s.id === nextSelectedSegmentId)
        ? nextSelectedSegmentId
        : (workingSegments[0]?.id ?? null);

    if (mergedAny) {
      const nextConfidenceScoresVersion = scoresChanged
        ? state.confidenceScoresVersion + 1
        : state.confidenceScoresVersion;
      const nextHistory = addToHistory(state.history, state.historyIndex, {
        segments: workingSegments,
        speakers: state.speakers,
        selectedSegmentId: finalSelectedSegmentId,
        selectedChapterId: state.selectedChapterId,
        currentTime: state.currentTime,
        tags: state.tags,
        chapters: state.chapters,
        confidenceScoresVersion: nextConfidenceScoresVersion,
      });

      set({
        segments: workingSegments,
        selectedSegmentId: finalSelectedSegmentId,
        confidenceScoresVersion: nextConfidenceScoresVersion,
        history: nextHistory.history,
        historyIndex: nextHistory.historyIndex,
        aiSegmentMergeSuggestions: updatedSuggestions,
      });
      return;
    }

    set({ aiSegmentMergeSuggestions: updatedSuggestions });
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
      aiSegmentMergeConfig: normalizeAISegmentMergeConfig({
        ...state.aiSegmentMergeConfig,
        ...configUpdate,
      }),
    });
  },

  addSegmentMergePrompt: (promptData) => {
    const { aiSegmentMergeConfig } = get();
    const newPrompt: AIPrompt = {
      ...promptData,
      id: generateId(),
    };
    set({
      aiSegmentMergeConfig: normalizeAISegmentMergeConfig({
        ...aiSegmentMergeConfig,
        prompts: [...aiSegmentMergeConfig.prompts, newPrompt],
      }),
    });
  },

  updateSegmentMergePrompt: (id, updates) => {
    const { aiSegmentMergeConfig } = get();
    set({
      aiSegmentMergeConfig: normalizeAISegmentMergeConfig({
        ...aiSegmentMergeConfig,
        prompts: aiSegmentMergeConfig.prompts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      }),
    });
  },

  deleteSegmentMergePrompt: (id) => {
    const { aiSegmentMergeConfig } = get();
    // Cannot delete built-in prompts
    const promptToDelete = aiSegmentMergeConfig.prompts.find((p) => p.id === id);
    if (promptToDelete?.isBuiltIn) return;

    const newPrompts = aiSegmentMergeConfig.prompts.filter((p) => p.id !== id);

    set({
      aiSegmentMergeConfig: normalizeAISegmentMergeConfig({
        ...aiSegmentMergeConfig,
        prompts: newPrompts,
        activePromptId:
          aiSegmentMergeConfig.activePromptId === id
            ? (aiSegmentMergeConfig.prompts.find((p) => p.isBuiltIn)?.id ?? newPrompts[0]?.id ?? "")
            : aiSegmentMergeConfig.activePromptId,
      }),
    });
  },

  setActiveSegmentMergePrompt: (id) => {
    const { aiSegmentMergeConfig } = get();
    set({
      aiSegmentMergeConfig: normalizeAISegmentMergeConfig({
        ...aiSegmentMergeConfig,
        activePromptId: id,
      }),
    });
  },
});
