import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ChapterRewriteView } from "@/components/rewrite/ChapterRewriteView";
import { useTranscriptStore } from "@/lib/store";

const resetStore = () => {
  useTranscriptStore.setState({
    chapters: [
      {
        id: "chapter-1",
        title: "Intro",
        startSegmentId: "seg-1",
        endSegmentId: "seg-2",
        segmentCount: 2,
        createdAt: Date.now(),
        source: "manual",
        rewrittenText: "Rewritten text.",
        rewritePromptId: "prompt-1",
      },
    ],
    segments: [
      {
        id: "seg-1",
        speaker: "Speaker 1",
        start: 0,
        end: 1,
        text: "Hello world.",
        words: [],
      },
      {
        id: "seg-2",
        speaker: "Speaker 2",
        start: 1,
        end: 2,
        text: "Second segment.",
        words: [],
      },
    ],
    rewriteInProgress: false,
    rewriteChapterId: null,
    rewriteError: null,
    filteredSegmentIds: new Set(),
    filtersActive: false,
    aiChapterDetectionConfig: {
      batchSize: 100,
      minChapterLength: 10,
      maxChapterLength: 80,
      tagIds: [],
      selectedProviderId: undefined,
      selectedModel: undefined,
      activePromptId: "prompt-1",
      prompts: [
        {
          id: "prompt-1",
          name: "Chapter Prompt",
          type: "chapter-detect",
          operation: "rewrite",
          rewriteScope: "chapter",
          systemPrompt: "System",
          userPromptTemplate: "User",
          isBuiltIn: false,
          quickAccess: false,
        },
        {
          id: "prompt-2",
          name: "Paragraph Prompt",
          type: "chapter-detect",
          operation: "rewrite",
          rewriteScope: "paragraph",
          systemPrompt: "System",
          userPromptTemplate: "User",
          isBuiltIn: false,
          quickAccess: false,
        },
      ],
      includeContext: true,
      contextWordLimit: 500,
      includeParagraphContext: true,
      paragraphContextCount: 2,
    },
  });
};

describe("ChapterRewriteView", () => {
  beforeEach(() => {
    resetStore();
  });

  it("renders without triggering update depth errors", () => {
    render(
      <I18nProvider>
        <ChapterRewriteView chapterId="chapter-1" onClose={() => {}} />
      </I18nProvider>,
    );

    expect(screen.getByText("Rewrite Chapter")).toBeInTheDocument();
    expect(screen.getByText(/Intro/)).toBeInTheDocument();
    expect(screen.getByText("Original (2 segments)")).toBeInTheDocument();
  });

  it("renders the view in a portal outside the render container", () => {
    const { container } = render(
      <I18nProvider>
        <div data-testid="local-container">
          <ChapterRewriteView chapterId="chapter-1" onClose={() => {}} />
        </div>
      </I18nProvider>,
    );

    const view = screen.getByTestId("chapter-rewrite-view");
    expect(container.contains(view)).toBe(false);
    expect(document.body.contains(view)).toBe(true);
  });

  it("renders the view above overlays with pointer events enabled", () => {
    render(
      <I18nProvider>
        <ChapterRewriteView chapterId="chapter-1" onClose={() => {}} />
      </I18nProvider>,
    );

    const view = screen.getByTestId("chapter-rewrite-view");
    expect(view.className).toContain("pointer-events-auto");
    expect(view.className).toContain("z-[60]");
  });

  it("clears global pointer-events on unmount", () => {
    document.body.style.pointerEvents = "none";
    document.documentElement.style.pointerEvents = "none";

    const { unmount } = render(
      <I18nProvider>
        <ChapterRewriteView chapterId="chapter-1" onClose={() => {}} />
      </I18nProvider>,
    );

    unmount();

    expect(document.body.style.pointerEvents).toBe("");
    expect(document.documentElement.style.pointerEvents).toBe("");
  });

  it("filters original segments when filters are active", () => {
    useTranscriptStore.setState({
      chapters: [
        {
          id: "chapter-1",
          title: "Intro",
          startSegmentId: "seg-1",
          endSegmentId: "seg-3",
          segmentCount: 3,
          createdAt: Date.now(),
          source: "manual",
          rewrittenText: "Rewritten text.",
          rewritePromptId: "prompt-1",
        },
      ],
      segments: [
        {
          id: "seg-1",
          speaker: "Speaker 1",
          start: 0,
          end: 1,
          text: "Hello world.",
          words: [],
        },
        {
          id: "seg-2",
          speaker: "Speaker 2",
          start: 1,
          end: 2,
          text: "Second segment.",
          words: [],
        },
        {
          id: "seg-3",
          speaker: "Speaker 3",
          start: 2,
          end: 3,
          text: "Third segment.",
          words: [],
        },
      ],
      filteredSegmentIds: new Set(["seg-2"]),
      filtersActive: true,
    });

    render(
      <I18nProvider>
        <ChapterRewriteView chapterId="chapter-1" onClose={() => {}} />
      </I18nProvider>,
    );

    expect(screen.getByText("Original (1 segments)")).toBeInTheDocument();
    expect(screen.getByText("Second segment.")).toBeInTheDocument();
    expect(screen.queryByText("Hello world.")).not.toBeInTheDocument();
    expect(screen.queryByText("Third segment.")).not.toBeInTheDocument();
  });

  it("opens paragraph rewrite dialog from the rewritten column", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <ChapterRewriteView chapterId="chapter-1" onClose={() => {}} />
      </I18nProvider>,
    );

    const refineButton = screen.getByRole("button", { name: "Refine paragraph" });
    await user.click(refineButton);

    expect(screen.getByText("Refine Paragraph")).toBeInTheDocument();
  });
});
