/**
 * Rewrite Slice
 *
 * Zustand slice for chapter rewrite state and configuration.
 *
 * @module store/slices/rewriteSlice
 */

import type { StoreApi } from "zustand";
import { toast } from "@/hooks/use-toast";
import { getI18nInstance } from "@/i18n/config";
import { rewriteChapter, rewriteParagraph } from "@/lib/ai/features/rewrite/service";
import { createLogger } from "@/lib/logging";
import {
  getPreviousParagraphs,
  replaceParagraphAtIndex,
  splitRewrittenParagraphs,
} from "@/lib/rewriteParagraphs";
import type { AIChapterDetectionConfig, AIPrompt, TranscriptStore } from "../types";
import { buildSegmentIndexMap, sortChaptersByStart } from "../utils/chapters";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

const logger = createLogger({ feature: "RewriteSlice", namespace: "Store" });
const t = getI18nInstance().t.bind(getI18nInstance());

const isAbortError = (error: unknown) => error instanceof Error && error.name === "AbortError";

// ==================== Types ====================

export type RewriteConfig = {
  /** Include context (summaries + previous chapter) */
  includeContext: boolean;
  /** Maximum words from previous chapter */
  contextWordLimit: number;
  /** Default prompt ID */
  defaultPromptId: string;
  /** Quick access prompt IDs (shown in popover) */
  quickAccessPromptIds: string[];
  /** Selected provider ID */
  selectedProviderId?: string;
  /** Selected model */
  selectedModel?: string;
};

export interface RewriteDraft {
  text: string;
  promptId: string;
  providerId?: string;
  model?: string;
}

export type RewriteBatchItemStatus =
  | "pending"
  | "processing"
  | "done"
  | "failed"
  | "skipped"
  | "cancelled";

export interface RewriteBatchLogEntry {
  chapterId: string;
  chapterTitle: string;
  status: RewriteBatchItemStatus;
  loggedAt: number;
  durationMs?: number;
  error?: string;
  promptId?: string;
}

export interface RewriteSlice {
  // Processing state
  rewriteInProgress: boolean;
  rewriteChapterId: string | null;
  rewriteError: string | null;
  rewriteAbortController: AbortController | null;
  paragraphRewriteInProgress: boolean;
  paragraphRewriteChapterId: string | null;
  paragraphRewriteParagraphIndex: number | null;
  paragraphRewriteError: string | null;
  paragraphRewriteAbortController: AbortController | null;
  rewriteDraftByChapterId: Record<string, RewriteDraft | undefined>;
  batchRewriteIsProcessing: boolean;
  batchRewriteIsCancelling: boolean;
  batchRewriteProcessedCount: number;
  batchRewriteTotalCount: number;
  batchRewriteError: string | null;
  batchRewriteAbortController: AbortController | null;
  batchRewriteLog: RewriteBatchLogEntry[];

  // Actions - Configuration
  updateRewriteConfig: (updates: Partial<RewriteConfig>) => void;

  // Actions - Prompts
  addRewritePrompt: (prompt: Omit<AIPrompt, "id">) => void;
  updateRewritePrompt: (
    id: string,
    updates: Partial<Pick<AIPrompt, "name" | "systemPrompt" | "userPromptTemplate">>,
  ) => void;
  deleteRewritePrompt: (id: string) => void;
  toggleQuickAccessRewritePrompt: (id: string) => void;

  // Actions - Processing
  startRewrite: (chapterId: string, promptId: string, customInstructions?: string) => Promise<void>;
  cancelRewrite: () => void;
  startParagraphRewrite: (
    chapterId: string,
    paragraphIndex: number,
    promptId: string,
    customInstructions?: string,
  ) => Promise<void>;
  cancelParagraphRewrite: () => void;
  setRewriteDraft: (chapterId: string, draft: RewriteDraft) => void;
  clearRewriteDraft: (chapterId: string) => void;
  startBatchRewrite: (options: {
    promptId: string;
    customInstructions?: string;
    skipAlreadyRewritten?: boolean;
  }) => Promise<void>;
  cancelBatchRewrite: () => void;
  acceptAllBatchRewrites: () => void;
  rejectAllBatchRewrites: () => void;
}

