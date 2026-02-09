import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreApi } from "zustand";
import type { AIFeatureResult } from "@/lib/ai/core/types";
import type { ChapterPrompt } from "@/lib/ai/features/chapterOperations/types";
import type { ChapterSlice, HistorySlice, TranscriptStore } from "../../types";
import { createChapterSlice } from "../chapterSlice";
import { createHistorySlice } from "../historySlice";

// Mock executeFeature
const mockExecuteFeature = vi.hoisted(() =>
  vi.fn(async (featureId, _variables) => {
    if (featureId === "chapter-metadata") {
      // Check prompt name to decide return
      // We can't access prompt directly here easily in hoisted, but we can return generic success
      // Or we can rely on proper mocking in tests
      return {
        success: true,
        data: {
          operation: "summary",
          summary: "AI Generated Summary",
        },
        metadata: mockMetadata,
      };
    }
    return {
      success: false,
      error: "Unknown feature",
      metadata: mockMetadata,
    };
  }),
);

vi.mock(import("@/lib/ai/core/aiFeatureService"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    executeFeature: mockExecuteFeature,
  };
});

const mockMetadata: AIFeatureResult<unknown>["metadata"] = {
  featureId: "chapter-metadata",
  providerId: "test-provider",
  model: "test-model",
  durationMs: 1,
};

// Shared factory for AI chapter-detection config to avoid duplicated literals in tests
const getBaseAIChapterDetectionConfig = () => ({
  prompts: [
    {
      id: "prompt-summary",
      name: "Generate Summary",
      operation: "metadata",
      metadataType: "summary",
      systemPrompt: "sys",
      userPromptTemplate: "user",
    } as ChapterPrompt,
  ],
  batchSize: 10,
  minChapterLength: 60,
  maxChapterLength: 600,
  tagIds: [],
  enableAutoDetection: false,
  confidenceThreshold: 0.7,
  includeContext: true,
  contextWordLimit: 500,
  includeParagraphContext: true,
  paragraphContextCount: 2,
});

// Mock store setup
const createMockStore = () => {
  // Initial data
  const segments = [
    { id: "s1", start: 0, end: 10, text: "segment 1", speaker: "A", words: [] },
    { id: "s2", start: 10, end: 20, text: "segment 2", speaker: "B", words: [] },
  ];

  const chapters = [
    {
      id: "c1",
      title: "Initial Title",
      summary: "Initial Summary",
      startSegmentId: "s1",
      endSegmentId: "s2",
      segmentCount: 2,
      // Use a fixed timestamp to keep tests deterministic
      createdAt: 1670000000000,
      source: "manual" as const,
    },
  ];

  const baseHistoryEntry = {
    segments,
    speakers: [],
    tags: [],
    chapters,
    selectedSegmentId: null,
    selectedChapterId: null,
    currentTime: 0,
    confidenceScoresVersion: 0,
    filteredSegmentIds: new Set(),
    filtersActive: false,
  };

  let state: Partial<TranscriptStore> = {
    // Mock config for prompts
    aiChapterDetectionConfig: getBaseAIChapterDetectionConfig(),
    // Data
    ...baseHistoryEntry,
    history: [baseHistoryEntry],
    historyIndex: 0,

    // Mock slice methods dependencies
    selectSegmentsInChapter: (_id) => segments, // simplified
  };

  const set: StoreApi<TranscriptStore>["setState"] = (partial) => {
    if (typeof partial === "function") {
      state = { ...state, ...partial(state as TranscriptStore) };
    } else {
      state = { ...state, ...partial };
    }
  };

  const get = () => state as TranscriptStore;

  return { set, get, getState: () => state };
};

describe("ChapterMetadata Integration & Undo/Redo", () => {
  let mockStore: ReturnType<typeof createMockStore>;
  let chapterSlice: ChapterSlice;
  let historySlice: HistorySlice;

  beforeEach(() => {
    mockStore = createMockStore();
    chapterSlice = createChapterSlice(mockStore.set, mockStore.get);
    historySlice = createHistorySlice(mockStore.set, mockStore.get);

    // Inject slice methods into store state so get().method works
    mockStore.set((state) => ({
      ...state,
      ...chapterSlice,
      ...historySlice,
    }));

    mockExecuteFeature.mockClear();
  });

  it("updates summary and supports undo/redo", async () => {
    // 1. Verify initial state
    let state = mockStore.getState() as TranscriptStore;
    expect(state.chapters[0]?.summary).toBe("Initial Summary");
    expect(state.historyIndex).toBe(0);

    // 2. Trigger AI Summary Generation
    // This is async, calls executeFeature, then updateChapter
    await chapterSlice.generateChapterSummary("c1", "prompt-summary");

    // 3. Verify update
    state = mockStore.getState() as TranscriptStore;
    expect(state.chapters[0]?.summary).toBe("AI Generated Summary");
    expect(state.historyIndex).toBe(1);
    expect(state.history).toHaveLength(2);

    // 4. Trigger Undo
    historySlice.undo();

    // 5. Verify revert
    state = mockStore.getState() as TranscriptStore;
    expect(state.chapters[0]?.summary).toBe("Initial Summary");
    expect(state.historyIndex).toBe(0);

    // 6. Trigger Redo
    historySlice.redo();

    // 7. Verify re-apply
    state = mockStore.getState() as TranscriptStore;
    expect(state.chapters[0]?.summary).toBe("AI Generated Summary");
    expect(state.historyIndex).toBe(1);
  });

  it("updates notes and supports undo/redo", async () => {
    // Setup mock for notes
    mockExecuteFeature.mockResolvedValueOnce({
      success: true,
      data: { operation: "notes", notes: "AI Notes" },
      metadata: mockMetadata,
    });

    // Update prompt config in store to include notes prompt
    mockStore.set((s) => ({
      ...s,
      aiChapterDetectionConfig: {
        ...getBaseAIChapterDetectionConfig(),
        prompts: [
          {
            id: "prompt-notes",
            name: "Generate Notes", // implies 'notes' op
            operation: "metadata",
            metadataType: "notes",
            systemPrompt: "sys",
            userPromptTemplate: "user",
          } as ChapterPrompt,
        ],
      },
    }));

    // Trigger
    await chapterSlice.generateChapterNotes("c1", "prompt-notes");

    let state = mockStore.getState() as TranscriptStore;
    expect(state.chapters[0]?.notes).toBe("AI Notes");
    expect(state.historyIndex).toBe(1);

    // Undo
    historySlice.undo();
    state = mockStore.getState() as TranscriptStore;
    expect(state.chapters[0]?.notes).toBeUndefined(); // or previous value
    expect(state.historyIndex).toBe(0);

    // Redo
    historySlice.redo();
    state = mockStore.getState() as TranscriptStore;
    expect(state.chapters[0]?.notes).toBe("AI Notes");
    expect(state.historyIndex).toBe(1);
  });
});
