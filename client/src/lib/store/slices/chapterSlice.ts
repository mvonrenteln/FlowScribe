import type { StoreApi } from "zustand";
import type { Chapter } from "@/types/chapter";
import type { ChapterSlice, TranscriptStore } from "../types";
import {
  getDynamicChapterRangeIndices,
  hasOverlappingChapters,
  memoizedBuildSegmentIndexMap,
  normalizeChapterCounts,
  recomputeChapterRangesFromStarts,
  sortChaptersByStart,
} from "../utils/chapters";
import { generateId } from "../utils/id";
import {
  cancelChapterMetadata,
  clearChapterMetadataSuggestions,
  generateChapterNotes,
  generateChapterSummary,
  suggestChapterTitle,
} from "./chapterMetadataActions";
import { addToHistory } from "./historySlice";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

/**
 * Cache for selectSegmentsInChapter results.
 * Key format: `${chapterId}:${filtersActive}:${filteredSegmentIds.size}:${segments.length}`
 */
const segmentsInChapterCache = new Map<
  string,
  ReturnType<ChapterSlice["selectSegmentsInChapter"]>
>();

/**
 * Zustand slice for manual chapter CRUD and lookup selectors.
 */
export const createChapterSlice = (set: StoreSetter, get: StoreGetter): ChapterSlice => ({
  startChapter: (title, startSegmentId, tags) => {
    const {
      chapters,
      segments,
      speakers,
      tags: sessionTags,
      history,
      historyIndex,
      selectedSegmentId,
      currentTime,
      confidenceScoresVersion,
    } = get();

    if (!segments.length) return undefined;
    const indexById = memoizedBuildSegmentIndexMap(segments);
    const startIndex = indexById.get(startSegmentId);
    if (startIndex === undefined) return undefined;

    const existing = chapters.find((chapter) => chapter.startSegmentId === startSegmentId);
    if (existing) {
      set({ selectedChapterId: existing.id });
      return existing.id;
    }

    let prevChapter: Chapter | undefined;
    let nextChapter: Chapter | undefined;
    const sorted = sortChaptersByStart(chapters, indexById);
    for (const chapter of sorted) {
      const chapterStartIndex = indexById.get(chapter.startSegmentId);
      if (chapterStartIndex === undefined) continue;
      if (chapterStartIndex > startIndex) {
        nextChapter = chapter;
        break;
      }
      prevChapter = chapter;
    }

    const nextStartIndex = nextChapter ? indexById.get(nextChapter.startSegmentId) : undefined;
    const resolvedEndIndex =
      nextStartIndex !== undefined
        ? Math.max(startIndex, nextStartIndex - 1)
        : Math.max(startIndex, segments.length - 1);
    const endSegmentId = segments[resolvedEndIndex]?.id ?? startSegmentId;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return undefined;

    const newChapter: Chapter = {
      id: generateId(),
      title: trimmedTitle,
      summary: undefined,
      notes: undefined,
      tags: tags && tags.length > 0 ? tags : undefined,
      startSegmentId,
      endSegmentId,
      segmentCount: resolvedEndIndex - startIndex + 1,
      createdAt: Date.now(),
      source: "manual",
    };

    const updatedChapters = chapters.map((chapter) => {
      if (!prevChapter || chapter.id !== prevChapter.id || startIndex <= 0) return chapter;
      const prevEndId = segments[startIndex - 1]?.id;
      if (!prevEndId) return chapter;
      return { ...chapter, endSegmentId: prevEndId };
    });
    updatedChapters.push(newChapter);

    const normalized = normalizeChapterCounts(updatedChapters, indexById);
    if (hasOverlappingChapters(normalized, indexById)) return undefined;
    const ordered = sortChaptersByStart(normalized, indexById);

    const nextHistory = addToHistory(history, historyIndex, {
      segments,
      speakers,
      tags: sessionTags,
      chapters: ordered,
      selectedSegmentId,
      selectedChapterId: newChapter.id,
      currentTime,
      confidenceScoresVersion,
    });

    set({
      chapters: ordered,
      selectedChapterId: newChapter.id,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
    return newChapter.id;
  },

  updateChapter: (id, updates) => {
    const {
      chapters,
      segments,
      speakers,
      tags,
      history,
      historyIndex,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    } = get();
    const existing = chapters.find((chapter) => chapter.id === id);
    if (!existing) return;
    if (updates.title !== undefined && updates.title.trim() === "") return;

    const nextChapters = chapters.map((chapter) =>
      chapter.id === id
        ? {
            ...chapter,
            ...updates,
            title: updates.title !== undefined ? updates.title.trim() : chapter.title,
          }
        : chapter,
    );
    const indexById = memoizedBuildSegmentIndexMap(segments);
    const normalized = normalizeChapterCounts(nextChapters, indexById);
    if (hasOverlappingChapters(normalized, indexById)) return;
    const ordered = sortChaptersByStart(normalized, indexById);

    const nextHistory = addToHistory(history, historyIndex, {
      segments,
      speakers,
      tags,
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
  },

  moveChapterStart: (id, targetSegmentId) => {
    const {
      chapters,
      segments,
      speakers,
      tags,
      history,
      historyIndex,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    } = get();
    if (!chapters.length) return;

    const existing = chapters.find((chapter) => chapter.id === id);
    if (!existing) return;
    if (existing.startSegmentId === targetSegmentId) return;

    const indexById = memoizedBuildSegmentIndexMap(segments);
    const targetIndex = indexById.get(targetSegmentId);
    if (targetIndex === undefined) return;

    const ordered = sortChaptersByStart(chapters, indexById);
    const currentIndex = ordered.findIndex((chapter) => chapter.id === id);
    if (currentIndex === -1) return;

    const prevChapter = ordered[currentIndex - 1];
    const nextChapter = ordered[currentIndex + 1];
    const prevStartIndex = prevChapter ? indexById.get(prevChapter.startSegmentId) : undefined;
    const nextStartIndex = nextChapter ? indexById.get(nextChapter.startSegmentId) : undefined;

    if (prevStartIndex !== undefined && targetIndex <= prevStartIndex) return;
    if (nextStartIndex !== undefined && targetIndex >= nextStartIndex) return;
    if (
      chapters.some((chapter) => chapter.id !== id && chapter.startSegmentId === targetSegmentId)
    ) {
      return;
    }

    const updatedChapters = chapters.map((chapter) =>
      chapter.id === id ? { ...chapter, startSegmentId: targetSegmentId } : chapter,
    );
    const recomputed = recomputeChapterRangesFromStarts(updatedChapters, segments, indexById);
    if (hasOverlappingChapters(recomputed, indexById)) return;

    const nextHistory = addToHistory(history, historyIndex, {
      segments,
      speakers,
      tags,
      chapters: recomputed,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    });

    set({
      chapters: recomputed,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  deleteChapter: (id) => {
    const {
      chapters,
      segments,
      speakers,
      tags,
      history,
      historyIndex,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    } = get();
    if (!chapters.some((chapter) => chapter.id === id)) return;
    const indexById = memoizedBuildSegmentIndexMap(segments);
    const nextChapters = chapters.filter((chapter) => chapter.id !== id);
    const normalized = normalizeChapterCounts(nextChapters, indexById);
    const ordered = sortChaptersByStart(normalized, indexById);
    const nextSelectedChapterId = selectedChapterId === id ? null : selectedChapterId;

    const nextHistory = addToHistory(history, historyIndex, {
      segments,
      speakers,
      tags,
      chapters: ordered,
      selectedSegmentId,
      selectedChapterId: nextSelectedChapterId,
      currentTime,
      confidenceScoresVersion,
    });

    set({
      chapters: ordered,
      selectedChapterId: nextSelectedChapterId,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  selectChapter: (id) => set({ selectedChapterId: id }),

  clearChapters: () => {
    const {
      segments,
      speakers,
      tags,
      history,
      historyIndex,
      selectedSegmentId,
      currentTime,
      confidenceScoresVersion,
    } = get();
    const nextHistory = addToHistory(history, historyIndex, {
      segments,
      speakers,
      tags,
      chapters: [],
      selectedSegmentId,
      selectedChapterId: null,
      currentTime,
      confidenceScoresVersion,
    });
    set({
      chapters: [],
      selectedChapterId: null,
      history: nextHistory.history,
      historyIndex: nextHistory.historyIndex,
    });
  },

  selectAllChapters: () => get().chapters,

  selectChapterById: (id) => get().chapters.find((chapter) => chapter.id === id),

  selectChapterForSegment: (segmentId) => {
    const { chapters, segments } = get();
    const indexById = memoizedBuildSegmentIndexMap(get().segments);
    const segmentIndex = indexById.get(segmentId);
    if (segmentIndex === undefined) return undefined;
    const ordered = sortChaptersByStart(chapters, indexById);
    for (let i = 0; i < ordered.length; i++) {
      const chapter = ordered[i];
      const startIndex = indexById.get(chapter.startSegmentId);
      if (startIndex === undefined) continue;

      const nextChapter = ordered[i + 1];
      const nextStartIndex = nextChapter ? indexById.get(nextChapter.startSegmentId) : undefined;
      if (nextStartIndex !== undefined && nextStartIndex <= startIndex) continue;

      const endIndex =
        nextStartIndex !== undefined ? nextStartIndex - 1 : Math.max(0, segments.length - 1);
      if (segmentIndex >= startIndex && segmentIndex <= endIndex) {
        return chapter;
      }
    }
    return undefined;
  },

  selectSegmentsInChapter: (chapterId) => {
    const { chapters, segments, filteredSegmentIds, filtersActive } = get();

    // Build cache key from relevant state
    const chapterBoundarySignature = chapters
      .map((chapter) => `${chapter.id}:${chapter.startSegmentId}`)
      .join("|");
    const filteredSignature = filtersActive ? Array.from(filteredSegmentIds).join("|") : "";
    const cacheKey = `${chapterId}:${segments.length}:${filtersActive ? "1" : "0"}:${chapterBoundarySignature}:${filteredSignature}`;
    const cached = segmentsInChapterCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter) {
      segmentsInChapterCache.set(cacheKey, []);
      return [];
    }

    const indexById = memoizedBuildSegmentIndexMap(segments);
    const range = getDynamicChapterRangeIndices(chapter.id, chapters, indexById, segments.length);
    if (!range) {
      segmentsInChapterCache.set(cacheKey, []);
      return [];
    }

    const allSegments = segments.slice(range.startIndex, range.endIndex + 1);

    // If filters are active, only return filtered segments (even if empty).
    let result: typeof allSegments;
    if (filtersActive) {
      result = allSegments.filter((seg) => filteredSegmentIds.has(seg.id));
    } else {
      result = allSegments;
    }

    // Cache result (limit cache size to prevent memory leaks)
    if (segmentsInChapterCache.size > 100) {
      // Clear old entries (simple LRU-like behavior)
      const firstKey = segmentsInChapterCache.keys().next().value;
      if (firstKey !== undefined) segmentsInChapterCache.delete(firstKey);
    }
    segmentsInChapterCache.set(cacheKey, result);

    return result;
  },

  // Rewrite methods
  setChapterRewrite: (chapterId, rewrittenText, metadata) => {
    const {
      chapters,
      segments,
      speakers,
      tags,
      history,
      historyIndex,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    } = get();

    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) return;

    const updatedChapters = chapters.map((c) =>
      c.id === chapterId
        ? {
            ...c,
            rewrittenText,
            rewrittenAt: Date.now(),
            rewritePromptId: metadata.promptId,
            rewriteContext: {
              model: metadata.model,
              providerId: metadata.providerId,
              wordCount: rewrittenText.split(/\s+/).length,
            },
          }
        : c,
    );

    const nextHistory = addToHistory(history, historyIndex, {
      segments,
      speakers,
      tags,
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
    });
  },

  clearChapterRewrite: (chapterId) => {
    const {
      chapters,
      segments,
      speakers,
      tags,
      history,
      historyIndex,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    } = get();

    const updatedChapters = chapters.map((c) =>
      c.id === chapterId
        ? {
            ...c,
            rewrittenText: undefined,
            rewrittenAt: undefined,
            rewritePromptId: undefined,
            rewriteContext: undefined,
          }
        : c,
    );

    const nextHistory = addToHistory(history, historyIndex, {
      segments,
      speakers,
      tags,
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
    });
  },

  updateChapterRewrite: (chapterId, rewrittenText) => {
    const {
      chapters,
      segments,
      speakers,
      tags,
      history,
      historyIndex,
      selectedSegmentId,
      selectedChapterId,
      currentTime,
      confidenceScoresVersion,
    } = get();

    const updatedChapters = chapters.map((c) =>
      c.id === chapterId && c.rewrittenText
        ? {
            ...c,
            rewrittenText,
            rewriteContext: {
              ...c.rewriteContext,
              wordCount: rewrittenText.split(/\s+/).length,
            },
          }
        : c,
    );

    const nextHistory = addToHistory(history, historyIndex, {
      segments,
      speakers,
      tags,
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
    });
  },

  chapterDisplayModes: {},

  setChapterDisplayMode: (chapterId, mode) => {
    const current = get().chapterDisplayModes;
    // Skip update if mode is already set to this value
    if (current[chapterId] === mode) return;

    set({
      chapterDisplayModes: {
        ...current,
        [chapterId]: mode,
      },
    });
  },

  // Metadata AI actions
  suggestChapterTitle: async (chapterId, promptId, providerId, model) => {
    await suggestChapterTitle(chapterId, promptId, providerId, model)(set, get);
  },

  generateChapterSummary: async (chapterId, promptId, providerId, model) => {
    await generateChapterSummary(chapterId, promptId, providerId, model)(set, get);
  },

  generateChapterNotes: async (chapterId, promptId, providerId, model) => {
    await generateChapterNotes(chapterId, promptId, providerId, model)(set, get);
  },

  cancelChapterMetadata: () => {
    cancelChapterMetadata()(set, get);
  },

  clearChapterMetadataSuggestions: () => {
    clearChapterMetadataSuggestions()(set);
  },
});
