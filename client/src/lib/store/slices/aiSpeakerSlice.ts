/**
 * AI Speaker Slice
 *
 * Zustand slice for managing AI speaker suggestion state, including
 * suggestions, processing status, configuration, and prompt templates.
 */

import type { StoreApi } from "zustand";
import { runAnalysis, summarizeIssues } from "@/lib/aiSpeakerService";

import type {
  AISpeakerBatchInsight,
  AISpeakerSlice,
  AISpeakerSuggestion,
  PromptTemplate,
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
          const summary = summarizeIssues(insight.issues);
          discrepancyNotice = `Batch ${insight.batchIndex + 1} failed: ${summary || "unknown"}. See batch log.`;
        } else if (insight.ignoredCount && insight.ignoredCount > 0) {
          const returned = insight.rawItemCount;
          const expected = insight.batchSize;
          const used = Math.min(returned, expected);
          const ignored = insight.ignoredCount ?? 0;
          const summary = summarizeIssues(insight.issues);
          discrepancyNotice = `Batch ${insight.batchIndex + 1}: model returned ${returned} (expected ${expected}, used ${used}, ignored ${ignored}). ${summary ? `Issues: ${summary}.` : ""} See batch log.`;
        } else if (insight.rawItemCount < insight.batchSize) {
          const summary = summarizeIssues(insight.issues);
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
          aiSpeakerError: summarizeAiSpeakerError(error),
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

  addTemplate: (template) => {
    const { aiSpeakerConfig } = get();
    const newTemplate: PromptTemplate = {
      ...template,
      id: crypto.randomUUID(),
    };
    set({
      aiSpeakerConfig: normalizeAISpeakerConfig({
        ...aiSpeakerConfig,
        templates: [...aiSpeakerConfig.templates, newTemplate],
      }),
    });
  },

  updateTemplate: (id, updates) => {
    const { aiSpeakerConfig } = get();
    set({
      aiSpeakerConfig: normalizeAISpeakerConfig({
        ...aiSpeakerConfig,
        templates: aiSpeakerConfig.templates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      }),
    });
  },

  deleteTemplate: (id) => {
    const { aiSpeakerConfig } = get();
    if (id === "default") return;

    const newTemplates = aiSpeakerConfig.templates.filter((t) => t.id !== id);

    set({
      aiSpeakerConfig: normalizeAISpeakerConfig({
        ...aiSpeakerConfig,
        templates: newTemplates,
        activeTemplateId:
          aiSpeakerConfig.activeTemplateId === id ? "default" : aiSpeakerConfig.activeTemplateId,
      }),
    });
  },

  setActiveTemplate: (id) => {
    const { aiSpeakerConfig } = get();
    set({
      aiSpeakerConfig: normalizeAISpeakerConfig({
        ...aiSpeakerConfig,
        activeTemplateId: id,
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

export function summarizeAiSpeakerError(error: Error): string {
  if ("details" in error && error.details && typeof error.details === "object") {
    const details = error.details as Record<string, unknown>;
    const rawIssues = details.issues;
    if (Array.isArray(rawIssues) && rawIssues.length > 0) {
      // Build a safe summary from rawIssues (which may be strings or objects)
      const msgs: string[] = rawIssues
        .map((i) => {
          if (typeof i === "string") return i;
          if (i && typeof i === "object") {
            const rec = i as Record<string, unknown>;
            const candidate =
              rec.message ?? rec.msg ?? rec.msgText ?? rec.error ?? JSON.stringify(rec);
            return String(candidate);
          }
          return String(i);
        })
        .filter(Boolean);
      if (msgs.length === 0) return `${error.message}: ${String(rawIssues[0])}`;
      const summary =
        msgs.length <= 3
          ? msgs.join("; ")
          : `${msgs.slice(0, 3).join("; ")} (+${msgs.length - 3} more)`;
      return `${error.message}: ${summary}`;
    }
  }
  return error.message;
}
