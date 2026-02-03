/**
 * Tests for Chapter Rewrite Actions in ChapterSlice
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

describe("ChapterSlice Rewrite", () => {
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

  describe("setChapterRewrite", () => {
    it("should set rewritten text and metadata", () => {
      const rewrittenText = "This is the rewritten text.";
      const metadata = {
        promptId: "builtin-summarize",
        providerId: "openai",
        model: "gpt-4",
      };

      store.getState().setChapterRewrite("chapter-1", rewrittenText, metadata);

      const chapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      expect(chapter?.rewrittenText).toBe(rewrittenText);
      expect(chapter?.rewritePromptId).toBe(metadata.promptId);
      expect(chapter?.rewriteContext).toMatchObject({
        providerId: metadata.providerId,
        model: metadata.model,
        wordCount: 5,
      });
      expect(chapter?.rewrittenAt).toBeDefined();
    });

    it("should calculate word count correctly", () => {
      const rewrittenText = "One two three four five.";

      store.getState().setChapterRewrite("chapter-1", rewrittenText, {
        promptId: "test-prompt",
      });

      const chapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      expect(chapter?.rewriteContext?.wordCount).toBe(5);
    });

    it("should add to history", () => {
      const initialHistoryLength = store.getState().history.length;

      store.getState().setChapterRewrite("chapter-1", "Rewritten text", {
        promptId: "test-prompt",
      });

      const historyLength = store.getState().history.length;
      expect(historyLength).toBeGreaterThan(initialHistoryLength);
    });

    it("should do nothing for non-existent chapter", () => {
      const initialChapters = store.getState().chapters;

      store.getState().setChapterRewrite("non-existent", "Text", {
        promptId: "test-prompt",
      });

      expect(store.getState().chapters).toEqual(initialChapters);
    });
  });

  describe("clearChapterRewrite", () => {
    beforeEach(() => {
      // Set up a chapter with rewrite
      store.getState().setChapterRewrite("chapter-1", "Rewritten text", {
        promptId: "test-prompt",
        providerId: "test-provider",
        model: "test-model",
      });
    });

    it("should clear rewritten text and metadata", () => {
      store.getState().clearChapterRewrite("chapter-1");

      const chapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      expect(chapter?.rewrittenText).toBeUndefined();
      expect(chapter?.rewrittenAt).toBeUndefined();
      expect(chapter?.rewritePromptId).toBeUndefined();
      expect(chapter?.rewriteContext).toBeUndefined();
    });

    it("should preserve other chapter properties", () => {
      store.getState().clearChapterRewrite("chapter-1");

      const chapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      expect(chapter?.title).toBe("Test Chapter");
      expect(chapter?.summary).toBe("Test summary");
      expect(chapter?.id).toBe("chapter-1");
    });

    it("should add to history", () => {
      const initialHistoryLength = store.getState().history.length;

      store.getState().clearChapterRewrite("chapter-1");

      const historyLength = store.getState().history.length;
      expect(historyLength).toBeGreaterThan(initialHistoryLength);
    });
  });

  describe("updateChapterRewrite", () => {
    beforeEach(() => {
      // Set up a chapter with rewrite
      store.getState().setChapterRewrite("chapter-1", "Original rewritten text", {
        promptId: "test-prompt",
      });
    });

    it("should update rewritten text", () => {
      const newText = "Updated rewritten text with more words.";

      store.getState().updateChapterRewrite("chapter-1", newText);

      const chapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      expect(chapter?.rewrittenText).toBe(newText);
    });

    it("should update word count", () => {
      const newText = "One two three.";

      store.getState().updateChapterRewrite("chapter-1", newText);

      const chapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      expect(chapter?.rewriteContext?.wordCount).toBe(3);
    });

    it("should preserve other rewrite metadata", () => {
      const chapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      const originalPromptId = chapter?.rewritePromptId;
      const originalRewrittenAt = chapter?.rewrittenAt;

      store.getState().updateChapterRewrite("chapter-1", "New text");

      const updatedChapter = store.getState().chapters.find((c) => c.id === "chapter-1");
      expect(updatedChapter?.rewritePromptId).toBe(originalPromptId);
      expect(updatedChapter?.rewrittenAt).toBe(originalRewrittenAt);
    });

    it("should do nothing if chapter has no rewrite", () => {
      store.getState().clearChapterRewrite("chapter-1");
      const chaptersBeforeUpdate = store.getState().chapters;

      store.getState().updateChapterRewrite("chapter-1", "New text");

      const chaptersAfterUpdate = store.getState().chapters;
      expect(chaptersAfterUpdate).toEqual(chaptersBeforeUpdate);
    });

    it("should add to history", () => {
      const initialHistoryLength = store.getState().history.length;

      store.getState().updateChapterRewrite("chapter-1", "Updated text");

      const historyLength = store.getState().history.length;
      expect(historyLength).toBeGreaterThan(initialHistoryLength);
    });
  });

  describe("setChapterDisplayMode", () => {
    it("should set display mode for chapter", () => {
      store.getState().setChapterDisplayMode("chapter-1", "rewritten");

      const displayMode = store.getState().chapterDisplayModes["chapter-1"];
      expect(displayMode).toBe("rewritten");
    });

    it("should toggle display mode", () => {
      store.getState().setChapterDisplayMode("chapter-1", "rewritten");
      expect(store.getState().chapterDisplayModes["chapter-1"]).toBe("rewritten");

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

      store.getState().setChapterDisplayMode("chapter-1", "rewritten");
      store.getState().setChapterDisplayMode("chapter-2", "original");

      const modes = store.getState().chapterDisplayModes;
      expect(modes["chapter-1"]).toBe("rewritten");
      expect(modes["chapter-2"]).toBe("original");
    });
  });
});
