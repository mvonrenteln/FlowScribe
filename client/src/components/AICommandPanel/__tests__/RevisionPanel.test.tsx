import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBaseState, resetStore } from "@/lib/__tests__/storeTestUtils";
import { useTranscriptStore } from "@/lib/store";
import type { Segment, TranscriptStore } from "@/lib/store/types";
import { RevisionPanel } from "../RevisionPanel";

const baseSegments: Segment[] = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    tags: [],
    start: 2.5,
    end: 3.5,
    text: "Needs revision",
    confirmed: false,
    words: [],
  },
  {
    id: "seg-2",
    speaker: "SPEAKER_01",
    tags: [],
    start: 4,
    end: 5,
    text: "Confirmed content",
    confirmed: true,
    words: [],
  },
];

const setStoreState = (overrides: Partial<TranscriptStore>) => {
  const baseState = createBaseState();
  useTranscriptStore.setState({
    ...baseState,
    aiRevisionSuggestions: [],
    aiRevisionIsProcessing: false,
    aiRevisionProcessedCount: 0,
    aiRevisionTotalToProcess: 0,
    aiRevisionError: null,
    aiRevisionBatchLog: [],
    aiRevisionLastResult: null,
    ...overrides,
  });
};

describe("RevisionPanel", () => {
  beforeEach(() => {
    resetStore();
  });

  it("shows all scope count when filters match all segments", () => {
    setStoreState({ segments: baseSegments });

    render(<RevisionPanel filteredSegmentIds={["seg-1", "seg-2"]} onOpenSettings={vi.fn()} />);

    expect(screen.getByText("All: 1 segment")).toBeInTheDocument();
  });

  it("does not render a batch size input", () => {
    setStoreState({ segments: baseSegments });

    render(<RevisionPanel filteredSegmentIds={["seg-1", "seg-2"]} onOpenSettings={vi.fn()} />);

    expect(screen.queryByLabelText(/batch size/i)).not.toBeInTheDocument();
  });

  it("navigates to the segment when a revision result is clicked", async () => {
    const user = userEvent.setup();
    const setSelectedSegmentId = vi.fn();
    const seekToTime = vi.fn();

    setStoreState({
      segments: baseSegments,
      aiRevisionSuggestions: [
        {
          segmentId: "seg-1",
          promptId: "builtin-text-cleanup",
          originalText: "Needs revision",
          revisedText: "Needs revision!",
          status: "pending",
          changes: [],
        },
      ],
      setSelectedSegmentId,
      seekToTime,
    });

    render(<RevisionPanel filteredSegmentIds={["seg-1", "seg-2"]} onOpenSettings={vi.fn()} />);

    const suggestion = screen.getByRole("button", { name: /needs revision/i });
    await act(async () => {
      await user.click(suggestion);
    });

    expect(setSelectedSegmentId).toHaveBeenCalledWith("seg-1");
    expect(seekToTime).toHaveBeenCalledWith(2.5, { source: "ai", action: "jump" });
  });
});
