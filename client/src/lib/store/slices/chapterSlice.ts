import type { StoreApi } from "zustand";
import { getSegmentIndexById } from "@/lib/store";
import type { Chapter } from "@/types/chapter";
import type { ChapterSlice, TranscriptStore } from "../types";
import {
  getChapterRangeIndices,
  hasOverlappingChapters,
  normalizeChapterCounts,
  sortChaptersByStart,
} from "../utils/chapters";
import { generateId } from "../utils/id";
import { addToHistory } from "./historySlice";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

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
    const indexById = getSegmentIndexById();
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
    const indexById = getSegmentIndexById();
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
    const indexById = getSegmentIndexById();
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
    const indexById = getSegmentIndexById();
    const segmentIndex = indexById.get(segmentId);
    if (segmentIndex === undefined) return undefined;
    return chapters.find((chapter) => {
      const range = getChapterRangeIndices(chapter, indexById);
      if (!range) return false;
      return segmentIndex >= range.startIndex && segmentIndex <= range.endIndex;
    });
  },

  selectSegmentsInChapter: (chapterId) => {
    const { chapters, segments } = get();
    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter) return [];
    const indexById = getSegmentIndexById();
    const range = getChapterRangeIndices(chapter, indexById);
    if (!range) return [];
    return segments.slice(range.startIndex, range.endIndex + 1);
  },
});
