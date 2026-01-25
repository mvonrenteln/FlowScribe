import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIChapterDetectionSlice, TranscriptStore } from "../../types";
import {
  createAIChapterDetectionSlice,
  initialAIChapterDetectionState,
} from "../aiChapterDetectionSlice";

vi.mock(import("@/lib/ai/features/chapterDetection"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    detectChapters: vi.fn(async () => ({
      chapters: [
        {
          id: "ai-1",
          title: "Chapter 1",
          startSegmentId: "seg-1",
          endSegmentId: "seg-2",
          segmentCount: 2,
          createdAt: Date.now(),
          source: "ai" as const,
        },
      ],
      issues: [],
      batchLog: [],
    })),
  };
});

const createMockStore = () => {
  const baseHistoryEntry = {
    segments: [
      { id: "seg-1", speaker: "A", start: 0, end: 1, text: "one", words: [] },
      { id: "seg-2", speaker: "A", start: 1, end: 2, text: "two", words: [] },
      { id: "seg-3", speaker: "B", start: 2, end: 3, text: "three", words: [] },
      { id: "seg-4", speaker: "B", start: 3, end: 4, text: "four", words: [] },
    ],
    speakers: [],
    tags: [],
    chapters: [],
    selectedSegmentId: null,
    selectedChapterId: null,
    currentTime: 0,
    confidenceScoresVersion: 0,
  };

  let state: Partial<TranscriptStore> = {
    ...initialAIChapterDetectionState,
    segments: baseHistoryEntry.segments,
    speakers: [],
    tags: [],
    chapters: [],
    selectedSegmentId: null,
    selectedChapterId: null,
    currentTime: 0,
    confidenceScoresVersion: 0,
    history: [baseHistoryEntry as TranscriptStore["history"][number]],
    historyIndex: 0,
  };

  const set = (
    partial: Partial<TranscriptStore> | ((s: TranscriptStore) => Partial<TranscriptStore>),
  ) => {
    if (typeof partial === "function") {
      state = { ...state, ...partial(state as TranscriptStore) };
    } else {
      state = { ...state, ...partial };
    }
  };

  const get = () => state as TranscriptStore;

  return { set, get, getState: () => state };
};

describe("aiChapterDetectionSlice", () => {
  let mockStore: ReturnType<typeof createMockStore>;
  let slice: AIChapterDetectionSlice;

  beforeEach(() => {
    mockStore = createMockStore();
    slice = createAIChapterDetectionSlice(mockStore.set, mockStore.get);
  });

  it("initialAIChapterDetectionState is not processing", () => {
    expect(initialAIChapterDetectionState.aiChapterDetectionIsProcessing).toBe(false);
  });

  it("acceptAllChapterSuggestions adds accepted chapters to store history", () => {
    mockStore.set({
      aiChapterDetectionSuggestions: [
        {
          id: "s-1",
          title: "AI Suggested",
          startSegmentId: "seg-1",
          endSegmentId: "seg-2",
          segmentCount: 2,
          createdAt: Date.now(),
          source: "ai",
          status: "pending",
        },
      ],
    });

    slice.acceptAllChapterSuggestions();
    const s = mockStore.getState() as TranscriptStore;
    expect(s.chapters?.length).toBe(1);
    expect(s.historyIndex).toBe(1);
  });

  it("acceptAllChapterSuggestions refuses overlaps with existing chapters", () => {
    mockStore.set({
      chapters: [
        {
          id: "manual-1",
          title: "Manual",
          startSegmentId: "seg-1",
          endSegmentId: "seg-3",
          segmentCount: 3,
          createdAt: Date.now(),
          source: "manual",
        },
      ],
      aiChapterDetectionSuggestions: [
        {
          id: "s-1",
          title: "Overlap",
          startSegmentId: "seg-2",
          endSegmentId: "seg-4",
          segmentCount: 3,
          createdAt: Date.now(),
          source: "ai",
          status: "pending",
        },
      ],
    });

    slice.acceptAllChapterSuggestions();
    const s = mockStore.getState() as TranscriptStore;
    expect(s.chapters?.length).toBe(1);
    expect(s.aiChapterDetectionError).toMatch(/overlap/i);
  });
});
