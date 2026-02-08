import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as chapterOpsService from '@/lib/ai/features/chapterOperations/service';
import {
    generateChapterNotes,
    generateChapterSummary,
    suggestChapterTitle,
} from '../chapterMetadataActions';
import type { ChapterPrompt } from '@/lib/ai/features/chapterOperations/types';

describe('chapterMetadataActions', () => {
    let set: any;
    let get: any;
    let state: any;

    const mockChapter = {
        id: 'c1',
        startSegmentId: 's1',
        title: 'Old Title',
        summary: 'Old Summary',
        notes: 'Old Notes',
    };

    const mockSegments = [
        { id: 's1', speaker: 'A', text: 'Text 1', start: 0, end: 1 },
    ];

    const mockPrompt: ChapterPrompt = {
        id: 'p1',
        name: 'Metadata Prompt',
        operation: 'metadata',
        systemPrompt: 'sys',
        userPromptTemplate: 'user',
        description: 'desc',
        isBuiltIn: false,
        quickAccess: false,
    };

    beforeEach(() => {
        set = vi.fn((update) => {
            // Simple shallow merge for testing
            state = { ...state, ...update };
        });

        state = {
            chapters: [mockChapter],
            selectSegmentsInChapter: vi.fn().mockReturnValue(mockSegments),
            aiChapterDetectionConfig: {
                prompts: [mockPrompt],
            },
            updateChapter: vi.fn(),
        };

        get = vi.fn().mockReturnValue(state);

        // Spy on service methods
        vi.spyOn(chapterOpsService, 'suggestTitles');
        vi.spyOn(chapterOpsService, 'generateSummary');
        vi.spyOn(chapterOpsService, 'generateNotes');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('suggestChapterTitle', () => {
        it('updates state with suggestions on success', async () => {
            vi.mocked(chapterOpsService.suggestTitles).mockResolvedValue({
                options: ['New Title 1', 'New Title 2'],
            });

            const action = suggestChapterTitle('c1', 'p1');
            await action(set, get);

            // Verify loading state set
            expect(set).toHaveBeenCalledWith(expect.objectContaining({
                chapterMetadataTitleLoading: true,
                chapterMetadataTitleChapterId: 'c1',
                chapterMetadataError: null,
            }));

            // Verify service call
            expect(chapterOpsService.suggestTitles).toHaveBeenCalledWith(
                mockPrompt,
                expect.objectContaining({
                    chapterId: 'c1',
                    chapterTitle: 'Old Title',
                }),
                expect.anything()
            );

            // Verify success state set
            expect(set).toHaveBeenCalledWith(expect.objectContaining({
                chapterMetadataTitleSuggestions: ['New Title 1', 'New Title 2'],
                chapterMetadataTitleLoading: false,
                chapterMetadataTitleChapterId: null,
            }));
        });

        it('handles errors gracefully', async () => {
            vi.mocked(chapterOpsService.suggestTitles).mockRejectedValue(new Error('AI Failed'));

            const action = suggestChapterTitle('c1', 'p1');
            await action(set, get);

            expect(set).toHaveBeenCalledWith(expect.objectContaining({
                chapterMetadataTitleLoading: false,
                chapterMetadataError: 'AI Failed',
            }));
        });
    });

    describe('generateChapterSummary', () => {
        it('updates chapter and state on success', async () => {
            vi.mocked(chapterOpsService.generateSummary).mockResolvedValue({
                summary: 'Generated Summary',
            });

            const action = generateChapterSummary('c1', 'p1');
            await action(set, get);

            expect(chapterOpsService.generateSummary).toHaveBeenCalled();

            // Verify chapter update
            expect(state.updateChapter).toHaveBeenCalledWith('c1', { summary: 'Generated Summary' });

            // Verify state reset
            expect(set).toHaveBeenCalledWith(expect.objectContaining({
                chapterMetadataSummaryLoading: false,
                chapterMetadataSummaryChapterId: null,
            }));
        });
    });

    describe('generateChapterNotes', () => {
        it('updates chapter and state on success', async () => {
            vi.mocked(chapterOpsService.generateNotes).mockResolvedValue({
                notes: 'Generated Notes',
            });

            const action = generateChapterNotes('c1', 'p1');
            await action(set, get);

            expect(chapterOpsService.generateNotes).toHaveBeenCalled();

            // Verify chapter update
            expect(state.updateChapter).toHaveBeenCalledWith('c1', { notes: 'Generated Notes' });

            // Verify state reset
            expect(set).toHaveBeenCalledWith(expect.objectContaining({
                chapterMetadataNotesLoading: false,
                chapterMetadataNotesChapterId: null,
            }));
        });
    });
});
