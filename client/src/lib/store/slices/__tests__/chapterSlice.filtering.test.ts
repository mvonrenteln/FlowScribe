import { beforeEach, describe, expect, it } from "vitest";
import { resetStore } from "@/lib/__tests__/storeTestUtils";
import { useTranscriptStore } from "@/lib/store";

const segments = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    start: 0,
    end: 1,
    text: "First segment",
    words: [],
    tags: ["tag-1"],
  },
  {
    id: "seg-2",
    speaker: "SPEAKER_00",
    start: 1,
    end: 2,
    text: "Second segment",
    words: [],
    tags: ["tag-1"],
  },
  {
    id: "seg-3",
    speaker: "SPEAKER_00",
    start: 2,
    end: 3,
    text: "Third segment",
    words: [],
    tags: ["tag-2"],
  },
  {
    id: "seg-4",
    speaker: "SPEAKER_00",
    start: 3,
    end: 4,
    text: "Fourth segment",
    words: [],
    tags: ["tag-2"],
  },
];

const seedStore = () => {
  useTranscriptStore.setState({
    ...useTranscriptStore.getState(),
    segments,
    speakers: [],
    tags: [
      { id: "tag-1", name: "Important", color: "#ff0000" },
      { id: "tag-2", name: "Review", color: "#00ff00" },
    ],
    chapters: [],
    selectedSegmentId: "seg-1",
    selectedChapterId: null,
    filteredSegmentIds: new Set(),
    filtersActive: false,
    history: [
      {
        segments,
        speakers: [],
        tags: [
          { id: "tag-1", name: "Important", color: "#ff0000" },
          { id: "tag-2", name: "Review", color: "#00ff00" },
        ],
        chapters: [],
        selectedSegmentId: "seg-1",
        selectedChapterId: null,
        currentTime: 0,
        confidenceScoresVersion: 0,
      },
    ],
    historyIndex: 0,
  });
};

