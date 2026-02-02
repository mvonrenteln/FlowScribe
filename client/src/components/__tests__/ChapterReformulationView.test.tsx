import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ChapterReformulationView } from "@/components/reformulation/ChapterReformulationView";
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
        reformulatedText: "Reformulated text.",
        reformulationPromptId: "prompt-1",
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
    reformulationInProgress: false,
    reformulationChapterId: null,
    reformulationError: null,
  });
};

describe("ChapterReformulationView", () => {
  beforeEach(() => {
    resetStore();
  });

  it("renders without triggering update depth errors", () => {
    render(
      <I18nProvider>
        <ChapterReformulationView chapterId="chapter-1" onClose={() => {}} />
      </I18nProvider>,
    );

    expect(screen.getByText("Reformulate Chapter")).toBeInTheDocument();
    expect(screen.getByText(/Intro/)).toBeInTheDocument();
    expect(screen.getByText("Original (2 segments)")).toBeInTheDocument();
  });

  it("renders the view in a portal outside the render container", () => {
    const { container } = render(
      <I18nProvider>
        <div data-testid="local-container">
          <ChapterReformulationView chapterId="chapter-1" onClose={() => {}} />
        </div>
      </I18nProvider>,
    );

    const view = screen.getByTestId("chapter-reformulation-view");
    expect(container.contains(view)).toBe(false);
    expect(document.body.contains(view)).toBe(true);
  });

  it("renders the view above overlays with pointer events enabled", () => {
    render(
      <I18nProvider>
        <ChapterReformulationView chapterId="chapter-1" onClose={() => {}} />
      </I18nProvider>,
    );

    const view = screen.getByTestId("chapter-reformulation-view");
    expect(view.className).toContain("pointer-events-auto");
    expect(view.className).toContain("z-[60]");
  });

  it("clears global pointer-events on unmount", () => {
    document.body.style.pointerEvents = "none";
    document.documentElement.style.pointerEvents = "none";

    const { unmount } = render(
      <I18nProvider>
        <ChapterReformulationView chapterId="chapter-1" onClose={() => {}} />
      </I18nProvider>,
    );

    unmount();

    expect(document.body.style.pointerEvents).toBe("");
    expect(document.documentElement.style.pointerEvents).toBe("");
  });
});
