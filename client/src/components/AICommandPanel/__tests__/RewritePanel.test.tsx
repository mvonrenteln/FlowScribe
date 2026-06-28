import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBaseState, resetStore } from "@/lib/__tests__/storeTestUtils";
import { exportRewriteBatchLog } from "@/lib/ai/export/batchLogExport";
import { useTranscriptStore } from "@/lib/store";
import type { AIPrompt, Segment, TranscriptStore } from "@/lib/store/types";
import type { Chapter } from "@/types/chapter";
import { RewritePanel } from "../RewritePanel";
import { renderWithI18n } from "./testUtils";

vi.mock("@/components/rewrite/ChapterRewriteView", () => ({
  ChapterRewriteView: ({ chapterId }: { chapterId: string }) => (
    <div data-testid="chapter-rewrite-view">{chapterId}</div>
  ),
}));

vi.mock("@/lib/ai/export/batchLogExport", () => ({
  exportBatchLog: vi.fn(),
  exportRewriteBatchLog: vi.fn(),
}));

const prompt: AIPrompt = {
  id: "rewrite-prompt",
  name: "Rewrite Prompt",
  type: "chapter-detect",
  operation: "rewrite",
  systemPrompt: "system",
  userPromptTemplate: "user",
  isBuiltIn: false,
  quickAccess: false,
};

const segments: Segment[] = [
  { id: "seg-1", speaker: "A", start: 0, end: 1, text: "one", words: [] },
  { id: "seg-2", speaker: "A", start: 1, end: 2, text: "two", words: [] },
];

const chapters: Chapter[] = [
  {
    id: "chapter-1",
    title: "One",
    startSegmentId: "seg-1",
    endSegmentId: "seg-1",
    segmentCount: 1,
    createdAt: 1,
    source: "manual",
  },
  {
    id: "chapter-2",
    title: "Two",
    startSegmentId: "seg-2",
    endSegmentId: "seg-2",
    segmentCount: 1,
    createdAt: 2,
    source: "manual",
  },
];

const setStoreState = (overrides: Partial<TranscriptStore>) => {
  const baseState = createBaseState();
  useTranscriptStore.setState({
    ...baseState,
    segments,
    chapters,
    aiChapterDetectionConfig: {
      ...baseState.aiChapterDetectionConfig,
      prompts: [prompt],
      activePromptId: prompt.id,
    },
    rewriteDraftByChapterId: {},
    batchRewriteIsProcessing: false,
    batchRewriteIsCancelling: false,
    batchRewriteProcessedCount: 0,
    batchRewriteTotalCount: 0,
    batchRewriteError: null,
    batchRewriteLog: [],
    ...overrides,
  });
};

describe("RewritePanel", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    resetStore();
  });

  it("shows chapter count and empty state", () => {
    setStoreState({});
    const { rerender } = renderWithI18n(<RewritePanel onOpenSettings={vi.fn()} />);

    expect(screen.getByText("2 chapters")).toBeInTheDocument();

    setStoreState({ chapters: [] });
    rerender(<RewritePanel onOpenSettings={vi.fn()} />);
    expect(screen.getByText("No chapters in transcript. Add chapters first.")).toBeInTheDocument();
  });

  it("disables start without a rewrite prompt", () => {
    const baseState = createBaseState();
    setStoreState({
      aiChapterDetectionConfig: {
        ...baseState.aiChapterDetectionConfig,
        prompts: [],
      },
    });

    renderWithI18n(<RewritePanel onOpenSettings={vi.fn()} />);

    expect(screen.getByRole("button", { name: /start batch/i })).toBeDisabled();
  });

  it("disables start without chapters", () => {
    setStoreState({ chapters: [] });

    renderWithI18n(<RewritePanel onOpenSettings={vi.fn()} />);

    expect(screen.getByRole("button", { name: /start batch/i })).toBeDisabled();
  });

  it("starts batch rewrite with instructions and skip flag", async () => {
    const user = userEvent.setup();
    const startBatchRewrite = vi.fn();
    const updateChapterDetectionConfig = vi.fn();
    setStoreState({ startBatchRewrite, updateChapterDetectionConfig });

    renderWithI18n(<RewritePanel onOpenSettings={vi.fn()} />);

    await act(async () => {
      await user.type(screen.getByLabelText(/additional instructions/i), "Use bullets");
    });
    const skipCheckbox = screen.getByRole("checkbox", { name: /skip already rewritten chapters/i });
    await act(async () => {
      await user.click(skipCheckbox);
    });
    await waitFor(() => expect(skipCheckbox).toHaveAttribute("aria-checked", "true"));
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /start batch/i }));
    });

    expect(startBatchRewrite).toHaveBeenCalledWith({
      promptId: "rewrite-prompt",
      customInstructions: "Use bullets",
      skipAlreadyRewritten: true,
    });
    expect(updateChapterDetectionConfig).toHaveBeenCalledWith({
      selectedProviderId: "default-ollama",
      selectedModel: "llama3.2",
    });
  });

  it("shows drafts, opens review, and runs bulk actions", async () => {
    const user = userEvent.setup();
    const acceptAllBatchRewrites = vi.fn();
    const rejectAllBatchRewrites = vi.fn();
    setStoreState({
      acceptAllBatchRewrites,
      rejectAllBatchRewrites,
      rewriteDraftByChapterId: {
        "chapter-1": { text: "Draft one", promptId: "rewrite-prompt" },
      },
    });

    renderWithI18n(<RewritePanel onOpenSettings={vi.fn()} />);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /one draft one/i }));
    });
    expect(screen.getByTestId("chapter-rewrite-view")).toHaveTextContent("chapter-1");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /accept all/i }));
      await user.click(screen.getByRole("button", { name: /reject all/i }));
    });
    expect(acceptAllBatchRewrites).toHaveBeenCalled();
    expect(rejectAllBatchRewrites).toHaveBeenCalled();
  });

  it("shows batch log trigger and exports rewrite log", async () => {
    const user = userEvent.setup();
    const loggedAt = Date.now();
    setStoreState({
      batchRewriteLog: [{ chapterId: "chapter-1", chapterTitle: "One", status: "done", loggedAt }],
    });

    renderWithI18n(<RewritePanel onOpenSettings={vi.fn()} />);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /rewrite log/i }));
    });
    const exportButton = await screen.findByRole("button", { name: /export/i });
    await act(async () => {
      await user.click(exportButton);
    });

    expect(exportRewriteBatchLog).toHaveBeenCalledWith(
      [{ chapterId: "chapter-1", chapterTitle: "One", status: "done", loggedAt }],
      expect.stringMatching(/^batch-log-chapter-rewrite-/),
    );
  });
});
