/**
 * AI Speaker Slice
 *
 * Zustand slice for managing AI speaker suggestion state, including
 * suggestions, processing status, configuration, and AI prompts.
 */

import type { StoreApi } from "zustand";
import { summarizeAIError } from "@/lib/ai/core/errors";
import { summarizeMessages } from "@/lib/ai/core/formatting";
import { runAnalysis } from "@/lib/ai/features/speaker";

import type {
  AIPrompt,
  AISpeakerBatchInsight,
  AISpeakerSlice,
  AISpeakerSuggestion,
  TranscriptStore,
} from "../types";
import { normalizeAISpeakerConfig } from "../utils/aiSpeakerConfig";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

// ==================== Initial State ====================

export const initialAISpeakerState = {
  aiSpeakerSuggestions: [] as AISpeakerSuggestion[],
  aiSpeakerIsProcessing: false,
  aiSpeakerProcessedCount: 0,
  aiSpeakerTotalToProcess: 0,
  aiSpeakerConfig: normalizeAISpeakerConfig(),
  aiSpeakerError: null as string | null,
  aiSpeakerAbortController: null as AbortController | null,
  aiSpeakerBatchInsights: [] as AISpeakerBatchInsight[],
  aiSpeakerDiscrepancyNotice: null as string | null,
  aiSpeakerBatchLog: [] as AISpeakerBatchInsight[],
};

// ==================== Slice Implementation ====================

