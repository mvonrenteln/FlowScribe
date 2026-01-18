import { act } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { createBaseState, resetStore } from "@/lib/__tests__/storeTestUtils";
import { useTranscriptStore } from "@/lib/store";
import type { Segment, TranscriptStore } from "@/lib/store/types";

const baseSegments: Segment[] = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    tags: [],
    start: 0,
    end: 1,
    text: "First",
    words: [],
  },
  {
    id: "seg-2",
    speaker: "SPEAKER_00",
    tags: [],
    start: 1,
    end: 2,
    text: "Second",
    words: [],
  },
  {
    id: "seg-3",
    speaker: "SPEAKER_00",
    tags: [],
    start: 2,
    end: 3,
    text: "Third",
    words: [],
  },
  {
    id: "seg-4",
    speaker: "SPEAKER_00",
    tags: [],
    start: 3,
    end: 4,
    text: "Fourth",
    words: [],
  },
  {
    id: "seg-5",
    speaker: "SPEAKER_00",
    tags: [],
    start: 4,
    end: 5,
    text: "Fifth",
    words: [],
  },
];

const seedStore = (overrides: Partial<TranscriptStore> = {}) => {
  const baseState = createBaseState();
  useTranscriptStore.setState({
    ...baseState,
    segments: baseSegments,
    speakers: [],
    selectedSegmentId: "seg-5",
    currentTime: 0,
    history: [
      {
        segments: baseSegments,
        speakers: [],
        selectedSegmentId: "seg-5",
        currentTime: 0,
        confidenceScoresVersion: 0,
      },
    ],
    historyIndex: 0,
    aiSegmentMergeSuggestions: [],
    ...overrides,
  });
};

describe("aiSegmentMergeSlice", () => {
  beforeEach(() => {
    resetStore();
  });

  it("accepts a merge suggestion without smoothing and rejects invalidated suggestions", () => {
    seedStore({
      aiSegmentMergeSuggestions: [
        {
          id: "merge-1",
          segmentIds: ["seg-1", "seg-2"],
          confidence: "high",
          confidenceScore: 0.95,
          reason: "Continuation",
          status: "pending",
          mergedText: "First Second",
          smoothedText: "First, second.",
          timeRange: { start: 0, end: 2 },
          speaker: "SPEAKER_00",
          timeGap: 0.1,
        },
        {
          id: "merge-2",
          segmentIds: ["seg-2", "seg-3"],
          confidence: "medium",
          confidenceScore: 0.72,
          reason: "Overlap",
          status: "pending",
          mergedText: "Second Third",
          timeRange: { start: 1, end: 3 },
          speaker: "SPEAKER_00",
          timeGap: 0.1,
        },
      ],
    });

    act(() => {
      useTranscriptStore.getState().acceptMergeSuggestion("merge-1", { applySmoothing: false });
    });

    const state = useTranscriptStore.getState();
    expect(state.segments).toHaveLength(4);
    expect(state.segments[0]?.text).toBe("First Second");
    expect(state.selectedSegmentId).toBe("seg-5");
    expect(state.aiSegmentMergeSuggestions.find((s) => s.id === "merge-1")?.status).toBe(
      "accepted",
    );
    expect(state.aiSegmentMergeSuggestions.find((s) => s.id === "merge-2")?.status).toBe(
      "rejected",
    );
  });

  it("merges tags from both segments when accepting a suggestion", () => {
    const segmentsWithTags: Segment[] = [
      { ...baseSegments[0], tags: ["tag-a"] },
      { ...baseSegments[1], tags: ["tag-b", "tag-a"] },
      baseSegments[2],
      baseSegments[3],
      baseSegments[4],
    ];

    seedStore({
      segments: segmentsWithTags,
      history: [
        {
          segments: segmentsWithTags,
          speakers: [],
          selectedSegmentId: "seg-5",
          currentTime: 0,
          confidenceScoresVersion: 0,
        },
      ],
      aiSegmentMergeSuggestions: [
        {
          id: "merge-tags",
          segmentIds: ["seg-1", "seg-2"],
          confidence: "high",
          confidenceScore: 0.95,
          reason: "Continuation",
          status: "pending",
          mergedText: "First Second",
          timeRange: { start: 0, end: 2 },
          speaker: "SPEAKER_00",
          timeGap: 0.1,
        },
      ],
    });

    act(() => {
      useTranscriptStore.getState().acceptMergeSuggestion("merge-tags", { applySmoothing: false });
    });

    const state = useTranscriptStore.getState();
    const merged = state.segments.find((segment) => segment.text === "First Second");
    expect(merged?.tags).toEqual(["tag-a", "tag-b"]);
  });

  it("accepts all high confidence suggestions in a single history entry", () => {
    seedStore({
      aiSegmentMergeSuggestions: [
        {
          id: "merge-1",
          segmentIds: ["seg-1", "seg-2"],
          confidence: "high",
          confidenceScore: 0.9,
          status: "pending",
          mergedText: "First Second",
          timeRange: { start: 0, end: 2 },
          speaker: "SPEAKER_00",
          timeGap: 0.2,
        },
        {
          id: "merge-2",
          segmentIds: ["seg-3", "seg-4"],
          confidence: "high",
          confidenceScore: 0.9,
          status: "pending",
          mergedText: "Third Fourth",
          timeRange: { start: 2, end: 4 },
          speaker: "SPEAKER_00",
          timeGap: 0.2,
        },
        {
          id: "merge-3",
          segmentIds: ["seg-2", "seg-3"],
          confidence: "medium",
          confidenceScore: 0.6,
          status: "pending",
          mergedText: "Second Third",
          timeRange: { start: 1, end: 3 },
          speaker: "SPEAKER_00",
          timeGap: 0.2,
        },
      ],
    });

    act(() => {
      useTranscriptStore.getState().acceptAllHighConfidence();
    });

    const state = useTranscriptStore.getState();
    expect(state.segments).toHaveLength(3);
    expect(state.history).toHaveLength(2);
    expect(state.historyIndex).toBe(1);
    expect(state.selectedSegmentId).toBe("seg-5");
    expect(state.aiSegmentMergeSuggestions.find((s) => s.id === "merge-1")?.status).toBe(
      "accepted",
    );
    expect(state.aiSegmentMergeSuggestions.find((s) => s.id === "merge-2")?.status).toBe(
      "accepted",
    );
    expect(state.aiSegmentMergeSuggestions.find((s) => s.id === "merge-3")?.status).toBe(
      "rejected",
    );
  });
});
