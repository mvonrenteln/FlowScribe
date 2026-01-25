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
    // With batchSize 30 and 100 segments we get 4 batches; mock returns 3 chapters per
    // batch so total suggestions = batches * 3
    const batches = Math.ceil(100 / 30);
    const expectedCount = batches * 3;
    expect(state.aiChapterDetectionSuggestions).toHaveLength(expectedCount);

    // spot-check first batch mapping
    const [first] = state.aiChapterDetectionSuggestions;
    expect(first?.startSegmentId).toBe("seg-1");
    expect(first?.endSegmentId).toBe("seg-30");
  });
});
