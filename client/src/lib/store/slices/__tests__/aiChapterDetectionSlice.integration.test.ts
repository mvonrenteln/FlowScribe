import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIChapterDetectionSlice, TranscriptStore } from "../../types";
import {
  createAIChapterDetectionSlice,
  initialAIChapterDetectionState,
} from "../aiChapterDetectionSlice";

const mockExecuteFeature = vi.hoisted(() =>
  vi.fn(async () => ({
    success: true,
    data: {
      chapters: [
        {
          title: "Creature description and initial reactions",
          summary:
            "The group describes the monster's appearance, behavior, and considers their first possible actions.",
          tags: ["keep"],
          start: 1,
          end: 30,
          notes:
            "Establishes the scene, introduces the threat and each character's perspective, setting up the conflict.",
          confidence: 0.94,
        },
        {
          title: "Tactical brainstorming and initiative rolls",
          summary:
            "Players debate using the shield as a springboard, discuss the creature's size, and roll initiative and action dice.",
          tags: ["keep"],
          start: 31,
          end: 70,
          notes:
            "Develops strategy, resolves mechanical steps, and builds tension as the party prepares to act.",
          confidence: 0.92,
        },
        {
          title: "Equipment checks and movement decision",
          summary:
            "The party reviews armor, load, waits for Glymbar, and decides to advance toward the beast.",
          tags: ["keep"],
          start: 71,
          end: 100,
          notes:
            "Finalizes preparations, confirms readiness, and initiates the group's advance, moving the narrative forward.",
          confidence: 0.93,
        },
      ],
    },
    metadata: {
      featureId: "chapter-detection",
      providerId: "test-provider",
      model: "test-model",
      durationMs: 5,
    },
  })),
);

vi.mock(import("@/lib/ai/core/aiFeatureService"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    executeFeature: mockExecuteFeature,
  };
});

const buildSegments = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `seg-${index + 1}`,
    speaker: "A",
    start: index,
    end: index + 1,
    text: `segment ${index + 1}`,
    words: [],
  }));

