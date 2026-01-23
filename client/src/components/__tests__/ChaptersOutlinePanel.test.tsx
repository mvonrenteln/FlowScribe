import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChaptersOutlinePanel } from "@/components/ChaptersOutlinePanel";
import type { Chapter, Segment } from "@/lib/store";

const segments: Segment[] = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    tags: [],
    start: 0,
    end: 1,
    text: "",
    words: [],
  },
  {
    id: "seg-2",
    speaker: "SPEAKER_01",
    tags: [],
    start: 1,
    end: 2,
    text: "",
    words: [],
  },
];

const chapters: Chapter[] = [
  {
    id: "chapter-1",
    title: "Intro",
    startSegmentId: "seg-1",
    endSegmentId: "seg-1",
    segmentCount: 1,
    createdAt: 0,
    source: "manual",
  },
];

describe("ChaptersOutlinePanel", () => {
  it("renders chapters and jumps on click", async () => {
    const user = userEvent.setup();
    const onJumpToChapter = vi.fn();

    render(
      <ChaptersOutlinePanel
        open={true}
        onOpenChange={vi.fn()}
        chapters={chapters}
        segments={segments}
        selectedChapterId="chapter-1"
        onJumpToChapter={onJumpToChapter}
      />,
    );

    await user.click(screen.getByText("Intro"));

    expect(onJumpToChapter).toHaveBeenCalledWith("chapter-1");
  });

  it("does not render when closed", () => {
    render(
      <ChaptersOutlinePanel
        open={false}
        onOpenChange={vi.fn()}
        chapters={chapters}
        segments={segments}
        selectedChapterId="chapter-1"
        onJumpToChapter={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("chapters-outline-panel")).toBeNull();
  });
});
