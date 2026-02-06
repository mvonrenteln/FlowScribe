import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBaseState, resetStore } from "@/lib/__tests__/storeTestUtils";
import { useTranscriptStore } from "@/lib/store";
import type { Segment, TranscriptStore } from "@/lib/store/types";
import { MergePanel } from "../MergePanel";
import { renderWithI18n } from "./testUtils";

const baseSegments: Segment[] = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    tags: [],
    start: 0,
    end: 1,
    text: "First segment",
    confirmed: false,
    words: [],
  },
  {
    id: "seg-2",
    speaker: "SPEAKER_00",
    tags: [],
    start: 1,
    end: 2,
    text: "Second segment",
    confirmed: false,
    words: [],
  },
  {
    id: "seg-3",
    speaker: "SPEAKER_01",
    tags: [],
    start: 2,
    end: 3,
    text: "Confirmed segment",
    confirmed: true,
    words: [],
  },
];

const setStoreState = (overrides: Partial<TranscriptStore>) => {
  const baseState = createBaseState();
  useTranscriptStore.setState({
    ...baseState,
    aiSegmentMergeSuggestions: [],
    aiSegmentMergeIsProcessing: false,
    aiSegmentMergeProcessedCount: 0,
    aiSegmentMergeTotalToProcess: 0,
    aiSegmentMergeError: null,
    aiSegmentMergeConfig: {
      ...baseState.aiSegmentMergeConfig,
      selectedProviderId: "default-ollama",
      selectedModel: "llama3.2",
    },
    ...overrides,
  });
};

describe("MergePanel", () => {
  beforeEach(() => {
    resetStore();
  });

  it("starts merge analysis with scoped segment ids", async () => {
    const user = userEvent.setup();
    const startMergeAnalysis = vi.fn();

    setStoreState({
      segments: baseSegments,
      startMergeAnalysis,
    });

    renderWithI18n(
      <MergePanel filteredSegmentIds={["seg-1", "seg-2", "seg-3"]} onOpenSettings={vi.fn()} />,
    );

    const startButton = screen.getByRole("button", { name: /start batch/i });
    await act(async () => {
      await user.click(startButton);
    });

    expect(startMergeAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentIds: ["seg-1", "seg-2"],
        providerId: "default-ollama",
        model: "llama3.2",
      }),
    );
  });

  it("limits merge analysis to consecutive scoped segments", async () => {
    const user = userEvent.setup();
    const startMergeAnalysis = vi.fn();

    setStoreState({
      segments: [
        {
          id: "seg-1",
          speaker: "SPEAKER_00",
          tags: [],
          start: 0,
          end: 1,
          text: "First segment",
          confirmed: false,
          words: [],
        },
        {
          id: "seg-2",
          speaker: "SPEAKER_00",
          tags: [],
          start: 1,
          end: 2,
          text: "Second segment",
          confirmed: false,
          words: [],
        },
        {
          id: "seg-3",
          speaker: "SPEAKER_01",
          tags: [],
          start: 2,
          end: 3,
          text: "Third segment",
          confirmed: false,
          words: [],
        },
        {
          id: "seg-4",
          speaker: "SPEAKER_01",
          tags: [],
          start: 3,
          end: 4,
          text: "Fourth segment",
          confirmed: false,
          words: [],
        },
      ],
      startMergeAnalysis,
    });

    renderWithI18n(
      <MergePanel filteredSegmentIds={["seg-1", "seg-3", "seg-4"]} onOpenSettings={vi.fn()} />,
    );

    const startButton = screen.getByRole("button", { name: /start batch/i });
    await act(async () => {
      await user.click(startButton);
    });

    expect(startMergeAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentIds: ["seg-3", "seg-4"],
        providerId: "default-ollama",
        model: "llama3.2",
      }),
    );
  });

  it("navigates to the segment when a merge suggestion is clicked", async () => {
    const user = userEvent.setup();
    const setSelectedSegmentId = vi.fn();
    const seekToTime = vi.fn();

    setStoreState({
      segments: baseSegments,
      aiSegmentMergeSuggestions: [
        {
          id: "merge-1",
          segmentIds: ["seg-1", "seg-2"],
          confidence: "high",
          confidenceScore: 0.92,
          reason: "Continuation",
          status: "pending",
          mergedText: "First segment second segment",
          timeRange: { start: 0, end: 2 },
          speaker: "SPEAKER_00",
          timeGap: 0.2,
        },
      ],
      setSelectedSegmentId,
      seekToTime,
    });

    renderWithI18n(<MergePanel filteredSegmentIds={["seg-1", "seg-2"]} onOpenSettings={vi.fn()} />);

    const suggestion = screen.getByRole("button", { name: /first segment/i });
    await act(async () => {
      await user.click(suggestion);
    });

    expect(setSelectedSegmentId).toHaveBeenCalledWith("seg-1");
    expect(seekToTime).toHaveBeenCalledWith(0, { source: "ai", action: "jump" });
  });
});
