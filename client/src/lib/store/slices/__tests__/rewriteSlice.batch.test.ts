import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreApi } from "zustand";
import { create } from "zustand";
import { rewriteChapter } from "@/lib/ai/features/rewrite/service";
import type {
  AIChapterDetectionConfig,
  AIPrompt,
  Segment,
  TranscriptStore,
} from "@/lib/store/types";
import type { Chapter } from "@/types/chapter";
import { createRewriteSlice, initialRewriteState, type RewriteSlice } from "../rewriteSlice";

vi.mock("@/lib/ai/features/rewrite/service", () => ({
  rewriteChapter: vi.fn(),
  rewriteParagraph: vi.fn(),
}));

type TestState = RewriteSlice & {
  aiChapterDetectionConfig: AIChapterDetectionConfig;
  segments: Segment[];
  chapters: Chapter[];
  selectSegmentsInChapter: ReturnType<typeof vi.fn>;
  setChapterRewrite: ReturnType<typeof vi.fn>;
  setChapterDisplayMode: ReturnType<typeof vi.fn>;
  updateChapterDetectionConfig: ReturnType<typeof vi.fn>;
  addChapterDetectionPrompt: ReturnType<typeof vi.fn>;
  updateChapterDetectionPrompt: ReturnType<typeof vi.fn>;
  deleteChapterDetectionPrompt: ReturnType<typeof vi.fn>;
  updateChapterRewrite: ReturnType<typeof vi.fn>;
};

const prompt: AIPrompt = {
  id: "prompt-1",
  name: "Rewrite",
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
  },
  {
    id: "chapter-2",
    title: "Two",
    startSegmentId: "seg-2",
    endSegmentId: "seg-2",
    segmentCount: 1,
  },
];

const buildConfig = (prompts = [prompt]): AIChapterDetectionConfig => ({
  batchSize: 100,
  minChapterLength: 1,
  maxChapterLength: 100,
  tagIds: [],
  activePromptId: "prompt-1",
  prompts,
  includeContext: true,
  contextWordLimit: 500,
  includeParagraphContext: true,
  paragraphContextCount: 2,
});

const createStore = () =>
  create<TestState>()((set, get) => ({
    aiChapterDetectionConfig: buildConfig(),
    segments,
    chapters,
    selectSegmentsInChapter: vi.fn((chapterId: string) => [
      segments[chapterId === "chapter-1" ? 0 : 1],
    ]),
    setChapterRewrite: vi.fn(),
    setChapterDisplayMode: vi.fn(),
    updateChapterDetectionConfig: vi.fn(),
    addChapterDetectionPrompt: vi.fn(),
    updateChapterDetectionPrompt: vi.fn(),
    deleteChapterDetectionPrompt: vi.fn(),
    updateChapterRewrite: vi.fn(),
    ...initialRewriteState,
    ...createRewriteSlice(
      set as StoreApi<TranscriptStore>["setState"],
      get as StoreApi<TranscriptStore>["getState"],
    ),
  }));

