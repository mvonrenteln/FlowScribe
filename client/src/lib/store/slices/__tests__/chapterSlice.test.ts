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
});
