import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBaseState, resetStore } from "@/lib/__tests__/storeTestUtils";
import { useTranscriptStore } from "@/lib/store";
import type { Segment, TranscriptStore } from "@/lib/store/types";
import { ChapterPanel } from "../ChapterPanel";

const baseSegments: Segment[] = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    tags: [],
    start: 2.5,
    end: 3.5,
    text: "Intro",
    words: [],
  },
];

const setStoreState = (overrides: Partial<TranscriptStore>) => {
  const baseState = createBaseState();
  useTranscriptStore.setState({
    ...baseState,
    aiChapterDetectionSuggestions: [],
    aiChapterDetectionIsProcessing: false,
    aiChapterDetectionProcessedBatches: 0,
    aiChapterDetectionTotalBatches: 0,
    aiChapterDetectionError: null,
    ...overrides,
  });
};

describe("ChapterPanel", () => {
  beforeEach(() => {
    resetStore();
  });

  it("jumps to the suggestion start segment on click", async () => {
    const user = userEvent.setup();
    const setSelectedSegmentId = vi.fn();
    const seekToTime = vi.fn();

    setStoreState({
      segments: baseSegments,
      aiChapterDetectionSuggestions: [
        {
          id: "s-1",
          title: "Introduction",
          startSegmentId: "seg-1",
          endSegmentId: "seg-1",
          segmentCount: 1,
          createdAt: Date.now(),
          source: "ai",
          status: "pending",
        },
      ],
      setSelectedSegmentId,
      seekToTime,
    });

    render(<ChapterPanel onOpenSettings={vi.fn()} />);

    const button = screen.getByRole("button", { name: /introduction/i });
    await act(async () => {
      await user.click(button);
    });

    expect(setSelectedSegmentId).toHaveBeenCalledWith("seg-1");
    expect(seekToTime).toHaveBeenCalledWith(2.5, { source: "ai", action: "jump" });
  });
});