// ==================== Initial State ====================

export const initialRewriteState = {
  rewriteInProgress: false,
  rewriteChapterId: null,
  rewriteError: null,
  rewriteAbortController: null,
  paragraphRewriteInProgress: false,
  paragraphRewriteChapterId: null,
  paragraphRewriteParagraphIndex: null,
  paragraphRewriteError: null,
  paragraphRewriteAbortController: null,
  rewriteDraftByChapterId: {},
  batchRewriteIsProcessing: false,
  batchRewriteIsCancelling: false,
  batchRewriteProcessedCount: 0,
  batchRewriteTotalCount: 0,
  batchRewriteError: null,
  batchRewriteAbortController: null,
  batchRewriteLog: [] as RewriteBatchLogEntry[],
};

// ==================== Slice Creator ====================

export const createRewriteSlice = (set: StoreSetter, get: StoreGetter): RewriteSlice => ({
  ...initialRewriteState,

  // Configuration
  updateRewriteConfig: (updates) => {
    const configUpdates: Partial<AIChapterDetectionConfig> = {};
    if (typeof updates.includeContext === "boolean") {
      configUpdates.includeContext = updates.includeContext;
    }
    if (typeof updates.contextWordLimit === "number") {
      configUpdates.contextWordLimit = updates.contextWordLimit;
    }
    if (updates.selectedProviderId !== undefined) {
      configUpdates.selectedProviderId = updates.selectedProviderId;
    }
    if (updates.selectedModel !== undefined) {
      configUpdates.selectedModel = updates.selectedModel;
    }
    get().updateChapterDetectionConfig(configUpdates);
  },

  // Prompts
  addRewritePrompt: (prompt) => {
    const nextPrompt: Omit<AIPrompt, "id"> = {
      name: prompt.name,
      type: "chapter-detect",
      operation: "rewrite",
      systemPrompt: prompt.systemPrompt,
      userPromptTemplate: prompt.userPromptTemplate,
      isBuiltIn: Boolean(prompt.isBuiltIn),
      quickAccess: false,
    };
    get().addChapterDetectionPrompt(nextPrompt);
  },

  updateRewritePrompt: (id, updates) => {
    const promptUpdates: Partial<AIPrompt> = {};
    if (updates.name !== undefined) {
      promptUpdates.name = updates.name;
    }
    if (updates.systemPrompt !== undefined) {
      promptUpdates.systemPrompt = updates.systemPrompt;
    }
    if (updates.userPromptTemplate !== undefined) {
      promptUpdates.userPromptTemplate = updates.userPromptTemplate;
    }
    get().updateChapterDetectionPrompt(id, promptUpdates);
  },

  deleteRewritePrompt: (id) => {
    get().deleteChapterDetectionPrompt(id);
  },

  toggleQuickAccessRewritePrompt: (id) => {
    const prompt = get().aiChapterDetectionConfig.prompts.find((p) => p.id === id);
    if (prompt) {
      get().updateChapterDetectionPrompt(id, { quickAccess: !prompt.quickAccess });
    }
  },

  // Processing
  startRewrite: async (chapterId, promptId, customInstructions) => {
    const state = get();

    // Find chapter
    const chapter = state.chapters.find((c) => c.id === chapterId);
    if (!chapter) {
      logger.error("Chapter not found.", { chapterId });
      return;
    }

    // Find prompt in unified config
    const prompt = state.aiChapterDetectionConfig.prompts.find((p) => p.id === promptId);
    if (!prompt) {
      logger.error("Prompt not found.", { promptId });
      return;
    }
    if (!prompt.systemPrompt?.trim() || !prompt.userPromptTemplate?.trim()) {
      logger.error("Rewrite prompt missing systemPrompt or userPromptTemplate.", { promptId });
      return;
    }

    // Get segments in chapter
    const segments = state.selectSegmentsInChapter(chapterId);
    if (!segments.length) {
      logger.error("No segments in chapter.", { chapterId });
      return;
    }

    // Create abort controller
    const abortController = new AbortController();

    // Set processing state
    set({
      rewriteInProgress: true,
      rewriteChapterId: chapterId,
      rewriteError: null,
      rewriteAbortController: abortController,
    });

    try {
      const result = await rewriteChapter({
        chapter,
        segments,
        allChapters: state.chapters,
        prompt,
        providerId: state.aiChapterDetectionConfig.selectedProviderId,
        model: state.aiChapterDetectionConfig.selectedModel,
        signal: abortController.signal,
        includeContext: state.aiChapterDetectionConfig.includeContext,
        contextWordLimit: state.aiChapterDetectionConfig.contextWordLimit,
        customInstructions: customInstructions,
      });

      // Clear processing state first
      set({
        rewriteInProgress: false,
        rewriteChapterId: null,
        rewriteAbortController: null,
      });

      get().setRewriteDraft(chapterId, {
        text: result.rewrittenText,
        promptId,
        providerId: state.aiChapterDetectionConfig.selectedProviderId,
        model: state.aiChapterDetectionConfig.selectedModel,
      });
    } catch (error) {
      logger.error("Rewrite failed.", { error });

      set({
        rewriteInProgress: false,
        rewriteChapterId: null,
        rewriteError: error instanceof Error ? error.message : "Unknown error",
        rewriteAbortController: null,
      });
    }
  },

  cancelRewrite: () => {
    const state = get();
    state.rewriteAbortController?.abort();

    set({
      rewriteInProgress: false,
      rewriteChapterId: null,
      rewriteAbortController: null,
    });
  },

  setRewriteDraft: (chapterId, draft) => {
    set((state) => ({
      rewriteDraftByChapterId: {
        ...state.rewriteDraftByChapterId,
        [chapterId]: draft,
      },
    }));
  },

  clearRewriteDraft: (chapterId) => {
    set((state) => {
      if (!(chapterId in state.rewriteDraftByChapterId)) {
        return state;
      }

      const { [chapterId]: _removed, ...rest } = state.rewriteDraftByChapterId;
      return {
        rewriteDraftByChapterId: rest,
      };
    });
  },

  startBatchRewrite: async ({ promptId, customInstructions, skipAlreadyRewritten }) => {
    get().batchRewriteAbortController?.abort();

    const state = get();
    const prompt = state.aiChapterDetectionConfig.prompts.find((item) => item.id === promptId);
    if (!prompt || !prompt.systemPrompt?.trim() || !prompt.userPromptTemplate?.trim()) {
      set({ batchRewriteError: t("aiBatch.errors.promptNotFound", { id: promptId }) });
      return;
    }

    const indexMap = buildSegmentIndexMap(state.segments);
    const sortedChapters = sortChaptersByStart(state.chapters, indexMap);
    const chaptersToProcess = skipAlreadyRewritten
      ? sortedChapters.filter(
          (chapter) => !chapter.rewrittenText && !state.rewriteDraftByChapterId[chapter.id],
        )
      : sortedChapters;

    if (chaptersToProcess.length === 0) {
      set({ batchRewriteError: t("rewriteBatch.errors.noChapters") });
      return;
    }

    const abortController = new AbortController();
    set({
      batchRewriteIsProcessing: true,
      batchRewriteIsCancelling: false,
      batchRewriteProcessedCount: 0,
      batchRewriteTotalCount: chaptersToProcess.length,
      batchRewriteError: null,
      batchRewriteAbortController: abortController,
      batchRewriteLog: [],
    });

    const replaceLogEntry = (entry: RewriteBatchLogEntry) => {
      set((current) => ({
        batchRewriteLog: current.batchRewriteLog.map((item) =>
          item.chapterId === entry.chapterId && item.status === "processing" ? entry : item,
        ),
      }));
    };

    const cancelFrom = (currentChapterIndex: number, currentStartedAt?: number) => {
      if (get().batchRewriteAbortController !== abortController) return;
      const currentChapter = chaptersToProcess[currentChapterIndex];
      if (currentChapter && currentStartedAt !== undefined) {
        replaceLogEntry({
          chapterId: currentChapter.id,
          chapterTitle: currentChapter.title,
          status: "cancelled",
          loggedAt: Date.now(),
          durationMs: Date.now() - currentStartedAt,
          promptId,
        });
      }
      set((current) => ({
        batchRewriteLog: [
          ...current.batchRewriteLog,
          ...chaptersToProcess.slice(currentChapterIndex + 1).map((item) => ({
            chapterId: item.id,
            chapterTitle: item.title,
            status: "cancelled" as const,
            loggedAt: Date.now(),
            promptId,
          })),
        ],
        batchRewriteIsProcessing: false,
        batchRewriteIsCancelling: false,
        batchRewriteAbortController: null,
      }));
    };

    for (let index = 0; index < chaptersToProcess.length; index += 1) {
      const chapter = chaptersToProcess[index];
      if (abortController.signal.aborted) {
        cancelFrom(index - 1);
        return;
      }

      const startedAt = Date.now();
      set((current) => ({
        batchRewriteLog: [
          ...current.batchRewriteLog,
          {
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            status: "processing",
            loggedAt: startedAt,
            promptId,
          },
        ],
      }));

      try {
        const segments = get().selectSegmentsInChapter(chapter.id);
        if (segments.length === 0) {
          replaceLogEntry({
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            status: "skipped",
            loggedAt: Date.now(),
            durationMs: Date.now() - startedAt,
            promptId,
          });
          set((current) => ({
            batchRewriteProcessedCount: current.batchRewriteProcessedCount + 1,
          }));
          continue;
        }

        const currentDrafts = get().rewriteDraftByChapterId;
        const allChaptersWithDrafts = get().chapters.map((item) => {
          const draft = currentDrafts[item.id];
          return draft?.text ? { ...item, rewrittenText: draft.text } : item;
        });

        const result = await rewriteChapter({
          chapter,
          segments,
          allChapters: allChaptersWithDrafts,
          prompt,
          providerId: get().aiChapterDetectionConfig.selectedProviderId,
          model: get().aiChapterDetectionConfig.selectedModel,
          signal: abortController.signal,
          includeContext: get().aiChapterDetectionConfig.includeContext,
          contextWordLimit: get().aiChapterDetectionConfig.contextWordLimit,
          customInstructions,
        });

        if (abortController.signal.aborted) {
          cancelFrom(index, startedAt);
          return;
        }

        get().setRewriteDraft(chapter.id, {
          text: result.rewrittenText,
          promptId,
          providerId: get().aiChapterDetectionConfig.selectedProviderId,
          model: get().aiChapterDetectionConfig.selectedModel,
        });

        replaceLogEntry({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          status: "done",
          loggedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          promptId,
        });
        set((current) => ({ batchRewriteProcessedCount: current.batchRewriteProcessedCount + 1 }));
      } catch (error) {
        if (abortController.signal.aborted || isAbortError(error)) {
          cancelFrom(index, startedAt);
          return;
        }

        replaceLogEntry({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          status: "failed",
          loggedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
          promptId,
        });
        set((current) => ({ batchRewriteProcessedCount: current.batchRewriteProcessedCount + 1 }));
      }
    }

    set({
      ...(get().batchRewriteAbortController === abortController
        ? {
            batchRewriteIsProcessing: false,
            batchRewriteIsCancelling: false,
            batchRewriteAbortController: null,
            batchRewriteError: null,
          }
        : {}),
    });
  },

  cancelBatchRewrite: () => {
    get().batchRewriteAbortController?.abort();
    set({ batchRewriteIsCancelling: true });
  },

  acceptAllBatchRewrites: () => {
    const state = get();
    for (const [chapterId, draft] of Object.entries(state.rewriteDraftByChapterId)) {
      if (!draft) continue;
      state.setChapterRewrite(chapterId, draft.text, {
        promptId: draft.promptId,
        providerId: draft.providerId,
        model: draft.model,
      });
      state.clearRewriteDraft(chapterId);
      state.setChapterDisplayMode(chapterId, "rewritten");
    }
  },

  rejectAllBatchRewrites: () => {
    for (const chapterId of Object.keys(get().rewriteDraftByChapterId)) {
      get().clearRewriteDraft(chapterId);
    }
  },

  startParagraphRewrite: async (chapterId, paragraphIndex, promptId, customInstructions) => {
    const state = get();

    const chapter = state.chapters.find((c) => c.id === chapterId);
    const draft = state.rewriteDraftByChapterId[chapterId];
    const sourceText = draft?.text ?? chapter?.rewrittenText;

    if (!chapter || !sourceText) {
      logger.error("Chapter or rewrite source text not found.", { chapterId });
      return;
    }

    const prompt = state.aiChapterDetectionConfig.prompts.find((p) => p.id === promptId);
    if (!prompt) {
      logger.error("Prompt not found.", { promptId });
      return;
    }
    if (prompt.operation !== "rewrite" || prompt.rewriteScope !== "paragraph") {
      logger.error("Prompt is not a paragraph rewrite prompt.", { promptId });
      return;
    }
    if (!prompt.systemPrompt?.trim() || !prompt.userPromptTemplate?.trim()) {
      logger.error("Rewrite prompt missing systemPrompt or userPromptTemplate.", { promptId });
      return;
    }

    const paragraphs = splitRewrittenParagraphs(sourceText);
    const paragraph = paragraphs[paragraphIndex];
    if (!paragraph) {
      logger.error("Paragraph index out of bounds.", { paragraphIndex });
      return;
    }

    const previousParagraphs = getPreviousParagraphs(
      paragraphs,
      paragraphIndex,
      state.aiChapterDetectionConfig.paragraphContextCount,
    );

    const abortController = new AbortController();

    set({
      paragraphRewriteInProgress: true,
      paragraphRewriteChapterId: chapterId,
      paragraphRewriteParagraphIndex: paragraphIndex,
      paragraphRewriteError: null,
      paragraphRewriteAbortController: abortController,
    });

    try {
      const result = await rewriteParagraph({
        chapter,
        paragraphContent: paragraph,
        previousParagraphs,
        paragraphContextCount: state.aiChapterDetectionConfig.paragraphContextCount,
        prompt,
        providerId: state.aiChapterDetectionConfig.selectedProviderId,
        model: state.aiChapterDetectionConfig.selectedModel,
        signal: abortController.signal,
        includeParagraphContext: state.aiChapterDetectionConfig.includeParagraphContext,
        customInstructions,
      });

      set({
        paragraphRewriteInProgress: false,
        paragraphRewriteChapterId: null,
        paragraphRewriteParagraphIndex: null,
        paragraphRewriteAbortController: null,
      });

      const updatedText = replaceParagraphAtIndex(sourceText, paragraphIndex, result.rewrittenText);
      const currentDraft = get().rewriteDraftByChapterId[chapterId];

      if (currentDraft) {
        get().setRewriteDraft(chapterId, {
          ...currentDraft,
          text: updatedText,
        });
      } else if (!draft) {
        get().updateChapterRewrite(chapterId, updatedText);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Paragraph rewrite failed.", { error });

      set({
        paragraphRewriteInProgress: false,
        paragraphRewriteChapterId: null,
        paragraphRewriteParagraphIndex: null,
        paragraphRewriteError: message,
        paragraphRewriteAbortController: null,
      });

      toast({
        title: t("rewrite.paragraph.errorTitle", { defaultValue: "Paragraph rewrite failed" }),
        description: message,
        variant: "destructive",
      });
    }
  },

  cancelParagraphRewrite: () => {
    const state = get();
    state.paragraphRewriteAbortController?.abort();

    set({
      paragraphRewriteInProgress: false,
      paragraphRewriteChapterId: null,
      paragraphRewriteParagraphIndex: null,
      paragraphRewriteAbortController: null,
    });
  },
});