describe("ChapterSlice with Filtering", () => {
  beforeEach(() => {
    resetStore();
    seedStore();
  });

  describe("selectSegmentsInChapter with no filters", () => {
    it("returns all segments in chapter when no filters are active", () => {
      // Create a chapter covering all segments
      const chapterId = useTranscriptStore.getState().startChapter("Test Chapter", "seg-1");
      if (!chapterId) throw new Error("Failed to create chapter");

      // Update chapter end to cover all segments
      useTranscriptStore.getState().updateChapter(chapterId, {
        endSegmentId: "seg-4",
      });

      // No filters active
      expect(useTranscriptStore.getState().filteredSegmentIds.size).toBe(0);
      expect(useTranscriptStore.getState().filtersActive).toBe(false);

      // Should return all 4 segments
      const segmentsInChapter = useTranscriptStore.getState().selectSegmentsInChapter(chapterId);
      expect(segmentsInChapter).toHaveLength(4);
      expect(segmentsInChapter.map((s) => s.id)).toEqual(["seg-1", "seg-2", "seg-3", "seg-4"]);
    });

    it("updates chapter segment ranges after moving the next chapter start", () => {
      useTranscriptStore.setState({
        ...useTranscriptStore.getState(),
        chapters: [
          {
            id: "chapter-1",
            title: "Chapter 1",
            startSegmentId: "seg-1",
            endSegmentId: "seg-2",
            segmentCount: 2,
            createdAt: 1,
            source: "manual",
          },
          {
            id: "chapter-2",
            title: "Chapter 2",
            startSegmentId: "seg-3",
            endSegmentId: "seg-4",
            segmentCount: 2,
            createdAt: 2,
            source: "manual",
          },
        ],
      });

      const initial = useTranscriptStore.getState().selectSegmentsInChapter("chapter-1");
      expect(initial.map((segment) => segment.id)).toEqual(["seg-1", "seg-2"]);

      useTranscriptStore.getState().moveChapterStart("chapter-2", "seg-4");

      const updated = useTranscriptStore.getState().selectSegmentsInChapter("chapter-1");
      expect(updated.map((segment) => segment.id)).toEqual(["seg-1", "seg-2", "seg-3"]);
    });
  });

  describe("selectSegmentsInChapter with active filters", () => {
    it("returns only filtered segments when filters are active", () => {
      // Create a chapter covering all segments
      const chapterId = useTranscriptStore.getState().startChapter("Test Chapter", "seg-1");
      if (!chapterId) throw new Error("Failed to create chapter");

      useTranscriptStore.getState().updateChapter(chapterId, {
        endSegmentId: "seg-4",
      });

      // Simulate active filter: only show segments with tag-1
      useTranscriptStore.getState().setFilteredSegmentIds(["seg-1", "seg-2"], true);

      // Should return only the 2 filtered segments
      const segmentsInChapter = useTranscriptStore.getState().selectSegmentsInChapter(chapterId);
      expect(segmentsInChapter).toHaveLength(2);
      expect(segmentsInChapter.map((s) => s.id)).toEqual(["seg-1", "seg-2"]);
    });

    it("returns empty array if no filtered segments are in chapter", () => {
      // Create a chapter covering only seg-3 and seg-4
      const chapterId = useTranscriptStore.getState().startChapter("Test Chapter", "seg-3");
      if (!chapterId) throw new Error("Failed to create chapter");

      useTranscriptStore.getState().updateChapter(chapterId, {
        endSegmentId: "seg-4",
      });

      // Simulate filter: only show seg-1 and seg-2
      useTranscriptStore.getState().setFilteredSegmentIds(["seg-1", "seg-2"], true);

      // Should return empty array (no filtered segments in this chapter)
      const segmentsInChapter = useTranscriptStore.getState().selectSegmentsInChapter(chapterId);
      expect(segmentsInChapter).toHaveLength(0);
    });

    it("returns partial segments when some are filtered", () => {
      // Create a chapter covering all segments
      const chapterId = useTranscriptStore.getState().startChapter("Test Chapter", "seg-1");
      if (!chapterId) throw new Error("Failed to create chapter");

      useTranscriptStore.getState().updateChapter(chapterId, {
        endSegmentId: "seg-4",
      });

      // Simulate filter: show seg-1, seg-2, seg-4 (but not seg-3)
      useTranscriptStore.getState().setFilteredSegmentIds(["seg-1", "seg-2", "seg-4"], true);

      // Should return 3 segments
      const segmentsInChapter = useTranscriptStore.getState().selectSegmentsInChapter(chapterId);
      expect(segmentsInChapter).toHaveLength(3);
      expect(segmentsInChapter.map((s) => s.id)).toEqual(["seg-1", "seg-2", "seg-4"]);
    });

    it("returns empty array when filters are active but no segments match", () => {
      const chapterId = useTranscriptStore.getState().startChapter("Test Chapter", "seg-1");
      if (!chapterId) throw new Error("Failed to create chapter");

      useTranscriptStore.getState().updateChapter(chapterId, {
        endSegmentId: "seg-4",
      });

      useTranscriptStore.getState().setFilteredSegmentIds([], true);

      const segmentsInChapter = useTranscriptStore.getState().selectSegmentsInChapter(chapterId);
      expect(segmentsInChapter).toHaveLength(0);
    });
  });

  describe("setFilteredSegmentIds", () => {
    it("updates filteredSegmentIds correctly", () => {
      const ids = ["seg-1", "seg-3"];
      useTranscriptStore.getState().setFilteredSegmentIds(ids, true);

      const filtered = useTranscriptStore.getState().filteredSegmentIds;
      expect(filtered.size).toBe(2);
      expect(filtered.has("seg-1")).toBe(true);
      expect(filtered.has("seg-3")).toBe(true);
      expect(filtered.has("seg-2")).toBe(false);
      expect(useTranscriptStore.getState().filtersActive).toBe(true);
    });

    it("clears filteredSegmentIds when empty array is passed", () => {
      // First set some IDs
      useTranscriptStore.getState().setFilteredSegmentIds(["seg-1", "seg-2"], true);
      expect(useTranscriptStore.getState().filteredSegmentIds.size).toBe(2);
      expect(useTranscriptStore.getState().filtersActive).toBe(true);

      // Then clear
      useTranscriptStore.getState().setFilteredSegmentIds([], false);
      expect(useTranscriptStore.getState().filteredSegmentIds.size).toBe(0);
      expect(useTranscriptStore.getState().filtersActive).toBe(false);
    });

    it("keeps filters active when empty array is passed with active flag", () => {
      useTranscriptStore.getState().setFilteredSegmentIds(["seg-1"], true);
      expect(useTranscriptStore.getState().filtersActive).toBe(true);

      useTranscriptStore.getState().setFilteredSegmentIds([], true);
      expect(useTranscriptStore.getState().filteredSegmentIds.size).toBe(0);
      expect(useTranscriptStore.getState().filtersActive).toBe(true);
    });
  });
});
