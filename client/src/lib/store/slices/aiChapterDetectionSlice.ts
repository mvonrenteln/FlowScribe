/**
 * AI Chapter Detection Slice
 *
 * Zustand slice for managing AI chapter detection suggestions and configuration.
 * The detection state (processing/suggestions) is in-memory only; accepted chapters
 * are persisted through the main chapter slice/history.
 */

import type { StoreApi } from "zustand";
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
  hasOverlappingChapters,
  normalizeChapterCounts,
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

const findConflicts = (
  existing: Chapter[],
  incoming: Chapter[],
  segments: Segment[],
): { ok: boolean; message?: string } => {
  const indexById = buildSegmentIndexMap(segments);
  const combined = normalizeChapterCounts([...existing, ...incoming], indexById);
  const hasOverlap = hasOverlappingChapters(combined, indexById);
  if (!hasOverlap) return { ok: true };
  return {
    ok: false,
    message:
      "Detected chapters would overlap existing chapters. Reject conflicting suggestions or clear chapters before accepting.",
  };
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
    const config: AIChapterDetectionConfig = {
      ...state.aiChapterDetectionConfig,
      ...options,
    };

    set({
      aiChapterDetectionIsProcessing: true,
      aiChapterDetectionProcessedBatches: 0,
      aiChapterDetectionTotalBatches: Math.ceil(
        state.segments.length / Math.max(1, config.batchSize),
      ),
      aiChapterDetectionError: null,
      aiChapterDetectionAbortController: abortController,
      aiChapterDetectionSuggestions: [],
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
          segments: toDetectSegments(state.segments),
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
            const newSuggestions = mapped.map((ch) => {
              const first = ch.startSegmentId;
              const last = ch.endSegmentId;
              const segmentCount =
                indexById.has(first) && indexById.has(last)
                  ? Math.max(0, (indexById.get(last) ?? 0) - (indexById.get(first) ?? 0) + 1)
                  : 0;
              return toSuggestion({
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
            });

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

        const suggestions = result.chapters.map((ch) =>
          toSuggestion({
            ...ch,
            id: generateId(),
          }),
        );

        set({
          aiChapterDetectionSuggestions: suggestions,
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

    const conflict = findConflicts(state.chapters, [incoming], segments);
    if (!conflict.ok) {
      set({ aiChapterDetectionError: conflict.message ?? "Conflict while accepting suggestion" });
      return;
    }

    const indexById = buildSegmentIndexMap(segments);
    const normalized = normalizeChapterCounts([...state.chapters, incoming], indexById);
    if (hasOverlappingChapters(normalized, indexById)) {
      set({ aiChapterDetectionError: "Conflict while accepting suggestion" });
      return;
    }
    const ordered = sortChaptersByStart(normalized, indexById);

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
    });

    set({
      aiChapterDetectionSuggestions: state.aiChapterDetectionSuggestions.map((s) =>
        s.id === suggestionId ? { ...s, status: "accepted" } : s,
      ),
      aiChapterDetectionError: null,
    });
  },

  rejectChapterSuggestion: (suggestionId) => {
    const state = get();
    set({
      aiChapterDetectionSuggestions: state.aiChapterDetectionSuggestions.map((s) =>
        s.id === suggestionId ? { ...s, status: "rejected" } : s,
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

    const conflict = findConflicts(state.chapters, incoming, segments);
    if (!conflict.ok) {
      set({ aiChapterDetectionError: conflict.message ?? "Conflict while accepting suggestions" });
      return;
    }

    const indexById = buildSegmentIndexMap(segments);
    const normalized = normalizeChapterCounts([...state.chapters, ...incoming], indexById);
    if (hasOverlappingChapters(normalized, indexById)) {
      set({ aiChapterDetectionError: "Conflict while accepting suggestions" });
      return;
    }
    const ordered = sortChaptersByStart(normalized, indexById);

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
    });

    set({
      aiChapterDetectionSuggestions: state.aiChapterDetectionSuggestions.map((s) =>
        s.status === "pending" ? { ...s, status: "accepted" } : s,
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
