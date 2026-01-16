import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBaseState, resetStore } from "@/lib/__tests__/storeTestUtils";
import { useTranscriptStore } from "@/lib/store";
import type { Segment, TranscriptStore } from "@/lib/store/types";
import { SpeakerPanel } from "../SpeakerPanel";

const baseSegments: Segment[] = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    tags: [],
    start: 0,
    end: 1,
    text: "Hello segment",
    confirmed: false,
    words: [],
  },
  {
    id: "seg-2",
    speaker: "SPEAKER_01",
    tags: [],
    start: 1,
    end: 2,
    text: "Confirmed segment",
    confirmed: true,
    words: [],
  },
  {
    id: "seg-3",
    speaker: "SPEAKER_02",
    tags: [],
    start: 2,
    end: 3,
    text: "Another segment",
    confirmed: false,
    words: [],
  },
];

const setStoreState = (overrides: Partial<TranscriptStore>) => {
  const baseState = createBaseState();
  useTranscriptStore.setState({
    ...baseState,
    aiSpeakerSuggestions: [],
    aiSpeakerIsProcessing: false,
    aiSpeakerProcessedCount: 0,
    aiSpeakerTotalToProcess: 0,
    aiSpeakerError: null,
    aiSpeakerBatchInsights: [],
    aiSpeakerBatchLog: [],
    aiSpeakerDiscrepancyNotice: null,
    ...overrides,
  });
};

describe("SpeakerPanel", () => {
  beforeEach(() => {
    resetStore();
  });

  it("shows filtered scope count and updates when exclude confirmed toggled", async () => {
    const user = userEvent.setup();
    setStoreState({ segments: baseSegments });

    render(<SpeakerPanel filteredSegmentIds={["seg-1", "seg-2"]} onOpenSettings={vi.fn()} />);

    expect(screen.getByText("Filtered: 1 segment")).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox", { name: /exclude confirmed/i });
    await act(async () => {
      await user.click(checkbox);
    });

    expect(screen.getByText("Filtered: 2 segments")).toBeInTheDocument();
  });

  it("navigates to the segment when a suggestion is clicked", async () => {
    const user = userEvent.setup();
    const setSelectedSegmentId = vi.fn();
    const seekToTime = vi.fn();

    setStoreState({
      segments: baseSegments,
      aiSpeakerSuggestions: [
        {
          segmentId: "seg-1",
          currentSpeaker: "SPEAKER_00",
          suggestedSpeaker: "SPEAKER_01",
          confidence: 0.9,
          status: "pending",
        },
      ],
      setSelectedSegmentId,
      seekToTime,
    });

    render(<SpeakerPanel filteredSegmentIds={["seg-1"]} onOpenSettings={vi.fn()} />);

    const suggestion = screen.getByRole("button", { name: /hello segment/i });
    await act(async () => {
      await user.click(suggestion);
    });

    expect(setSelectedSegmentId).toHaveBeenCalledWith("seg-1");
    expect(seekToTime).toHaveBeenCalledWith(0, { source: "ai_navigation" });
  });

  it("shows the results section while processing even without suggestions", () => {
    setStoreState({
      segments: baseSegments,
      aiSpeakerIsProcessing: true,
      aiSpeakerSuggestions: [],
    });

    render(<SpeakerPanel filteredSegmentIds={["seg-1"]} onOpenSettings={vi.fn()} />);

    expect(screen.getByText("Suggestions (0 pending)")).toBeInTheDocument();
  });

  it("starts analysis with the scoped segment ids from the filter list", async () => {
    const user = userEvent.setup();
    const startAnalysis = vi.fn();

    setStoreState({
      segments: baseSegments,
      startAnalysis,
    });

    render(<SpeakerPanel filteredSegmentIds={["seg-1", "seg-2"]} onOpenSettings={vi.fn()} />);

    const startButton = screen.getByRole("button", { name: /start batch/i });
    await act(async () => {
      await user.click(startButton);
    });

    expect(startAnalysis).toHaveBeenCalledWith([], true, ["seg-1"]);
  });
});
