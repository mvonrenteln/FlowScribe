/**
 * Chapter Metadata Actions
 *
 * Actions for AI-powered chapter metadata generation (title, summary, notes).
 */

import type { ChapterPrompt } from '@/lib/ai/features/chapterOperations/types';
import {
    suggestTitles,
    generateSummary,
    generateNotes,
} from '@/lib/ai/features/chapterOperations/service';
import { createLogger } from '@/lib/logging';
import type { TranscriptStore } from '../types';
import type { StoreApi } from 'zustand';

type StoreSetter = StoreApi<TranscriptStore>['setState'];
type StoreGetter = StoreApi<TranscriptStore>['getState'];

const logger = createLogger({ feature: 'ChapterMetadata', namespace: 'Store' });

/**
 * Serialize chapter segments for AI context.
 */
function serializeChapterSegments(
    segments: Array<{ speaker: string; text: string; start: number; end: number }>,
): string {
    return segments
        .map((seg, idx) => `[${idx + 1}] ${seg.speaker}: ${seg.text}`)
        .join('\n');
}

/**
 * Suggest chapter title using AI.
 */
export function suggestChapterTitle(
    chapterId: string,
    promptId: string,
    providerId?: string,
    model?: string,
) {
    return async (set: StoreSetter, get: StoreGetter) => {
        const state = get();

        // Find chapter
        const chapter = state.chapters.find((c) => c.id === chapterId);
        if (!chapter) {
            logger.error('Chapter not found', { chapterId });
            return;
        }

        // Get segments
        const segments = state.selectSegmentsInChapter(chapterId);
        if (!segments.length) {
            logger.error('No segments in chapter', { chapterId });
            return;
        }

        // Find prompt (need to get from aiChapterDetectionConfig)
        const prompt = state.aiChapterDetectionConfig.prompts.find((p) => p.id === promptId) as ChapterPrompt | undefined;
        if (!prompt || prompt.operation !== 'metadata') {
            logger.error('Prompt not found or invalid operation', { promptId });
            return;
        }

        // Create abort controller
        const abortController = new AbortController();

        // Set loading state
        set({
            chapterMetadataTitleLoading: true,
            chapterMetadataTitleChapterId: chapterId,
            chapterMetadataError: null,
            chapterMetadataAbortController: abortController,
        });

        try {
            const result = await suggestTitles(
                prompt,
                {
                    chapterId,
                    chapterSegments: serializeChapterSegments(segments),
                    chapterTitle: chapter.title,
                },
                {
                    providerId,
                    model,
                    signal: abortController.signal,
                },
            );

            // Update state with suggestions
            set({
                chapterMetadataTitleSuggestions: result.options,
                chapterMetadataTitleLoading: false,
                chapterMetadataTitleChapterId: null,
                chapterMetadataAbortController: null,
            });
        } catch (error) {
            logger.error('Title suggestion failed', { error });

            set({
                chapterMetadataTitleLoading: false,
                chapterMetadataTitleChapterId: null,
                chapterMetadataError: error instanceof Error ? error.message : 'Unknown error',
                chapterMetadataAbortController: null,
            });
        }
    };
}

/**
 * Generate or improve chapter summary using AI.
 */
