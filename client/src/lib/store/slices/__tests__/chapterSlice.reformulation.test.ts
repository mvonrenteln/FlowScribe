/**
 * Tests for Chapter Reformulation Actions in ChapterSlice
 */

import { beforeEach, describe, expect, it } from "vitest";
import { create } from "zustand";
import type { Chapter } from "@/types/chapter";
import type { ChapterSlice, HistorySlice, TranscriptStore } from "../../types";
import { createChapterSlice } from "../chapterSlice";
import { createHistorySlice } from "../historySlice";

// Minimal store setup for testing
type TestStore = Pick<
  TranscriptStore,
  | "chapters"
  | "segments"
  | "speakers"
  | "tags"
  | "selectedSegmentId"
  | "selectedChapterId"
  | "currentTime"
  | "confidenceScoresVersion"
  | "history"
  | "historyIndex"
  | "chapterDisplayModes"
> &
  ChapterSlice &
  HistorySlice;

describe("ChapterSlice Reformulation", () => {
  let store: ReturnType<typeof create<TestStore>>;
  let testChapter: Chapter;

  beforeEach(() => {
    testChapter = {
      id: "chapter-1",
      title: "Test Chapter",
      summary: "Test summary",
      startSegmentId: "seg-1",
      endSegmentId: "seg-3",
      segmentCount: 3,
      createdAt: Date.now(),
      source: "manual",
    };

    store = create<TestStore>()((set, get) => ({
      chapters: [testChapter],
      segments: [],
      speakers: [],
      tags: [],
      selectedSegmentId: null,
      selectedChapterId: null,
      currentTime: 0,
      confidenceScoresVersion: 0,
      history: [],
      historyIndex: -1,
      chapterDisplayModes: {},
      ...createChapterSlice(set, get),
      ...createHistorySlice(set, get),
    }));
  });

  describe("setChapterReformulation", () => {
    it("should set reformulated text and metadata", () => {
      const reformulatedText = "This is the reformulated text.";
      const metadata = {
        promptId: "builtin-summarize",
        providerId: "openai",
        model: "gpt-4",
      };

      store.getState().setChapterReformulation("chapter-1", reformulatedText, metadata);

      const chapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      expect(chapter?.reformulatedText).toBe(reformulatedText);
      expect(chapter?.reformulationPromptId).toBe(metadata.promptId);
      expect(chapter?.reformulationContext).toMatchObject({
        providerId: metadata.providerId,
        model: metadata.model,
        wordCount: 5,
      });
      expect(chapter?.reformulatedAt).toBeDefined();
    });

    it("should calculate word count correctly", () => {
      const reformulatedText = "One two three four five.";

      store.getState().setChapterReformulation("chapter-1", reformulatedText, {
        promptId: "test-prompt",
      });

      const chapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      expect(chapter?.reformulationContext?.wordCount).toBe(5);
    });

    it("should add to history", () => {
      const initialHistoryLength = store.getState().history.length;

      store.getState().setChapterReformulation("chapter-1", "Reformulated text", {
        promptId: "test-prompt",
      });

      const historyLength = store.getState().history.length;
      expect(historyLength).toBeGreaterThan(initialHistoryLength);
    });

    it("should do nothing for non-existent chapter", () => {
      const initialChapters = store.getState().chapters;

      store.getState().setChapterReformulation("non-existent", "Text", {
        promptId: "test-prompt",
      });

      expect(store.getState().chapters).toEqual(initialChapters);
    });
  });

  describe("clearChapterReformulation", () => {
    beforeEach(() => {
      // Set up a chapter with reformulation
      store.getState().setChapterReformulation("chapter-1", "Reformulated text", {
        promptId: "test-prompt",
        providerId: "test-provider",
        model: "test-model",
      });
    });

    it("should clear reformulated text and metadata", () => {
      store.getState().clearChapterReformulation("chapter-1");

      const chapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      expect(chapter?.reformulatedText).toBeUndefined();
      expect(chapter?.reformulatedAt).toBeUndefined();
      expect(chapter?.reformulationPromptId).toBeUndefined();
      expect(chapter?.reformulationContext).toBeUndefined();
    });

    it("should preserve other chapter properties", () => {
      store.getState().clearChapterReformulation("chapter-1");

      const chapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      expect(chapter?.title).toBe("Test Chapter");
      expect(chapter?.summary).toBe("Test summary");
      expect(chapter?.id).toBe("chapter-1");
    });

    it("should add to history", () => {
      const initialHistoryLength = store.getState().history.length;

      store.getState().clearChapterReformulation("chapter-1");

      const historyLength = store.getState().history.length;
      expect(historyLength).toBeGreaterThan(initialHistoryLength);
    });
  });

  describe("updateChapterReformulation", () => {
    beforeEach(() => {
      // Set up a chapter with reformulation
      store.getState().setChapterReformulation("chapter-1", "Original reformulated text", {
        promptId: "test-prompt",
      });
    });

    it("should update reformulated text", () => {
      const newText = "Updated reformulated text with more words.";

      store.getState().updateChapterReformulation("chapter-1", newText);

      const chapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      expect(chapter?.reformulatedText).toBe(newText);
    });

    it("should update word count", () => {
      const newText = "One two three.";

      store.getState().updateChapterReformulation("chapter-1", newText);

      const chapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      expect(chapter?.reformulationContext?.wordCount).toBe(3);
    });

    it("should preserve other reformulation metadata", () => {
      const chapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      const originalPromptId = chapter?.reformulationPromptId;
      const originalReformulatedAt = chapter?.reformulatedAt;

      store.getState().updateChapterReformulation("chapter-1", "New text");

      const updatedChapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      expect(updatedChapter?.reformulationPromptId).toBe(originalPromptId);
      expect(updatedChapter?.reformulatedAt).toBe(originalReformulatedAt);
    });

    it("should do nothing if chapter has no reformulation", () => {
      store.getState().clearChapterReformulation("chapter-1");
      const chaptersBeforeUpdate = store.getState().chapters;

      store.getState().updateChapterReformulation("chapter-1", "New text");

      const chaptersAfterUpdate = store.getState().chapters;
      expect(chaptersAfterUpdate).toEqual(chaptersBeforeUpdate);
    });

    it("should add to history", () => {
      const initialHistoryLength = store.getState().history.length;

      store.getState().updateChapterReformulation("chapter-1", "Updated text");

      const historyLength = store.getState().history.length;
      expect(historyLength).toBeGreaterThan(initialHistoryLength);
    });
  });

  describe("setChapterDisplayMode", () => {
    it("should set display mode for chapter", () => {
      store.getState().setChapterDisplayMode("chapter-1", "reformulated");

      const displayMode = store.getState().chapterDisplayModes["chapter-1"];
      expect(displayMode).toBe("reformulated");
    });

    it("should toggle display mode", () => {
      store.getState().setChapterDisplayMode("chapter-1", "reformulated");
      expect(store.getState().chapterDisplayModes["chapter-1"]).toBe("reformulated");

      store.getState().setChapterDisplayMode("chapter-1", "original");
      expect(store.getState().chapterDisplayModes["chapter-1"]).toBe("original");
    });

    it("should handle multiple chapters independently", () => {
      const chapter2: Chapter = {
        id: "chapter-2",
        title: "Chapter 2",
        startSegmentId: "seg-4",
        endSegmentId: "seg-6",
        segmentCount: 3,
        createdAt: Date.now(),
        source: "manual",
      };

      store.setState((state) => ({
        chapters: [...state.chapters, chapter2],
      }));

      store.getState().setChapterDisplayMode("chapter-1", "reformulated");
      store.getState().setChapterDisplayMode("chapter-2", "original");

      const modes = store.getState().chapterDisplayModes;
      expect(modes["chapter-1"]).toBe("reformulated");
      expect(modes["chapter-2"]).toBe("original");
    });
  });
});