const createMockStore = () => {
  const baseHistoryEntry = {
    segments: buildSegments(100),
    speakers: [],
    tags: [{ id: "keep", name: "Keep" }],
    chapters: [],
    selectedSegmentId: null,
    selectedChapterId: null,
    currentTime: 0,
    confidenceScoresVersion: 0,
  };

  let state: Partial<TranscriptStore> = {
    ...initialAIChapterDetectionState,
    segments: baseHistoryEntry.segments,
    speakers: baseHistoryEntry.speakers,
    tags: baseHistoryEntry.tags,
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

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("aiChapterDetectionSlice integration", () => {
  let mockStore: ReturnType<typeof createMockStore>;
  let slice: AIChapterDetectionSlice;

  beforeEach(() => {
    mockStore = createMockStore();
    slice = createAIChapterDetectionSlice(mockStore.set, mockStore.get);
    mockExecuteFeature.mockClear();
  });

  it("maps chapter detection response into suggestions for a full 100-segment batch", async () => {
    // force single-batch behavior by specifying batchSize=100
    slice.startChapterDetection({ batchSize: 100 });
    await flushPromises();
    await flushPromises();

    const state = mockStore.getState() as TranscriptStore;
    expect(state.aiChapterDetectionIsProcessing).toBe(false);
    expect(state.aiChapterDetectionError).toBeNull();
    // Single batch covering all 100 segments -> mock returns 3 chapters
    expect(state.aiChapterDetectionSuggestions).toHaveLength(3);

    const [first, second, third] = state.aiChapterDetectionSuggestions;
    expect(first?.startSegmentId).toBe("seg-1");
    expect(first?.endSegmentId).toBe("seg-30");
    expect(second?.startSegmentId).toBe("seg-31");
    expect(second?.endSegmentId).toBe("seg-70");
    expect(third?.startSegmentId).toBe("seg-71");
    expect(third?.endSegmentId).toBe("seg-100");
  });

  it("handles multi-batch responses and maps to real segment ids", async () => {
    // Use smaller batch size to force multiple batches and ensure fallback mapping works
    // (model may reply with global/simple ids that span batches)
    slice.startChapterDetection({ batchSize: 30 });
    await flushPromises();
    await flushPromises();

    const state = mockStore.getState() as TranscriptStore;
    expect(state.aiChapterDetectionIsProcessing).toBe(false);
    expect(state.aiChapterDetectionError).toBeNull();
    // With batchSize 30 and 100 segments we get 4 batches; duplicate chapter ranges
    // are de-duplicated across batches.
    expect(state.aiChapterDetectionSuggestions).toHaveLength(6);

    // spot-check first batch mapping
    const [first] = state.aiChapterDetectionSuggestions;
    expect(first?.startSegmentId).toBe("seg-1");
    expect(first?.endSegmentId).toBe("seg-30");
  });

  it("limits detection to scoped segment ids when provided", async () => {
    mockExecuteFeature.mockResolvedValueOnce({
      success: true,
      data: {
        chapters: [
          {
            title: "Scoped chapter",
            summary: "Scoped summary",
            tags: ["keep"],
            start: 1,
            end: 2,
            notes: "Scoped notes",
            confidence: 0.9,
          },
        ],
      },
      metadata: {
        featureId: "chapter-detection",
        providerId: "test-provider",
        model: "test-model",
        durationMs: 5,
      },
    });

    mockStore = createMockStore();
    mockStore.set((s) => ({
      ...s,
      segments: buildSegments(5),
    }));
    slice = createAIChapterDetectionSlice(mockStore.set, mockStore.get);

    slice.startChapterDetection({ batchSize: 10, segmentIds: ["seg-2", "seg-4"] });
    await flushPromises();
    await flushPromises();

    const state = mockStore.getState() as TranscriptStore;
    expect(state.aiChapterDetectionIsProcessing).toBe(false);
    expect(state.aiChapterDetectionSuggestions).toHaveLength(1);
    const [first] = state.aiChapterDetectionSuggestions;
    expect(first?.startSegmentId).toBe("seg-2");
    expect(first?.endSegmentId).toBe("seg-4");
  });

  it("skips processing when all segments already have suggestions", async () => {
    mockStore = createMockStore();
    mockStore.set((s) => ({
      ...s,
      segments: buildSegments(3),
      aiChapterDetectionSuggestions: [
        {
          id: "suggestion-1",
          title: "Existing",
          startSegmentId: "seg-1",
          endSegmentId: "seg-3",
          segmentCount: 3,
          createdAt: 0,
          source: "ai" as const,
          status: "pending" as const,
        },
      ],
    }));
    slice = createAIChapterDetectionSlice(mockStore.set, mockStore.get);

    slice.startChapterDetection({ batchSize: 10 });
    await flushPromises();
    await flushPromises();

    const state = mockStore.getState() as TranscriptStore;
    expect(state.aiChapterDetectionError).toMatch(/already have suggestions/i);
    expect(mockExecuteFeature).not.toHaveBeenCalled();
  });

  it("appends batch suggestions incrementally when a later batch fails", async () => {
    // prepare mock to succeed for first 3 batches, then fail
    mockExecuteFeature.mockClear();

    const successResp = async () => ({
      success: true,
      data: {
        chapters: [
          {
            title: "A",
            summary: "summary A",
            notes: "notes A",
            tags: ["keep"],
            start: 1,
            end: 10,
            confidence: 0.9,
          },
          {
            title: "B",
            summary: "summary B",
            notes: "notes B",
            tags: ["keep"],
            start: 11,
            end: 20,
            confidence: 0.8,
          },
        ],
      },
      metadata: {
        featureId: "chapter-detection",
        providerId: "test",
        model: "test",
        durationMs: 1,
      },
    });

    const failResp = async () => ({ success: false, error: "simulated" });

    mockExecuteFeature
      .mockImplementationOnce(successResp)
      .mockImplementationOnce(successResp)
      .mockImplementationOnce(successResp)
      .mockImplementationOnce(failResp);

    // make 160 segments -> 4 batches of 40
    mockStore = createMockStore();
    mockStore.set((s) => ({
      ...s,
      segments: buildSegments(160),
      history: [
        {
          segments: buildSegments(160),
          speakers: [],
          tags: [],
          chapters: [],
          selectedSegmentId: null,
          selectedChapterId: null,
          currentTime: 0,
          confidenceScoresVersion: 0,
        },
      ],
      historyIndex: 0,
    }));
    slice = createAIChapterDetectionSlice(mockStore.set, mockStore.get);

    slice.startChapterDetection({ batchSize: 40 });
    await flushPromises();
    await flushPromises();

    const state = mockStore.getState() as TranscriptStore;
    // 3 successful batches * 2 chapters each = 6 suggestions
    expect(state.aiChapterDetectionSuggestions).toHaveLength(6);
  });

  it("removes suggestions when accepting or rejecting", () => {
    const suggestion = {
      id: "chapter-1",
      title: "Intro",
      summary: "Summary",
      notes: "Notes",
      tags: ["keep"],
      startSegmentId: "seg-1",
      endSegmentId: "seg-2",
      segmentCount: 2,
      createdAt: 0,
      source: "ai" as const,
      status: "pending" as const,
    };

    mockStore.set({
      aiChapterDetectionSuggestions: [suggestion],
      chapters: [],
    });

    slice.acceptChapterSuggestion("chapter-1");

    let state = mockStore.getState() as TranscriptStore;
    expect(state.aiChapterDetectionSuggestions).toHaveLength(0);
    expect(state.chapters).toHaveLength(1);

    mockStore.set({
      aiChapterDetectionSuggestions: [
        {
          ...suggestion,
          id: "chapter-2",
          startSegmentId: "seg-3",
          endSegmentId: "seg-4",
        },
      ],
    });

    slice.rejectChapterSuggestion("chapter-2");
    state = mockStore.getState() as TranscriptStore;
    expect(state.aiChapterDetectionSuggestions).toHaveLength(0);
  });

  it("creates missing tags when accepting chapter suggestions", () => {
    const suggestion = {
      id: "chapter-1",
      title: "Intro",
      summary: "Summary",
      notes: "Notes",
      tags: ["Keep", "NewTag"],
      startSegmentId: "seg-1",
      endSegmentId: "seg-2",
      segmentCount: 2,
      createdAt: 0,
      source: "ai" as const,
      status: "pending" as const,
    };

    mockStore.set({
      aiChapterDetectionSuggestions: [suggestion],
      chapters: [],
    });

    slice.acceptChapterSuggestion("chapter-1");

    const state = mockStore.getState() as TranscriptStore;
    const newTag = state.tags.find((tag) => tag.name === "NewTag");
    expect(newTag).toBeDefined();
    expect(state.chapters).toHaveLength(1);
    expect(state.chapters[0]?.tags).toContain("keep");
    expect(state.chapters[0]?.tags).toContain(newTag?.id);
  });
});