export function generateChapterSummary(
    chapterId: string,
    promptId: string,
    providerId?: string,
    model?: string,
) {
    return async (set: StoreSetter, get: StoreGetter) => {
        const state = get();

        // Find chapter
        const chapter = state.chapters.find((c) => c.id === chapterId);
        if (!chapter) {
            logger.error('Chapter not found', { chapterId });
            return;
        }

        // Get segments
        const segments = state.selectSegmentsInChapter(chapterId);
        if (!segments.length) {
            logger.error('No segments in chapter', { chapterId });
            return;
        }

        // Find prompt
        const prompt = state.aiChapterDetectionConfig.prompts.find((p) => p.id === promptId) as ChapterPrompt | undefined;


        if (!prompt || prompt.operation !== 'metadata') {
            logger.error('Prompt not found or invalid operation', { promptId });
            return;
        }

        // Create abort controller
        const abortController = new AbortController();

        // Set loading state
        set({
            chapterMetadataSummaryLoading: true,
            chapterMetadataSummaryChapterId: chapterId,
            chapterMetadataError: null,
            chapterMetadataAbortController: abortController,
        });

        try {
            const result = await generateSummary(
                prompt,
                {
                    chapterId,
                    chapterSegments: serializeChapterSegments(segments),
                    chapterTitle: chapter.title,
                    currentSummary: chapter.summary,
                },
                {
                    providerId,
                    model,
                    signal: abortController.signal,
                },
            );

            // Update chapter with new summary (via updateChapter)
            get().updateChapter(chapterId, { summary: result.summary });

            set({
                chapterMetadataSummaryLoading: false,
                chapterMetadataSummaryChapterId: null,
                chapterMetadataAbortController: null,
            });
        } catch (error) {
            logger.error('Summary generation failed', { error });

            set({
                chapterMetadataSummaryLoading: false,
                chapterMetadataSummaryChapterId: null,
                chapterMetadataError: error instanceof Error ? error.message : 'Unknown error',
                chapterMetadataAbortController: null,
            });
        }
    };
}

/**
 * Generate chapter notes using AI.
 */
export function generateChapterNotes(
    chapterId: string,
    promptId: string,
    providerId?: string,
    model?: string,
) {
    return async (set: StoreSetter, get: StoreGetter) => {
        const state = get();

        // Find chapter
        const chapter = state.chapters.find((c) => c.id === chapterId);
        if (!chapter) {
            logger.error('Chapter not found', { chapterId });
            return;
        }

        // Get segments
        const segments = state.selectSegmentsInChapter(chapterId);
        if (!segments.length) {
            logger.error('No segments in chapter', { chapterId });
            return;
        }

        // Find prompt
        const prompt = state.aiChapterDetectionConfig.prompts.find((p) => p.id === promptId) as ChapterPrompt | undefined;
        if (!prompt || prompt.operation !== 'metadata') {
            logger.error('Prompt not found or invalid operation', { promptId });
            return;
        }

        // Create abort controller
        const abortController = new AbortController();

        // Set loading state
        set({
            chapterMetadataNotesLoading: true,
            chapterMetadataNotesChapterId: chapterId,
            chapterMetadataError: null,
            chapterMetadataAbortController: abortController,
        });

        try {
            const result = await generateNotes(
                prompt,
                {
                    chapterId,
                    chapterSegments: serializeChapterSegments(segments),
                    chapterTitle: chapter.title,
                    currentSummary: chapter.summary,
                    currentNotes: chapter.notes,
                },
                {
                    providerId,
                    model,
                    signal: abortController.signal,
                },
            );

            // Update chapter with new notes (via updateChapter)
            get().updateChapter(chapterId, { notes: result.notes });

            set({
                chapterMetadataNotesLoading: false,
                chapterMetadataNotesChapterId: null,
                chapterMetadataAbortController: null,
            });
        } catch (error) {
            logger.error('Notes generation failed', { error });

            set({
                chapterMetadataNotesLoading: false,
                chapterMetadataNotesChapterId: null,
                chapterMetadataError: error instanceof Error ? error.message : 'Unknown error',
                chapterMetadataAbortController: null,
            });
        }
    };
}

/**
 * Cancel ongoing metadata operation.
 */
export function cancelChapterMetadata() {
    return (set: StoreSetter, get: StoreGetter) => {
        const state = get();
        state.chapterMetadataAbortController?.abort();

        set({
            chapterMetadataTitleLoading: false,
            chapterMetadataTitleChapterId: null,
            chapterMetadataSummaryLoading: false,
            chapterMetadataSummaryChapterId: null,
            chapterMetadataNotesLoading: false,
            chapterMetadataNotesChapterId: null,
            chapterMetadataAbortController: null,
        });
    };
}

/**
 * Clear suggestions (e.g., after user selects a title).
 */
export function clearChapterMetadataSuggestions() {
    return (set: StoreSetter) => {
        set({
            chapterMetadataTitleSuggestions: null,
            chapterMetadataError: null,
        });
    };
}