export const createAISpeakerSlice = (set: StoreSetter, get: StoreGetter): AISpeakerSlice => ({
  // Actions only - state is in InitialStoreState with aiSpeaker* prefix
  startAnalysis: (selectedSpeakers, excludeConfirmed) => {
    const state = get();

    // Cancel any existing analysis
    if (state.aiSpeakerAbortController) {
      state.aiSpeakerAbortController.abort();
    }

    const abortController = new AbortController();

    // Filter segments to get count
    const segmentsToAnalyze = state.segments.filter((segment) => {
      if (excludeConfirmed && segment.confirmed) return false;
      if (selectedSpeakers.length > 0) {
        return selectedSpeakers.some((s) => s.toLowerCase() === segment.speaker.toLowerCase());
      }
      return true;
    });

    set({
      aiSpeakerIsProcessing: true,
      aiSpeakerProcessedCount: 0,
      aiSpeakerTotalToProcess: segmentsToAnalyze.length,
      aiSpeakerError: null,
      aiSpeakerAbortController: abortController,
      aiSpeakerBatchInsights: [],
      aiSpeakerDiscrepancyNotice: null,
      aiSpeakerBatchLog: [],
    });

    // Run analysis asynchronously
    runAnalysis({
      segments: state.segments,
      speakers: state.speakers.map((s) => s.name),
      config: state.aiSpeakerConfig,
      selectedSpeakers,
      excludeConfirmed,
      signal: abortController.signal,
      onProgress: (processed, total) => {
        set({
          aiSpeakerProcessedCount: processed,
          aiSpeakerTotalToProcess: total,
        });
      },
      onBatchComplete: (suggestions) => {
        const stateSnapshot = get();
        if (!stateSnapshot.aiSpeakerIsProcessing) {
          return;
        }
        set({
          aiSpeakerSuggestions: [...stateSnapshot.aiSpeakerSuggestions, ...suggestions],
        });
      },
      onBatchInfo: (insight) => {
        const stateSnapshot = get();
        const entry = { ...insight, loggedAt: Date.now() } as AISpeakerBatchInsight;
        const updatedInsights = [...stateSnapshot.aiSpeakerBatchInsights, entry];
        const updatedLog = [...stateSnapshot.aiSpeakerBatchLog, entry];
        let discrepancyNotice = stateSnapshot.aiSpeakerDiscrepancyNotice;
        if (insight.fatal) {
          const summary = summarizeMessages(insight.issues);
          discrepancyNotice = `Batch ${insight.batchIndex + 1} failed: ${summary || "unknown"}. See batch log.`;
        } else if (insight.ignoredCount && insight.ignoredCount > 0) {
          const returned = insight.rawItemCount;
          const expected = insight.batchSize;
          const used = Math.min(returned, expected);
          const ignored = insight.ignoredCount ?? 0;
          const summary = summarizeMessages(insight.issues);
          discrepancyNotice = `Batch ${insight.batchIndex + 1}: model returned ${returned} (expected ${expected}, used ${used}, ignored ${ignored}). ${summary ? `Issues: ${summary}.` : ""} See batch log.`;
        } else if (insight.rawItemCount < insight.batchSize) {
          const summary = summarizeMessages(insight.issues);
          discrepancyNotice = `Batch ${insight.batchIndex + 1}: model returned only ${insight.rawItemCount} of ${insight.batchSize} expected entries. ${summary ? `Issues: ${summary}.` : ""} See batch log.`;
        }
        set({
          aiSpeakerBatchInsights: updatedInsights,
          aiSpeakerBatchLog: updatedLog,
          aiSpeakerDiscrepancyNotice: discrepancyNotice,
        });
      },
      onError: (error) => {
        set({
          aiSpeakerError: summarizeAIError(error),
          aiSpeakerIsProcessing: false,
        });
      },
    }).finally(() => {
      // Only update if not aborted
      if (!abortController.signal.aborted) {
        set({ aiSpeakerIsProcessing: false });
      }
    });
  },

  cancelAnalysis: () => {
    const { aiSpeakerAbortController } = get();
    if (aiSpeakerAbortController) {
      aiSpeakerAbortController.abort();
    }
    // Keep existing suggestions, just stop processing
    set({
      aiSpeakerIsProcessing: false,
      aiSpeakerAbortController: null,
    });
  },

  addSuggestions: (suggestions) => {
    const current = get().aiSpeakerSuggestions;
    set({ aiSpeakerSuggestions: [...current, ...suggestions] });
  },

  acceptSuggestion: (segmentId) => {
    const { aiSpeakerSuggestions, speakers, updateSegmentSpeaker, addSpeaker } = get();
    const suggestion = aiSpeakerSuggestions.find((s) => s.segmentId === segmentId);

    if (suggestion) {
      // Check if the suggested speaker exists, if not create it
      const speakerExists = speakers.some(
        (s) => s.name.toLowerCase() === suggestion.suggestedSpeaker.toLowerCase(),
      );

      if (!speakerExists) {
        // Create new speaker with a random color
        addSpeaker(suggestion.suggestedSpeaker);
      }

      // Update the segment speaker
      updateSegmentSpeaker(segmentId, suggestion.suggestedSpeaker);

      // Update suggestion status
      set({
        aiSpeakerSuggestions: aiSpeakerSuggestions.map((s) =>
          s.segmentId === segmentId ? { ...s, status: "accepted" as const } : s,
        ),
      });
    }
  },

  acceptManySuggestions: (segmentIds) => {
    const { aiSpeakerSuggestions, speakers, segments, addSpeaker } = get();

    // Collect all suggestions to accept
    const suggestionsToAccept = aiSpeakerSuggestions.filter(
      (s) => segmentIds.includes(s.segmentId) && s.status === "pending",
    );

    if (suggestionsToAccept.length === 0) return;

    // Collect unique new speakers that need to be created
    const existingSpeakerIds = new Set(speakers.map((s) => s.id));
    const newSpeakerIds = new Set<string>();

    for (const suggestion of suggestionsToAccept) {
      if (
        !existingSpeakerIds.has(suggestion.suggestedSpeaker) &&
        !newSpeakerIds.has(suggestion.suggestedSpeaker)
      ) {
        newSpeakerIds.add(suggestion.suggestedSpeaker);
      }
    }

    // Add all new speakers first
    for (const speakerId of newSpeakerIds) {
      addSpeaker(speakerId);
    }

    // Batch update all segments
    const updatedSegments = segments.map((seg) => {
      const suggestion = suggestionsToAccept.find((s) => s.segmentId === seg.id);
      if (suggestion) {
        return { ...seg, speaker: suggestion.suggestedSpeaker };
      }
      return seg;
    });

    // Remove accepted suggestions from store (not just mark as accepted)
    const updatedSuggestions = aiSpeakerSuggestions.filter(
      (s) => !segmentIds.includes(s.segmentId),
    );

    // Single state update
    set({
      segments: updatedSegments,
      aiSpeakerSuggestions: updatedSuggestions,
    });
  },

  rejectSuggestion: (segmentId) => {
    const { aiSpeakerSuggestions } = get();
    set({
      aiSpeakerSuggestions: aiSpeakerSuggestions.map((s) =>
        s.segmentId === segmentId ? { ...s, status: "rejected" as const } : s,
      ),
    });
  },

  clearSuggestions: () => {
    set({ aiSpeakerSuggestions: [] });
  },

  updateConfig: (config) => {
    const current = get().aiSpeakerConfig;
    set({ aiSpeakerConfig: normalizeAISpeakerConfig({ ...current, ...config }) });
  },

  addPrompt: (promptData) => {
    const { aiSpeakerConfig } = get();
    const newPrompt: AIPrompt = {
      ...promptData,
      id: crypto.randomUUID(),
    };
    set({
      aiSpeakerConfig: normalizeAISpeakerConfig({
        ...aiSpeakerConfig,
        prompts: [...aiSpeakerConfig.prompts, newPrompt],
      }),
    });
  },

  updatePrompt: (id, updates) => {
    const { aiSpeakerConfig } = get();
    set({
      aiSpeakerConfig: normalizeAISpeakerConfig({
        ...aiSpeakerConfig,
        prompts: aiSpeakerConfig.prompts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      }),
    });
  },

  deletePrompt: (id) => {
    const { aiSpeakerConfig } = get();
    // Cannot delete built-in prompts
    const promptToDelete = aiSpeakerConfig.prompts.find((p) => p.id === id);
    if (promptToDelete?.isBuiltIn) return;

    const newPrompts = aiSpeakerConfig.prompts.filter((p) => p.id !== id);

    set({
      aiSpeakerConfig: normalizeAISpeakerConfig({
        ...aiSpeakerConfig,
        prompts: newPrompts,
        activePromptId:
          aiSpeakerConfig.activePromptId === id
            ? (aiSpeakerConfig.prompts.find((p) => p.isBuiltIn)?.id ?? newPrompts[0]?.id ?? "")
            : aiSpeakerConfig.activePromptId,
      }),
    });
  },

  setActivePrompt: (id) => {
    const { aiSpeakerConfig } = get();
    set({
      aiSpeakerConfig: normalizeAISpeakerConfig({
        ...aiSpeakerConfig,
        activePromptId: id,
      }),
    });
  },

  setProcessingProgress: (processed, total) => {
    set({
      aiSpeakerProcessedCount: processed,
      aiSpeakerTotalToProcess: total,
    });
  },

  setError: (error) => {
    set({ aiSpeakerError: error });
  },

  setBatchInsights: (insights) => {
    set({ aiSpeakerBatchInsights: insights });
  },
  setDiscrepancyNotice: (notice) => {
    set({ aiSpeakerDiscrepancyNotice: notice });
  },
  setBatchLog: (entries) => {
    set({ aiSpeakerBatchLog: entries });
  },
});