describe("RewriteSlice batch rewrite", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createStore();
  });

  it("starts idle", () => {
    expect(store.getState().batchRewriteIsProcessing).toBe(false);
    expect(store.getState().batchRewriteIsCancelling).toBe(false);
    expect(store.getState().batchRewriteLog).toEqual([]);
  });

  it("processes chapters sequentially and passes pending drafts as context", async () => {
    (rewriteChapter as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rewrittenText: "Draft text for chapter 1" })
      .mockResolvedValueOnce({ rewrittenText: "Draft text for chapter 2" });

    await store.getState().startBatchRewrite({ promptId: "prompt-1" });

    expect(rewriteChapter).toHaveBeenCalledTimes(2);
    const chapter2Call = (rewriteChapter as ReturnType<typeof vi.fn>).mock.calls[1][0];
    const previous = chapter2Call.allChapters.find(
      (chapter: Chapter) => chapter.id === "chapter-1",
    );
    expect(previous.rewrittenText).toBe("Draft text for chapter 1");
    expect(store.getState().setChapterRewrite).not.toHaveBeenCalled();
    expect(store.getState().rewriteDraftByChapterId["chapter-2"]?.text).toBe(
      "Draft text for chapter 2",
    );
    expect(store.getState().batchRewriteLog.map((entry) => entry.status)).toEqual(["done", "done"]);
    expect(store.getState().batchRewriteIsProcessing).toBe(false);
    expect(store.getState().batchRewriteAbortController).toBeNull();
  });

  it("skips accepted and pending rewrites only when requested", async () => {
    store.setState({
      chapters: [{ ...chapters[0], rewrittenText: "Accepted" }, chapters[1]],
      rewriteDraftByChapterId: { "chapter-2": { text: "Pending", promptId: "prompt-1" } },
    });

    await store.getState().startBatchRewrite({ promptId: "prompt-1", skipAlreadyRewritten: true });

    expect(rewriteChapter).not.toHaveBeenCalled();
    expect(store.getState().batchRewriteError).toBe("No chapters to rewrite");

    (rewriteChapter as ReturnType<typeof vi.fn>).mockResolvedValue({ rewrittenText: "New" });
    await store.getState().startBatchRewrite({ promptId: "prompt-1", skipAlreadyRewritten: false });

    expect(rewriteChapter).toHaveBeenCalledTimes(2);
  });

  it("logs failed and empty chapters without stopping", async () => {
    store
      .getState()
      .selectSegmentsInChapter.mockImplementation((chapterId: string) =>
        chapterId === "chapter-1" ? [segments[0]] : [],
      );
    (rewriteChapter as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));

    await store.getState().startBatchRewrite({ promptId: "prompt-1" });

    expect(store.getState().batchRewriteProcessedCount).toBe(2);
    expect(store.getState().batchRewriteLog.map((entry) => entry.status)).toEqual([
      "failed",
      "skipped",
    ]);
  });

  it("can cancel the active controller", async () => {
    let rejectRewrite: ((error: Error) => void) | null = null;
    (rewriteChapter as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRewrite = reject;
        }),
    );

    const running = store.getState().startBatchRewrite({ promptId: "prompt-1" });
    const controller = store.getState().batchRewriteAbortController;
    store.getState().cancelBatchRewrite();
    expect(controller?.signal.aborted).toBe(true);
    expect(store.getState().batchRewriteIsCancelling).toBe(true);
    rejectRewrite?.(new DOMException("Aborted", "AbortError"));
    await running;

    expect(store.getState().batchRewriteIsCancelling).toBe(false);
    expect(store.getState().batchRewriteLog.map((entry) => entry.status)).toEqual([
      "cancelled",
      "cancelled",
    ]);
  });

  it("does not write a draft when a request resolves after cancellation", async () => {
    let resolveRewrite: ((value: { rewrittenText: string }) => void) | null = null;
    (rewriteChapter as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRewrite = resolve;
        }),
    );

    const running = store.getState().startBatchRewrite({ promptId: "prompt-1" });
    store.getState().cancelBatchRewrite();
    resolveRewrite?.({ rewrittenText: "Too late" });
    await running;

    expect(store.getState().rewriteDraftByChapterId["chapter-1"]).toBeUndefined();
    expect(store.getState().batchRewriteLog.map((entry) => entry.status)).toEqual([
      "cancelled",
      "cancelled",
    ]);
  });

  it("does not let an aborted previous batch clear a newer batch", async () => {
    let rejectFirst: ((error: Error) => void) | null = null;
    (rewriteChapter as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValue({ rewrittenText: "New batch draft" });

    const first = store.getState().startBatchRewrite({ promptId: "prompt-1" });
    expect(rejectFirst).not.toBeNull();
    const second = store.getState().startBatchRewrite({ promptId: "prompt-1" });
    rejectFirst?.(new DOMException("Aborted", "AbortError"));
    await first;
    await second;

    expect(store.getState().rewriteDraftByChapterId["chapter-1"]?.text).toBe("New batch draft");
    expect(store.getState().batchRewriteAbortController).toBeNull();
    expect(store.getState().batchRewriteLog[0]?.status).toBe("done");
  });

  it("sets errors for invalid prompt and no chapters", async () => {
    await store.getState().startBatchRewrite({ promptId: "missing" });
    expect(store.getState().batchRewriteError).toBe("Prompt missing not found");
    expect(rewriteChapter).not.toHaveBeenCalled();

    store.setState({ chapters: [] });
    await store.getState().startBatchRewrite({ promptId: "prompt-1" });
    expect(store.getState().batchRewriteError).toBe("No chapters to rewrite");
  });

  it("accepts and rejects all pending drafts", () => {
    store.setState({
      rewriteDraftByChapterId: {
        "chapter-1": { text: "One", promptId: "prompt-1" },
        "chapter-2": { text: "Two", promptId: "prompt-1", providerId: "p", model: "m" },
      },
    });

    store.getState().acceptAllBatchRewrites();
    expect(store.getState().setChapterRewrite).toHaveBeenCalledTimes(2);
    expect(store.getState().setChapterDisplayMode).toHaveBeenCalledWith("chapter-1", "rewritten");
    expect(store.getState().rewriteDraftByChapterId).toEqual({});

    store.setState({
      rewriteDraftByChapterId: { "chapter-1": { text: "One", promptId: "prompt-1" } },
    });
    store.getState().setChapterRewrite.mockClear();
    store.getState().rejectAllBatchRewrites();
    expect(store.getState().setChapterRewrite).not.toHaveBeenCalled();
    expect(store.getState().rewriteDraftByChapterId).toEqual({});
  });
});
