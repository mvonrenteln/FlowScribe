import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChaptersOutlinePanel } from "@/components/ChaptersOutlinePanel";
import { resetStore } from "@/lib/__tests__/storeTestUtils";
import type { Chapter, Segment } from "@/lib/store";
import { useTranscriptStore } from "@/lib/store";

const _segments: Segment[] = [
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
  beforeEach(() => {
    resetStore();
  });

  it("renders chapters and jumps on click", async () => {
    const user = userEvent.setup();
    const onJumpToChapter = vi.fn();

    render(
      <ChaptersOutlinePanel
        open={true}
        onOpenChange={vi.fn()}
        chapters={chapters}
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
        selectedChapterId="chapter-1"
        onJumpToChapter={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("chapters-outline-panel")).toBeNull();
  });

  it("shows chapter metadata (segment count, AI rewrite marker, tags)", () => {
    useTranscriptStore.setState({
      tags: [
        { id: "tag-1", name: "Recap", color: "#111" },
        { id: "tag-2", name: "Action", color: "#222" },
      ],
    });

    const chapterWithMeta: Chapter = {
      id: "chapter-2",
      title: "Battle",
      startSegmentId: "seg-1",
      endSegmentId: "seg-2",
      segmentCount: 8,
      createdAt: 0,
      source: "ai",
      rewrittenText: "Rewritten content",
      tags: ["tag-1", "tag-2"],
    };

    render(
      <ChaptersOutlinePanel
        open={true}
        onOpenChange={vi.fn()}
        chapters={[chapterWithMeta]}
        selectedChapterId={null}
        onJumpToChapter={vi.fn()}
      />,
    );

    expect(screen.getByText("Battle")).toBeInTheDocument();
    expect(screen.getByText("(8)")).toBeInTheDocument();
    expect(screen.getByTitle("AI rewritten")).toBeInTheDocument();
    expect(screen.getByText("Recap")).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
  });

  it("keeps metadata in a dedicated grid column", () => {
    const chapterWithMeta: Chapter = {
      id: "chapter-2",
      title: "Battle",
      startSegmentId: "seg-1",
      endSegmentId: "seg-2",
      segmentCount: 8,
      createdAt: 0,
      source: "manual",
    };

    render(
      <ChaptersOutlinePanel
        open={true}
        onOpenChange={vi.fn()}
        chapters={[chapterWithMeta]}
        selectedChapterId={null}
        onJumpToChapter={vi.fn()}
      />,
    );

    const title = screen.getByText("Battle");
    const meta = screen.getByText("(8)");
    const grid = screen.getByTestId("chapter-row-grid");

    expect(title).toBeInTheDocument();
    expect(meta).toBeInTheDocument();
    expect(title.contains(meta)).toBe(false);
    expect(grid.children).toHaveLength(2);
  });

  it("applies a distinct style to the active chapter", () => {
    render(
      <ChaptersOutlinePanel
        open={true}
        onOpenChange={vi.fn()}
        chapters={chapters}
        selectedChapterId="chapter-1"
        onJumpToChapter={vi.fn()}
      />,
    );

    const chapterButton = screen.getByRole("button", { name: /Intro/ });
    expect(chapterButton).toHaveClass("ring-1");
    expect(chapterButton).toHaveClass("bg-primary/15");
    expect(chapterButton).toHaveClass("border-primary/40");
  });

  it("scrolls the selected chapter into view when opened", () => {
    const scrollIntoView = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      render(
        <ChaptersOutlinePanel
          open={true}
          onOpenChange={vi.fn()}
          chapters={chapters}
          selectedChapterId="chapter-1"
          onJumpToChapter={vi.fn()}
        />,
      );
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });
});
