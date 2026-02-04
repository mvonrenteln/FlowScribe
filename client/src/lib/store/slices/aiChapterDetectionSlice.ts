/**
 * AI Chapter Detection Slice
 *
 * Zustand slice for managing AI chapter detection suggestions and configuration.
 * The detection state (processing/suggestions) is in-memory only; accepted chapters
 * are persisted through the main chapter slice/history.
 */

import type { StoreApi } from "zustand";
import { buildSuggestionKeySet, createChapterSuggestionKey } from "@/lib/ai/core/suggestionKeys";
import { detectChapters } from "@/lib/ai/features/chapterDetection";
import { mapById } from "@/lib/arrayUtils";
import type { Chapter } from "@/types/chapter";
import type {
  AIChapterDetectionBatchLogEntry,
  AIChapterDetectionConfig,
  AIChapterDetectionSlice,
  AIChapterSuggestion,
  Segment,
  TranscriptStore,
} from "../types";
import { normalizeAIChapterDetectionConfig } from "../utils/aiChapterDetectionConfig";
import {
  buildSegmentIndexMap,
  recomputeChapterRangesFromStarts,
  sortChaptersByStart,
} from "../utils/chapters";
import { generateId } from "../utils/id";
import { addToHistory } from "./historySlice";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

export const initialAIChapterDetectionState = {
  aiChapterDetectionSuggestions: [] as AIChapterSuggestion[],
  aiChapterDetectionIsProcessing: false,
  aiChapterDetectionProcessedBatches: 0,
  aiChapterDetectionTotalBatches: 0,
  aiChapterDetectionConfig: normalizeAIChapterDetectionConfig(),
  aiChapterDetectionError: null as string | null,
  aiChapterDetectionAbortController: null as AbortController | null,
  aiChapterDetectionBatchLog: [] as AIChapterDetectionBatchLogEntry[],
};

const toDetectSegments = (segments: Segment[]) =>
  segments.map((s) => ({
    id: s.id,
    speaker: s.speaker,
    text: s.text,
    start: s.start,
    end: s.end,
  }));

const toSuggestion = (chapter: Chapter): AIChapterSuggestion => ({
  ...chapter,
  id: chapter.id,
  status: "pending",
});

const normalizeIncomingChapters = (
  incoming: Chapter[],
  segments: Segment[],
  indexById: Map<string, number>,
): Chapter[] => {
  const ordered = sortChaptersByStart(incoming, indexById);
  return ordered.map((chapter, index) => {
    const startIndex = indexById.get(chapter.startSegmentId);
    const endIndex = indexById.get(chapter.endSegmentId);
    if (startIndex === undefined || endIndex === undefined) {
      return { ...chapter, segmentCount: 0 };
    }
    const nextChapter = ordered[index + 1];
    const nextStartIndex = nextChapter ? indexById.get(nextChapter.startSegmentId) : undefined;
    const maxEndIndex =
      nextStartIndex !== undefined ? Math.max(startIndex, nextStartIndex - 1) : endIndex;
    const resolvedEndIndex = Math.min(endIndex, maxEndIndex);
    if (resolvedEndIndex < startIndex) {
      return { ...chapter, segmentCount: 0 };
    }
    return {
      ...chapter,
      endSegmentId: segments[resolvedEndIndex]?.id ?? chapter.endSegmentId,
      segmentCount: resolvedEndIndex - startIndex + 1,
    };
  });
};

const mergeChaptersByStart = (
  existing: Chapter[],
  incoming: Chapter[],
  segments: Segment[],
): Chapter[] => {
  const indexById = buildSegmentIndexMap(segments);
  const normalizedIncoming = normalizeIncomingChapters(incoming, segments, indexById);
  const merged = [...existing];
  for (const incomingChapter of normalizedIncoming) {
    const existingIndex = merged.findIndex(
      (chapter) => chapter.startSegmentId === incomingChapter.startSegmentId,
    );
    if (existingIndex === -1) {
      merged.push(incomingChapter);
      continue;
    }
    const current = merged[existingIndex];
    merged[existingIndex] = {
      ...current,
      title: incomingChapter.title,
      summary: incomingChapter.summary,
      notes: incomingChapter.notes,
      tags: incomingChapter.tags,
      source: current.source,
    };
  }

  const recomputed = recomputeChapterRangesFromStarts(merged, segments, indexById);
  return sortChaptersByStart(recomputed, indexById);
};

