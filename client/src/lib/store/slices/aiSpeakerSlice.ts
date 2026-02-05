/**
 * AI Speaker Slice
 *
 * Zustand slice for managing AI speaker suggestion state, including
 * suggestions, processing status, configuration, and AI prompts.
 */

import type { StoreApi } from "zustand";
import { summarizeAIError } from "@/lib/ai/core/errors";
import { summarizeMessages } from "@/lib/ai/core/formatting";
import { buildSuggestionKeySet, createSegmentSuggestionKey } from "@/lib/ai/core/suggestionKeys";
import { classifySpeakersBatch } from "@/lib/ai/features/speaker";
import { SPEAKER_COLORS } from "../constants";
import type {
  AIPrompt,
  AISpeakerBatchInsight,
  AISpeakerSlice,
  AISpeakerSuggestion,
  TranscriptStore,
} from "../types";
import { normalizeAISpeakerConfig } from "../utils/aiSpeakerConfig";
import { generateId } from "../utils/id";
import { addToHistory } from "./historySlice";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

// ==================== Initial State ====================

export const initialAISpeakerState = {
  aiSpeakerSuggestions: [] as AISpeakerSuggestion[],
  aiSpeakerIsProcessing: false,
  aiSpeakerIsCancelling: false,
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
  startAnalysis: (selectedSpeakers, excludeConfirmed, segmentIds) => {
    const state = get();

    // Cancel any existing analysis
    if (state.aiSpeakerAbortController) {
      state.aiSpeakerAbortController.abort();
    }

    const abortController = new AbortController();
    const scopedSegmentIds = segmentIds && segmentIds.length > 0 ? new Set(segmentIds) : null;

    // Filter segments to get count
    const segmentsToAnalyze = state.segments.filter((segment) => {
      if (scopedSegmentIds && !scopedSegmentIds.has(segment.id)) return false;
      if (excludeConfirmed && segment.confirmed) return false;
      if (selectedSpeakers.length > 0) {
        return selectedSpeakers.some((s) => s.toLowerCase() === segment.speaker.toLowerCase());
      }
      return true;
    });
    const existingSegmentKeys = buildSuggestionKeySet(state.aiSpeakerSuggestions, (suggestion) =>
      createSegmentSuggestionKey(suggestion.segmentId),
    );
    const segmentsToProcess = segmentsToAnalyze.filter(
      (segment) => !existingSegmentKeys.has(createSegmentSuggestionKey(segment.id)),
    );

    if (segmentsToProcess.length === 0) {
      set({ aiSpeakerError: "All selected segments already have suggestions" });
      return;
    }

    set({
      aiSpeakerIsProcessing: true,
      aiSpeakerIsCancelling: false,
      aiSpeakerProcessedCount: 0,
      aiSpeakerTotalToProcess: segmentsToProcess.length,
      aiSpeakerError: null,
      aiSpeakerAbortController: abortController,
      aiSpeakerBatchInsights: [],
      aiSpeakerDiscrepancyNotice: null,
      aiSpeakerBatchLog: [],
    });

    // Run analysis asynchronously with manual batching for per-batch logging
    (async () => {
      const overallStart = Date.now();
      const batchSize = state.aiSpeakerConfig.batchSize;
      const totalSegments = segmentsToProcess.length;
      let batchIndex = 0;
      let processed = 0;

      // Get active prompt from config
      const activePrompt =
        state.aiSpeakerConfig.prompts.find((p) => p.id === state.aiSpeakerConfig.activePromptId) ??
        state.aiSpeakerConfig.prompts[0];

      try {
        // Process in batches manually to get per-batch logging
        for (let i = 0; i < totalSegments; i += batchSize) {
          if (abortController.signal.aborted) {
            const batchTotalExpected = totalSegments;
            const insight = {
              batchIndex,
              batchSize: 0,
              rawItemCount: 0,
              unchangedAssignments: 0,
              loggedAt: Date.now(),
              suggestionCount: 0,
              processedTotal: processed,
              totalExpected: batchTotalExpected,
              issues: [{ level: "warn" as const, message: "Classification cancelled by user" }],
              fatal: false,
              ignoredCount: 0,
              batchDurationMs: Date.now() - overallStart,
              elapsedMs: Date.now() - overallStart,
            } as AISpeakerBatchInsight;
            const stateSnapshot = get();
            set({
              aiSpeakerBatchInsights: [...stateSnapshot.aiSpeakerBatchInsights, insight],
              aiSpeakerBatchLog: [...stateSnapshot.aiSpeakerBatchLog, insight],
            });
            break;
          }

          const batchStart = Date.now();
          const batchSegments = segmentsToProcess.slice(i, Math.min(i + batchSize, totalSegments));

          try {
            const result = await classifySpeakersBatch(
              batchSegments.map((s) => ({ id: s.id, speaker: s.speaker, text: s.text })),
              state.speakers.map((s) => s.name),
              {
                batchSize: batchSegments.length,
                signal: abortController.signal,
                customPrompt: activePrompt
                  ? {
                      systemPrompt: activePrompt.systemPrompt,
                      userPromptTemplate: activePrompt.userPromptTemplate,
                    }
                  : undefined,
                providerId: state.aiSpeakerConfig.selectedProviderId,
                model: state.aiSpeakerConfig.selectedModel,
              },
            );

            processed = Math.min(i + batchSize, totalSegments);
            const batchEnd = Date.now();

            // Convert results to suggestions and add to store
            const suggestions = result.results.map((r) => ({
              segmentId: r.segmentId,
              currentSpeaker: r.originalSpeaker ?? "",
              suggestedSpeaker: r.suggestedSpeaker,
              status: "pending" as const,
              confidence: r.confidence,
              reason: r.reason,
              isNewSpeaker: r.isNew,
            }));

            const stateSnapshot = get();
            if (!stateSnapshot.aiSpeakerIsProcessing) return;

            const existingKeys = buildSuggestionKeySet(
              stateSnapshot.aiSpeakerSuggestions,
              (suggestion) => createSegmentSuggestionKey(suggestion.segmentId),
            );
            const uniqueSuggestions = suggestions.filter(
              (suggestion) => !existingKeys.has(createSegmentSuggestionKey(suggestion.segmentId)),
            );

            if (uniqueSuggestions.length > 0) {
              set({
                aiSpeakerSuggestions: [...stateSnapshot.aiSpeakerSuggestions, ...uniqueSuggestions],
              });
            }

            // Update progress
            set({ aiSpeakerProcessedCount: processed });

            // Create batch log entry
            const batchTotalExpected = totalSegments;
            const insight = {
              batchIndex,
              batchSize: batchSegments.length,
              rawItemCount: batchSegments.length,
              unchangedAssignments: result.summary.unchanged,
              loggedAt: Date.now(),
              suggestionCount: suggestions.length,
              processedTotal: processed,
              totalExpected: batchTotalExpected,
              issues: (result.issues || []).map((i) => ({
                level: i.level,
                message: i.message,
                context: i.context,
              })),
              fatal: false,
              ignoredCount: 0,
              batchDurationMs: batchEnd - batchStart,
              elapsedMs: batchEnd - overallStart,
            } as AISpeakerBatchInsight;

            const stateAfterSuggestions = get();
            const updatedInsights = [...stateAfterSuggestions.aiSpeakerBatchInsights, insight];
            const updatedLog = [...stateAfterSuggestions.aiSpeakerBatchLog, insight];

            let discrepancyNotice = stateAfterSuggestions.aiSpeakerDiscrepancyNotice;
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

            console.log(
              `[DEBUG] Batch ${batchIndex + 1}: Adding insight with processedTotal=${processed}, totalExpected=${totalSegments}`,
            );
            set({
              aiSpeakerBatchInsights: updatedInsights,
              aiSpeakerBatchLog: updatedLog,
              aiSpeakerDiscrepancyNotice: discrepancyNotice,
            });
          } catch (batchError) {
            const batchTotalExpected = totalSegments;
            const insight = {
              batchIndex,
              batchSize: batchSegments.length,
              rawItemCount: 0,
              unchangedAssignments: 0,
              loggedAt: Date.now(),
              suggestionCount: 0,
              processedTotal: processed,
              totalExpected: batchTotalExpected,
              issues: [{ level: "error" as const, message: String(batchError) }],
              fatal: true,
              ignoredCount: 0,
              batchDurationMs: Date.now() - batchStart,
              elapsedMs: Date.now() - overallStart,
            } as AISpeakerBatchInsight;

            const stateSnapshot = get();
            set({
              aiSpeakerBatchInsights: [...stateSnapshot.aiSpeakerBatchInsights, insight],
              aiSpeakerBatchLog: [...stateSnapshot.aiSpeakerBatchLog, insight],
            });
          }

          batchIndex++;
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          const err = error instanceof Error ? error : new Error(String(error));
          const currentState = get();
          if (currentState.aiSpeakerAbortController !== abortController) return;
          set({
            aiSpeakerError: summarizeAIError(err),
            aiSpeakerIsProcessing: false,
            aiSpeakerIsCancelling: false,
            aiSpeakerAbortController: null,
          });
        }
      } finally {
        const currentState = get();
        if (currentState.aiSpeakerAbortController === abortController) {
          set({
            aiSpeakerIsProcessing: false,
            aiSpeakerIsCancelling: false,
            aiSpeakerAbortController: null,
          });
        }
      }
    })();
  },

  cancelAnalysis: () => {
    const { aiSpeakerAbortController } = get();
    if (aiSpeakerAbortController) {
      aiSpeakerAbortController.abort();
    }
    // Keep existing suggestions, just stop processing
    set({
      aiSpeakerIsCancelling: true,
    });
  },

  addSuggestions: (suggestions) => {
    const current = get().aiSpeakerSuggestions;
    set({ aiSpeakerSuggestions: [...current, ...suggestions] });
  },

  acceptSuggestion: (segmentId) => {
    const {
      aiSpeakerSuggestions,
      speakers,
      segments,
      history,
      historyIndex,
      selectedSegmentId,
      currentTime,
      chapters,
      selectedChapterId,
      confidenceScoresVersion,
    } = get();
    const suggestion = aiSpeakerSuggestions.find((s) => s.segmentId === segmentId);

    if (!suggestion) return;

    // Check if the suggested speaker exists, if not create it
    const speakerExists = speakers.some(
      (s) => s.name.toLowerCase() === suggestion.suggestedSpeaker.toLowerCase(),
    );

    let updatedSpeakers = speakers;
    if (!speakerExists) {
      // Create new speaker with a random color
      const newSpeaker = {
        id: generateId(),
        name: suggestion.suggestedSpeaker,
        color: SPEAKER_COLORS[speakers.length % SPEAKER_COLORS.length],
      };
      updatedSpeakers = [...speakers, newSpeaker];
    }

    // Update the segment speaker
    const updatedSegments = segments.map((seg) =>
      seg.id === segmentId ? { ...seg, speaker: suggestion.suggestedSpeaker } : seg,
    );

    // Remove the suggestion from the list
    const updatedSuggestions = aiSpeakerSuggestions.filter((s) => s.segmentId !== segmentId);

    // Create single history entry for all changes (speakers + segments)
    const nextHistory = addToHistory(history, historyIndex, {
      segments: updatedSegments,
      speakers: updatedSpeakers,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      tags: get().tags,
      chapters,
      confidenceScoresVersion,
    });

    // Single state update with history
    set({
      segments: updatedSegments,
      speakers: updatedSpeakers,
      aiSpeakerSuggestions: updatedSuggestions,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  acceptManySuggestions: (segmentIds) => {
    const {
      aiSpeakerSuggestions,
      speakers,
      segments,
      history,
      historyIndex,
      selectedSegmentId,
      currentTime,
      chapters,
      selectedChapterId,
      confidenceScoresVersion,
    } = get();

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

    // Create new speaker objects
    const newSpeakers = Array.from(newSpeakerIds).map((speakerId, idx) => ({
      id: generateId(),
      name: speakerId,
      color: SPEAKER_COLORS[(speakers.length + idx) % SPEAKER_COLORS.length],
    }));

    // Combine existing and new speakers
    const updatedSpeakers = [...speakers, ...newSpeakers];

    // Batch update all segments
    const updatedSegments = segments.map((seg) => {
      const suggestion = suggestionsToAccept.find((s) => s.segmentId === seg.id);
      if (suggestion) {
        return { ...seg, speaker: suggestion.suggestedSpeaker };
      }
      return seg;
    });

    // Remove accepted suggestions from store
    const updatedSuggestions = aiSpeakerSuggestions.filter(
      (s) => !segmentIds.includes(s.segmentId),
    );

    // Create single history entry for all changes (speakers + segments)
    const nextHistory = addToHistory(history, historyIndex, {
      segments: updatedSegments,
      speakers: updatedSpeakers,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      tags: get().tags,
      chapters,
      confidenceScoresVersion,
    });

    // Single state update with history
    set({
      segments: updatedSegments,
      speakers: updatedSpeakers,
      aiSpeakerSuggestions: updatedSuggestions,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  rejectSuggestion: (segmentId) => {
    const { aiSpeakerSuggestions } = get();
    // Remove the suggestion from the list (consistent with revision slice)
    set({
      aiSpeakerSuggestions: aiSpeakerSuggestions.filter((s) => s.segmentId !== segmentId),
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
      id: generateId(),
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
