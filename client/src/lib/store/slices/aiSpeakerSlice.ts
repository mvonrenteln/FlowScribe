/**
 * AI Speaker Slice
 *
 * Zustand slice for managing AI speaker suggestion state, including
 * suggestions, processing status, configuration, and AI prompts.
 */

import type { StoreApi } from "zustand";
import { toast } from "@/hooks/use-toast";
import { getI18nInstance } from "@/i18n/config";
import { isHardAIErrorCode, summarizeMessages, toAIError } from "@/lib/ai/core";
import { buildSuggestionKeySet, createSegmentSuggestionKey } from "@/lib/ai/core/suggestionKeys";
import { classifySpeakersBatch } from "@/lib/ai/features/speaker";
import { createLogger } from "@/lib/logging";
import { SPEAKER_COLORS } from "../constants";
import type {
  AIPrompt,
  AISpeakerBatchInsight,
  AISpeakerBatchIssue,
  AISpeakerSlice,
  AISpeakerSuggestion,
  TranscriptStore,
} from "../types";
import { normalizeBatchIssueMessage } from "../utils/aiBatchMessages";
import { normalizeAISpeakerConfig } from "../utils/aiSpeakerConfig";
import { generateId } from "../utils/id";
import { addToHistory } from "./historySlice";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

const t = getI18nInstance().t.bind(getI18nInstance());
const logger = createLogger({ feature: "AISpeakerSlice", namespace: "Store" });

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
      set({ aiSpeakerError: t("aiBatch.errors.allSegmentsHaveSuggestions") });
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
      const aggregateErrorIssues: AISpeakerBatchIssue[] = [];

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
              issues: [
                {
                  level: "warn" as const,
                  message: t("aiBatch.messages.cancelledByUser"),
                },
              ],
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

            const normalizedIssues = (result.issues || []).map((issue) => ({
              ...issue,
              message: normalizeBatchIssueMessage(issue.message),
            }));
            const errorIssues = normalizedIssues.filter((issue) => issue.level === "error");
            if (errorIssues.length > 0) {
              aggregateErrorIssues.push(...errorIssues);
            }
            const issueSummary = summarizeMessages(normalizedIssues);
            const errorSummary = summarizeMessages(aggregateErrorIssues);
            const responsePayload = normalizedIssues.find(
              (issue) => typeof issue.context?.responsePayload === "string",
            )?.context?.responsePayload as string | undefined;

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
              issues: normalizedIssues,
              fatal: errorIssues.length > 0 && result.results.length === 0,
              ignoredCount: 0,
              responsePayload,
              batchDurationMs: batchEnd - batchStart,
              elapsedMs: batchEnd - overallStart,
            } as AISpeakerBatchInsight;

            const stateAfterSuggestions = get();
            const updatedInsights = [...stateAfterSuggestions.aiSpeakerBatchInsights, insight];
            const updatedLog = [...stateAfterSuggestions.aiSpeakerBatchLog, insight];

            let discrepancyNotice = stateAfterSuggestions.aiSpeakerDiscrepancyNotice;
            if (insight.fatal) {
              discrepancyNotice = t("aiBatch.speaker.batchFailed", {
                batch: insight.batchIndex + 1,
                summary: issueSummary || t("aiBatch.errors.unknown"),
              });
            } else if (insight.ignoredCount && insight.ignoredCount > 0) {
              const returned = insight.rawItemCount;
              const expected = insight.batchSize;
              const used = Math.min(returned, expected);
              const ignored = insight.ignoredCount ?? 0;
              const summaryPart = issueSummary
                ? t("aiBatch.speaker.issues", { summary: issueSummary })
                : "";
              discrepancyNotice = t("aiBatch.speaker.batchCountMismatch", {
                batch: insight.batchIndex + 1,
                returned,
                expected,
                used,
                ignored,
                summary: summaryPart,
              });
            } else if (insight.rawItemCount < insight.batchSize) {
              const summaryPart = issueSummary
                ? t("aiBatch.speaker.issues", { summary: issueSummary })
                : "";
              discrepancyNotice = t("aiBatch.speaker.batchPartialReturn", {
                batch: insight.batchIndex + 1,
                returned: insight.rawItemCount,
                expected: insight.batchSize,
                summary: summaryPart,
              });
            }

            const hardIssue = insight.issues.find((issue) =>
              isHardAIErrorCode(issue.context?.errorCode as string | undefined),
            );
            if (hardIssue) {
              toast({
                title: t("aiBatch.errors.toastTitle"),
                description: hardIssue.message,
                variant: "destructive",
              });
            }

            logger.info("Batch insight added.", {
              batchIndex: batchIndex + 1,
              processedTotal: processed,
              totalExpected: totalSegments,
            });
            set({
              aiSpeakerBatchInsights: updatedInsights,
              aiSpeakerBatchLog: updatedLog,
              aiSpeakerDiscrepancyNotice: discrepancyNotice,
              aiSpeakerError: errorSummary || stateAfterSuggestions.aiSpeakerError,
            });
          } catch (batchError) {
            const batchTotalExpected = totalSegments;
            const aiError = toAIError(batchError);
            const responsePayload =
              typeof aiError.details?.responsePayload === "string"
                ? aiError.details.responsePayload
                : undefined;
            const isCancelled = aiError.code === "CANCELLED";
            const issues: AISpeakerBatchIssue[] = [
              {
                level: isCancelled ? "warn" : "error",
                message: normalizeBatchIssueMessage(
                  isCancelled ? t("aiBatch.messages.cancelledByUser") : aiError.toUserMessage(),
                ),
                context: {
                  errorCode: aiError.code,
                  responsePayload,
                },
              },
            ];
            if (!isCancelled) {
              aggregateErrorIssues.push(...issues.filter((issue) => issue.level === "error"));
            }
            const errorSummary = summarizeMessages(aggregateErrorIssues);
            const insight = {
              batchIndex,
              batchSize: batchSegments.length,
              rawItemCount: 0,
              unchangedAssignments: 0,
              loggedAt: Date.now(),
              suggestionCount: 0,
              processedTotal: processed,
              totalExpected: batchTotalExpected,
              issues,
              fatal: !isCancelled,
              ignoredCount: 0,
              responsePayload,
              batchDurationMs: Date.now() - batchStart,
              elapsedMs: Date.now() - overallStart,
            } as AISpeakerBatchInsight;

            if (!isCancelled && isHardAIErrorCode(aiError.code)) {
              toast({
                title: t("aiBatch.errors.toastTitle"),
                description: aiError.toUserMessage(),
                variant: "destructive",
              });
            }

            const stateSnapshot = get();
            set({
              aiSpeakerBatchInsights: [...stateSnapshot.aiSpeakerBatchInsights, insight],
              aiSpeakerBatchLog: [...stateSnapshot.aiSpeakerBatchLog, insight],
              aiSpeakerError: errorSummary || stateSnapshot.aiSpeakerError,
            });
            if (isCancelled) {
              break;
            }
          }

          batchIndex++;
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          const err = toAIError(error);
          const currentState = get();
          if (currentState.aiSpeakerAbortController !== abortController) return;
          if (isHardAIErrorCode(err.code)) {
            toast({
              title: t("aiBatch.errors.toastTitle"),
              description: err.toUserMessage(),
              variant: "destructive",
            });
          }
          set({
            aiSpeakerError: err.toUserMessage(),
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