export const createAIChapterDetectionSlice = (
  set: StoreSetter,
  get: StoreGetter,
): AIChapterDetectionSlice => ({
  startChapterDetection: (options) => {
    const state = get();

    if (state.aiChapterDetectionAbortController) {
      state.aiChapterDetectionAbortController.abort();
    }

    const abortController = new AbortController();
    const { segmentIds, ...configOverrides } = options ?? {};
    const config: AIChapterDetectionConfig = {
      ...state.aiChapterDetectionConfig,
      ...configOverrides,
    };
    const useSegmentScope = segmentIds !== undefined;
    const scopedSegmentIds = useSegmentScope ? new Set(segmentIds ?? []) : null;
    const segmentsToDetect = useSegmentScope
      ? state.segments.filter((segment) => scopedSegmentIds?.has(segment.id))
      : state.segments;
    const indexById = buildSegmentIndexMap(state.segments);
    const coveredSegmentIds = new Set<string>();
    for (const suggestion of state.aiChapterDetectionSuggestions) {
      const startIndex = indexById.get(suggestion.startSegmentId) ?? -1;
      const endIndex = indexById.get(suggestion.endSegmentId) ?? -1;
      if (startIndex === -1 || endIndex === -1) continue;
      const from = Math.min(startIndex, endIndex);
      const to = Math.max(startIndex, endIndex);
      for (let i = from; i <= to; i++) {
        const segmentId = state.segments[i]?.id;
        if (segmentId) {
          coveredSegmentIds.add(segmentId);
        }
      }
    }
    const segmentsToProcess = segmentsToDetect.filter(
      (segment) => !coveredSegmentIds.has(segment.id),
    );
    if (segmentsToProcess.length === 0) {
      set({ aiChapterDetectionError: "All selected segments already have suggestions" });
      return;
    }

    set({
      aiChapterDetectionIsProcessing: true,
      aiChapterDetectionProcessedBatches: 0,
      aiChapterDetectionTotalBatches: Math.ceil(
        segmentsToProcess.length / Math.max(1, config.batchSize),
      ),
      aiChapterDetectionError: null,
      aiChapterDetectionAbortController: abortController,
      aiChapterDetectionBatchLog: [],
      aiChapterDetectionConfig: config,
    });

    (async () => {
      try {
        const activePrompt =
          config.prompts.find((p) => p.id === config.activePromptId) ?? config.prompts[0];

        const tagsById = mapById(state.tags);
        const selectedTagIds =
          config.tagIds.length > 0 ? config.tagIds : state.tags.map((t) => t.id);
        const tagsAvailable = selectedTagIds
          .map((id) => tagsById.get(id))
          .filter((t): t is NonNullable<typeof t> => Boolean(t))
          .map((t) => ({ id: t.id, label: t.name }));

        const result = await detectChapters({
          segments: toDetectSegments(segmentsToProcess),
          batchSize: config.batchSize,
          minChapterLength: config.minChapterLength,
          maxChapterLength: config.maxChapterLength,
          tagsAvailable,
          providerId: config.selectedProviderId,
          model: config.selectedModel,
          signal: abortController.signal,
          customPrompt: activePrompt
            ? {
                systemPrompt: activePrompt.systemPrompt,
                userPromptTemplate: activePrompt.userPromptTemplate,
              }
            : undefined,
          onProgress: (processed, total) => {
            const snapshot = get();
            if (!snapshot.aiChapterDetectionIsProcessing) return;
            set({
              aiChapterDetectionProcessedBatches: processed,
              aiChapterDetectionTotalBatches: total,
            });
          },
          onBatchLog: (entry) => {
            const snapshot = get();
            if (!snapshot.aiChapterDetectionIsProcessing) return;
            set({
              aiChapterDetectionBatchLog: [...snapshot.aiChapterDetectionBatchLog, entry],
            });
          },
          onBatchComplete: (batchIndex, mapped) => {
            const snapshot = get();
            // eslint-disable-next-line no-console
            console.log("[FS-AI] onBatchComplete handler called", {
              batchIndex,
              processingFlag: snapshot.aiChapterDetectionIsProcessing,
              mappedCount: mapped.length,
            });
            if (!snapshot.aiChapterDetectionIsProcessing) {
              // eslint-disable-next-line no-console
              console.log(
                "[FS-AI] onBatchComplete handler exiting because processingFlag is false",
                { batchIndex },
              );
              return;
            }

            // Convert mapped items into suggestions and append incrementally
            const indexById = buildSegmentIndexMap(snapshot.segments);
            const existingSuggestionKeys = buildSuggestionKeySet(
              snapshot.aiChapterDetectionSuggestions,
              (suggestion) =>
                createChapterSuggestionKey(suggestion.startSegmentId, suggestion.endSegmentId),
            );
            const newSuggestions = mapped
              .map((ch) => {
                const first = ch.startSegmentId;
                const last = ch.endSegmentId;
                const segmentCount =
                  indexById.has(first) && indexById.has(last)
                    ? Math.max(0, (indexById.get(last) ?? 0) - (indexById.get(first) ?? 0) + 1)
                    : 0;

                // Check if there's an existing chapter at the exact same position
                const existingChapter = snapshot.chapters.find(
                  (existing) => existing.startSegmentId === first,
                );

                const baseSuggestion = toSuggestion({
                  id: generateId(),
                  title: ch.title,
                  summary: ch.summary,
                  notes: ch.notes,
                  tags: ch.tags,
                  startSegmentId: first,
                  endSegmentId: last,
                  segmentCount,
                  createdAt: Date.now(),
                  source: "ai",
                } as unknown as Chapter);

                // If there's an existing chapter at the same position, mark this as a modification
                if (existingChapter) {
                  return {
                    ...baseSuggestion,
                    modificationType: "title-change" as const,
                    existingChapterId: existingChapter.id,
                  };
                }

                return {
                  ...baseSuggestion,
                  modificationType: "new" as const,
                };
              })
              .filter(
                (suggestion) =>
                  !existingSuggestionKeys.has(
                    createChapterSuggestionKey(suggestion.startSegmentId, suggestion.endSegmentId),
                  ),
              );

            // append batch suggestions

            set({
              aiChapterDetectionSuggestions: [
                ...snapshot.aiChapterDetectionSuggestions,
                ...newSuggestions,
              ],
            });

            // appended suggestions
          },
        });

        const existingSuggestionKeys = buildSuggestionKeySet(
          get().aiChapterDetectionSuggestions,
          (suggestion) =>
            createChapterSuggestionKey(suggestion.startSegmentId, suggestion.endSegmentId),
        );
        const suggestions = result.chapters
          .map((ch) => {
            // Check if there's an existing chapter at the exact same position
            const existingChapter = state.chapters.find(
              (existing) => existing.startSegmentId === ch.startSegmentId,
            );

            const baseSuggestion = toSuggestion({
              ...ch,
              id: generateId(),
            });

            // If there's an existing chapter at the same position, mark this as a modification
            if (existingChapter) {
              return {
                ...baseSuggestion,
                modificationType: "title-change" as const,
                existingChapterId: existingChapter.id,
              };
            }

            return {
              ...baseSuggestion,
              modificationType: "new" as const,
            };
          })
          .filter(
            (suggestion) =>
              !existingSuggestionKeys.has(
                createChapterSuggestionKey(suggestion.startSegmentId, suggestion.endSegmentId),
              ),
          );

        set({
          aiChapterDetectionSuggestions: [...get().aiChapterDetectionSuggestions, ...suggestions],
          aiChapterDetectionIsProcessing: false,
          aiChapterDetectionAbortController: null,
          aiChapterDetectionError: result.issues.find((i) => i.level === "error")?.message ?? null,
          aiChapterDetectionBatchLog: result.batchLog.length
            ? result.batchLog
            : get().aiChapterDetectionBatchLog,
        });
      } catch (error) {
        const snapshot = get();
        if (!snapshot.aiChapterDetectionIsProcessing) return;
        set({
          aiChapterDetectionIsProcessing: false,
          aiChapterDetectionAbortController: null,
          aiChapterDetectionError: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  },

  cancelChapterDetection: () => {
    const state = get();
    if (state.aiChapterDetectionAbortController) {
      state.aiChapterDetectionAbortController.abort();
    }
    set({
      aiChapterDetectionIsProcessing: false,
      aiChapterDetectionAbortController: null,
      aiChapterDetectionError: null,
    });
  },

  acceptChapterSuggestion: (suggestionId) => {
    const state = get();
    const suggestion = state.aiChapterDetectionSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;

    const {
      history,
      historyIndex,
      segments,
      speakers,
      tags: sessionTags,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    } = state;

    let updatedChapters: Chapter[];

    // If this is a modification of an existing chapter, update it instead of adding new
    if (suggestion.modificationType === "title-change" && suggestion.existingChapterId) {
      updatedChapters = state.chapters.map((ch) =>
        ch.id === suggestion.existingChapterId
          ? {
              ...ch,
              title: suggestion.title,
              summary: suggestion.summary,
              notes: suggestion.notes,
              tags: suggestion.tags,
            }
          : ch,
      );
    } else {
      // Add as new chapter
      const incoming: Chapter = {
        id: suggestion.id,
        title: suggestion.title,
        summary: suggestion.summary,
        notes: suggestion.notes,
        tags: suggestion.tags,
        startSegmentId: suggestion.startSegmentId,
        endSegmentId: suggestion.endSegmentId,
        segmentCount: suggestion.segmentCount,
        createdAt: Date.now(),
        source: "ai",
      };

      updatedChapters = mergeChaptersByStart(state.chapters, [incoming], segments);
    }

    const nextHistory = addToHistory(history, historyIndex, {
      segments,
      speakers,
      tags: sessionTags,
      chapters: updatedChapters,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    });

    set({
      chapters: updatedChapters,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
      aiChapterDetectionSuggestions: state.aiChapterDetectionSuggestions.filter(
        (s) => s.id !== suggestionId,
      ),
      aiChapterDetectionError: null,
    });
  },

  rejectChapterSuggestion: (suggestionId) => {
    const state = get();
    set({
      aiChapterDetectionSuggestions: state.aiChapterDetectionSuggestions.filter(
        (s) => s.id !== suggestionId,
      ),
    });
  },

  acceptAllChapterSuggestions: () => {
    const state = get();
    const pending = state.aiChapterDetectionSuggestions.filter((s) => s.status === "pending");
    if (pending.length === 0) return;

    const {
      history,
      historyIndex,
      segments,
      speakers,
      tags: sessionTags,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    } = state;

    const incoming: Chapter[] = pending.map((s) => ({
      id: s.id,
      title: s.title,
      summary: s.summary,
      notes: s.notes,
      tags: s.tags,
      startSegmentId: s.startSegmentId,
      endSegmentId: s.endSegmentId,
      segmentCount: s.segmentCount,
      createdAt: Date.now(),
      source: "ai",
    }));

    const ordered = mergeChaptersByStart(state.chapters, incoming, segments);

    const nextHistory = addToHistory(history, historyIndex, {
      segments,
      speakers,
      tags: sessionTags,
      chapters: ordered,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    });

    set({
      chapters: ordered,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
      aiChapterDetectionSuggestions: state.aiChapterDetectionSuggestions.filter(
        (s) => s.status !== "pending",
      ),
      aiChapterDetectionError: null,
    });
  },

  clearChapterSuggestions: () => {
    set({ aiChapterDetectionSuggestions: [], aiChapterDetectionError: null });
  },

  updateChapterDetectionConfig: (partial) => {
    const state = get();
    set({ aiChapterDetectionConfig: { ...state.aiChapterDetectionConfig, ...partial } });
  },

  addChapterDetectionPrompt: (prompt) => {
    const state = get();
    const next = { ...prompt, id: generateId(), type: "chapter-detect" as const };
    set({
      aiChapterDetectionConfig: {
        ...state.aiChapterDetectionConfig,
        prompts: [...state.aiChapterDetectionConfig.prompts, next],
      },
    });
  },

  updateChapterDetectionPrompt: (id, updates) => {
    const state = get();
    set({
      aiChapterDetectionConfig: {
        ...state.aiChapterDetectionConfig,
        prompts: state.aiChapterDetectionConfig.prompts.map((p) =>
          p.id === id ? { ...p, ...updates, type: "chapter-detect" as const } : p,
        ),
      },
    });
  },

  deleteChapterDetectionPrompt: (id) => {
    const state = get();
    const prompts = state.aiChapterDetectionConfig.prompts.filter((p) => p.id !== id);
    const activePromptId =
      state.aiChapterDetectionConfig.activePromptId === id
        ? (prompts[0]?.id ?? "")
        : state.aiChapterDetectionConfig.activePromptId;
    set({
      aiChapterDetectionConfig: { ...state.aiChapterDetectionConfig, prompts, activePromptId },
    });
  },

  setActiveChapterDetectionPrompt: (id) => {
    const state = get();
    set({ aiChapterDetectionConfig: { ...state.aiChapterDetectionConfig, activePromptId: id } });
  },

  setChapterDetectionError: (error) => set({ aiChapterDetectionError: error }),

  setChapterDetectionProgress: (processed, total) =>
    set({ aiChapterDetectionProcessedBatches: processed, aiChapterDetectionTotalBatches: total }),
});
