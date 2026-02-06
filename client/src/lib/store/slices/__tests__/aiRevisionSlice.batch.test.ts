import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIRevisionSlice, TranscriptStore } from "../../types";
import { createAIRevisionSlice, initialAIRevisionState } from "../aiRevisionSlice";

const reviseSegmentsBatchMock = vi.hoisted(() =>
  vi.fn(
    async (params: {
      segments: Array<{ id: string; text: string }>;
      onResult?: (result: {
        segmentId: string;
        revisedText: string;
        changes: Array<{ type: "replace"; position: number; length: number }>;
      }) => void;
    }) => {
      params.onResult?.({
        segmentId: "seg-2",
        revisedText: "Revised text",
        changes: [{ type: "replace", position: 0, length: 1 }],
      });
      params.onResult?.({
        segmentId: "seg-2",
        revisedText: "Revised text",
        changes: [{ type: "replace", position: 0, length: 1 }],
      });
      return {
        results: [],
        summary: { total: params.segments.length, revised: 1, unchanged: 0, failed: 0 },
        issues: [],
      };
    },
  ),
);

vi.mock("@/lib/ai/features/revision", async () => ({
  reviseSegmentsBatch: reviseSegmentsBatchMock,
}));

const createMockStore = () => {
  let state: Partial<TranscriptStore> = {
    ...initialAIRevisionState,
    segments: [
      { id: "seg-1", speaker: "Speaker 1", start: 0, end: 5, text: "Hello", words: [] },
      { id: "seg-2", speaker: "Speaker 2", start: 5, end: 10, text: "World", words: [] },
    ],
    speakers: [{ id: "s1", name: "Speaker 1", color: "#ff0000" }],
    updateSegmentText: vi.fn(),
    updateSegmentsTexts: vi.fn(),
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

describe("aiRevisionSlice - batch de-duplication", () => {
  let mockStore: ReturnType<typeof createMockStore>;
  let slice: AIRevisionSlice;

  beforeEach(() => {
    mockStore = createMockStore();
    slice = createAIRevisionSlice(mockStore.set, mockStore.get);
    reviseSegmentsBatchMock.mockClear();
  });

  it("skips segments that already have suggestions and avoids duplicate inserts", async () => {
    mockStore.set({
      aiRevisionSuggestions: [
        {
          segmentId: "seg-1",
          promptId: "builtin-text-cleanup",
          originalText: "Hello",
          revisedText: "Hello!",
          status: "pending",
          changes: [],
        },
      ],
    });

    slice.startBatchRevision(["seg-1", "seg-2"], "builtin-text-cleanup");
    await flushPromises();
    await flushPromises();

    expect(reviseSegmentsBatchMock).toHaveBeenCalled();
    const firstCallArgs = reviseSegmentsBatchMock.mock.calls[0]?.[0];
    expect(firstCallArgs?.segments.map((s: { id: string }) => s.id)).toEqual(["seg-2"]);

    const state = mockStore.getState() as TranscriptStore;
    const suggestions = state.aiRevisionSuggestions;
    expect(suggestions).toHaveLength(2);
    expect(suggestions.filter((s) => s.segmentId === "seg-2")).toHaveLength(1);
  });

  it("summarizes batch errors by cause without repeating prefixes", async () => {
    reviseSegmentsBatchMock.mockResolvedValueOnce({
      results: [],
      summary: { total: 3, revised: 0, unchanged: 0, failed: 3 },
      issues: [
        { level: "error", message: "Failed to revise segment: Request timed out after 30s" },
        {
          level: "error",
          message: "Failed to revise segment: Batch stopped after repeated connection failures.",
        },
        { level: "error", message: "Batch stopped after repeated connection failures" },
      ],
    });

    slice.startBatchRevision(["seg-1", "seg-2"], "builtin-text-cleanup");
    await flushPromises();

    expect(mockStore.getState().aiRevisionError).toBe(
      "Request timed out after 30s; 2x Aborted after repeated failures",
    );
  });
});
