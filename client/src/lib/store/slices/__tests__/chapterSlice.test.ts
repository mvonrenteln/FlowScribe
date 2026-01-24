import { beforeEach, describe, expect, it } from "vitest";
import { resetStore } from "@/lib/__tests__/storeTestUtils";
import { useTranscriptStore } from "@/lib/store";

const segments = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    start: 0,
    end: 1,
    text: "One",
    words: [],
    tags: [],
  },
  {
    id: "seg-2",
    speaker: "SPEAKER_00",
    start: 1,
    end: 2,
    text: "Two",
    words: [],
    tags: [],
  },
  {
    id: "seg-3",
    speaker: "SPEAKER_00",
    start: 2,
    end: 3,
    text: "Three",
    words: [],
    tags: [],
  },
];

const seedStore = () => {
  useTranscriptStore.setState({
    ...useTranscriptStore.getState(),
    segments,
    speakers: [],
    tags: [],
    chapters: [],
    selectedSegmentId: "seg-1",
    selectedChapterId: null,
    history: [
      {
        segments,
        speakers: [],
        tags: [],
        chapters: [],
        selectedSegmentId: "seg-1",
        selectedChapterId: null,
        currentTime: 0,
        confidenceScoresVersion: 0,
      },
    ],
    historyIndex: 0,
    currentTime: 0,
  });
};

describe("chapterSlice", () => {
  beforeEach(() => {
    resetStore();
    seedStore();
  });

  it("creates a chapter and selects it", () => {
    useTranscriptStore.getState().startChapter("Intro", "seg-2");

    const state = useTranscriptStore.getState();
    expect(state.chapters).toHaveLength(1);
    expect(state.chapters[0]?.startSegmentId).toBe("seg-2");
    expect(state.chapters[0]?.endSegmentId).toBe("seg-3");
    expect(state.chapters[0]?.segmentCount).toBe(2);
    expect(state.selectedChapterId).toBe(state.chapters[0]?.id);
  });

  it("splits the previous chapter when inserting a new one", () => {
    useTranscriptStore.setState({
      ...useTranscriptStore.getState(),
      chapters: [
        {
          id: "chapter-1",
          title: "Chapter 1",
          startSegmentId: "seg-1",
          endSegmentId: "seg-3",
          segmentCount: 3,
          createdAt: 1,
          source: "manual",
        },
      ],
      selectedChapterId: "chapter-1",
    });

    useTranscriptStore.getState().startChapter("Chapter 2", "seg-2");

    const state = useTranscriptStore.getState();
    expect(state.chapters).toHaveLength(2);
    const [first, second] = state.chapters;
    expect(first?.endSegmentId).toBe("seg-1");
    expect(first?.segmentCount).toBe(1);
    expect(second?.startSegmentId).toBe("seg-2");
    expect(second?.endSegmentId).toBe("seg-3");
  });

  it("updates chapter metadata", () => {
    useTranscriptStore.getState().startChapter("Intro", "seg-1");
    const chapterId = useTranscriptStore.getState().chapters[0]?.id;
    if (!chapterId) throw new Error("Missing chapter");

    useTranscriptStore.getState().updateChapter(chapterId, {
      title: "Updated",
      summary: "One sentence summary.",
    });

    const updated = useTranscriptStore.getState().chapters[0];
    expect(updated?.title).toBe("Updated");
    expect(updated?.summary).toBe("One sentence summary.");
  });

  it("deletes a chapter and clears selection", () => {
    useTranscriptStore.getState().startChapter("Intro", "seg-1");
    const chapterId = useTranscriptStore.getState().chapters[0]?.id;
    if (!chapterId) throw new Error("Missing chapter");

    useTranscriptStore.getState().deleteChapter(chapterId);

    const state = useTranscriptStore.getState();
    expect(state.chapters).toHaveLength(0);
    expect(state.selectedChapterId).toBeNull();
  });

  it("prevents overlapping chapter updates", () => {
    // seed two non-overlapping chapters
    useTranscriptStore.setState({
      ...useTranscriptStore.getState(),
      chapters: [
        {
          id: "chapter-1",
          title: "Chapter 1",
          startSegmentId: "seg-1",
          endSegmentId: "seg-1",
          segmentCount: 1,
          createdAt: 1,
          source: "manual",
        },
        {
          id: "chapter-2",
          title: "Chapter 2",
          startSegmentId: "seg-2",
          endSegmentId: "seg-3",
          segmentCount: 2,
          createdAt: 2,
          source: "manual",
        },
      ],
      selectedChapterId: null,
    });

    // attempt to move chapter-2 to start at seg-1 (would overlap)
    useTranscriptStore.getState().updateChapter("chapter-2", { startSegmentId: "seg-1" });

    const state = useTranscriptStore.getState();
    const ch2 = state.chapters.find((c) => c.id === "chapter-2");
    // update should be rejected, original startSegmentId must remain
    expect(ch2?.startSegmentId).toBe("seg-2");
  });

  it("undo/redo preserves chapter history for startChapter", () => {
    // start with no chapters
    expect(useTranscriptStore.getState().chapters).toHaveLength(0);

    const id = useTranscriptStore.getState().startChapter("Intro", "seg-1");
    expect(useTranscriptStore.getState().chapters).toHaveLength(1);

    // undo should remove the created chapter
    useTranscriptStore.getState().undo();
    expect(useTranscriptStore.getState().chapters).toHaveLength(0);

    // redo should restore it
    useTranscriptStore.getState().redo();
    expect(useTranscriptStore.getState().chapters).toHaveLength(1);
    expect(useTranscriptStore.getState().chapters[0]?.id).toBe(id);
  });

  it("selectors: selectChapterForSegment and selectSegmentsInChapter behave correctly", () => {
    // create a chapter starting at seg-2 which should cover seg-2..seg-3
    const createdId = useTranscriptStore.getState().startChapter("Part", "seg-2");
    if (!createdId) throw new Error("Failed to create chapter");

    const found = useTranscriptStore.getState().selectChapterForSegment("seg-2");
    expect(found).toBeDefined();
    expect(found?.id).toBe(createdId);

    const segmentsIn = useTranscriptStore.getState().selectSegmentsInChapter(createdId);
    expect(segmentsIn).toHaveLength(2);
    expect(segmentsIn[0].id).toBe("seg-2");
  });

  it("AI-generated chapters can be replaced by a later AI run (session replace simulation)", () => {
    // simulate an AI run that produced chapters
    useTranscriptStore.setState({
      ...useTranscriptStore.getState(),
      chapters: [
        {
          id: "ai-1",
          title: "AI Old",
          startSegmentId: "seg-1",
          endSegmentId: "seg-2",
          segmentCount: 2,
          createdAt: 1,
          source: "ai",
        },
      ],
      selectedChapterId: "ai-1",
    });

    // later AI run replaces chapters
    useTranscriptStore.setState({
      ...useTranscriptStore.getState(),
      chapters: [
        {
          id: "ai-2",
          title: "AI New",
          startSegmentId: "seg-2",
          endSegmentId: "seg-3",
          segmentCount: 2,
          createdAt: 2,
          source: "ai",
        },
      ],
      selectedChapterId: "ai-2",
    });

    const state = useTranscriptStore.getState();
    expect(state.chapters).toHaveLength(1);
    expect(state.chapters[0]?.id).toBe("ai-2");
    expect(state.selectedChapterId).toBe("ai-2");
  });
});
