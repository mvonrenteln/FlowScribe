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

  it("acceptAllChapterSuggestions reconciles adjacent chapter boundaries", () => {
    mockStore.set({
      aiChapterDetectionSuggestions: [
        {
          id: "s-1",
          title: "Chapter 1",
          startSegmentId: "seg-1",
          endSegmentId: "seg-2",
          segmentCount: 2,
          createdAt: Date.now(),
          source: "ai",
          status: "pending",
        },
        {
          id: "s-2",
          title: "Chapter 2",
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
    expect(s.aiChapterDetectionError).toBeNull();
    expect(s.chapters?.length).toBe(2);
    const first = s.chapters?.find((chapter) => chapter.startSegmentId === "seg-1");
    const second = s.chapters?.find((chapter) => chapter.startSegmentId === "seg-2");
    expect(first?.endSegmentId).toBe("seg-1");
    expect(second?.startSegmentId).toBe("seg-2");
  });

  it("acceptAllChapterSuggestions keeps overlapping chapters by start and recomputes ends", () => {
    mockStore.set({
      chapters: [
        {
          id: "ai-1",
          title: "Old AI",
          startSegmentId: "seg-1",
          endSegmentId: "seg-3",
          segmentCount: 3,
          createdAt: Date.now(),
          source: "ai",
        },
      ],
      aiChapterDetectionSuggestions: [
        {
          id: "s-1",
          title: "New AI",
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
    expect(s.aiChapterDetectionError).toBeNull();
    expect(s.chapters?.length).toBe(2);
    const first = s.chapters?.find((chapter) => chapter.startSegmentId === "seg-1");
    const second = s.chapters?.find((chapter) => chapter.startSegmentId === "seg-2");
    expect(first?.endSegmentId).toBe("seg-1");
    expect(second?.startSegmentId).toBe("seg-2");
  });

  it("acceptChapterSuggestion keeps overlapping chapters by start and recomputes ends", () => {
    mockStore.set({
      chapters: [
        {
          id: "ai-1",
          title: "Old AI",
          startSegmentId: "seg-1",
          endSegmentId: "seg-3",
          segmentCount: 3,
          createdAt: Date.now(),
          source: "ai",
        },
      ],
      aiChapterDetectionSuggestions: [
        {
          id: "s-1",
          title: "New AI",
          startSegmentId: "seg-2",
          endSegmentId: "seg-4",
          segmentCount: 3,
          createdAt: Date.now(),
          source: "ai",
          status: "pending",
        },
      ],
    });

    slice.acceptChapterSuggestion("s-1");
    const s = mockStore.getState() as TranscriptStore;
    expect(s.aiChapterDetectionError).toBeNull();
    expect(s.chapters?.length).toBe(2);
    const first = s.chapters?.find((chapter) => chapter.startSegmentId === "seg-1");
    const second = s.chapters?.find((chapter) => chapter.startSegmentId === "seg-2");
    expect(first?.endSegmentId).toBe("seg-1");
    expect(second?.startSegmentId).toBe("seg-2");
  });

  it("acceptAllChapterSuggestions updates chapter when start matches", () => {
    mockStore.set({
      chapters: [
        {
          id: "manual-1",
          title: "Manual",
          startSegmentId: "seg-1",
          endSegmentId: "seg-2",
          segmentCount: 2,
          createdAt: Date.now(),
          source: "manual",
        },
      ],
      aiChapterDetectionSuggestions: [
        {
          id: "s-1",
          title: "Updated",
          startSegmentId: "seg-1",
          endSegmentId: "seg-3",
          segmentCount: 3,
          createdAt: Date.now(),
          source: "ai",
          status: "pending",
        },
      ],
    });

    slice.acceptAllChapterSuggestions();
    const s = mockStore.getState() as TranscriptStore;
    const updated = s.chapters?.find((chapter) => chapter.startSegmentId === "seg-1");
    expect(updated?.title).toBe("Updated");
    expect(updated?.id).toBe("manual-1");
  });

  it("addChapterDetectionPrompt appends a custom prompt", () => {
    const beforeCount = mockStore.getState().aiChapterDetectionConfig.prompts.length;
    slice.addChapterDetectionPrompt({
      name: "Custom Prompt",
      type: "chapter-detect",
      systemPrompt: "Custom system",
      userPromptTemplate: "Custom user",
      isBuiltIn: false,
      isDefault: false,
      quickAccess: false,
    });
    const state = mockStore.getState();
    expect(state.aiChapterDetectionConfig.prompts.length).toBe(beforeCount + 1);
    const added = state.aiChapterDetectionConfig.prompts.find((p) => p.name === "Custom Prompt");
    expect(added?.type).toBe("chapter-detect");
  });

  it("updateChapterDetectionPrompt updates prompt fields", () => {
    const promptId = mockStore.getState().aiChapterDetectionConfig.prompts[0]?.id;
    if (!promptId) throw new Error("missing default prompt");

    slice.updateChapterDetectionPrompt(promptId, {
      name: "Updated Name",
      userPromptTemplate: "Updated user",
    });
    const state = mockStore.getState();
    const updated = state.aiChapterDetectionConfig.prompts.find((p) => p.id === promptId);
    expect(updated?.name).toBe("Updated Name");
    expect(updated?.userPromptTemplate).toBe("Updated user");
    expect(updated?.type).toBe("chapter-detect");
  });

  it("deleteChapterDetectionPrompt removes prompt and repairs active id", () => {
    slice.addChapterDetectionPrompt({
      name: "Delete Me",
      type: "chapter-detect",
      systemPrompt: "Custom system",
      userPromptTemplate: "Custom user",
      isBuiltIn: false,
      isDefault: false,
      quickAccess: false,
    });
    const stateWithCustom = mockStore.getState();
    const customPrompt = stateWithCustom.aiChapterDetectionConfig.prompts.find(
      (p) => p.name === "Delete Me",
    );
    if (!customPrompt) throw new Error("missing custom prompt");
    slice.setActiveChapterDetectionPrompt(customPrompt.id);

    slice.deleteChapterDetectionPrompt(customPrompt.id);
    const state = mockStore.getState();
    expect(
      state.aiChapterDetectionConfig.prompts.find((p) => p.id === customPrompt.id),
    ).toBeFalsy();
    expect(state.aiChapterDetectionConfig.activePromptId).toBe(
      state.aiChapterDetectionConfig.prompts[0]?.id,
    );
  });
});
