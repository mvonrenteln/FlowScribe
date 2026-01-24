import { beforeEach, describe, expect, it } from "vitest";
import { resetStore } from "@/lib/__tests__/storeTestUtils";
import { useTranscriptStore } from "@/lib/store";

describe("chapter history integration (split + undo)", () => {
  beforeEach(() => {
    resetStore();
    const seg1 = {
      id: "s1",
      start: 0,
      end: 4,
      text: "one two",
      words: [
        { word: "one", start: 0, end: 1 },
        { word: "two", start: 1, end: 4 },
      ],
      tags: [],
    };
    const seg2 = {
      id: "s2",
      start: 4,
      end: 6,
      text: "three",
      words: [{ word: "three", start: 4, end: 6 }],
      tags: [],
    };

    const chapters = [
      {
        id: "c1",
        title: "C1",
        startSegmentId: "s1",
        endSegmentId: "s2",
        segmentCount: 2,
        createdAt: 1,
        source: "manual",
      },
    ];

    useTranscriptStore.setState({
      segments: [seg1, seg2],
      chapters,
      selectedSegmentId: null,
      selectedChapterId: null,
      history: [
        {
          segments: [seg1, seg2],
          speakers: [],
          tags: [],
          chapters,
          selectedSegmentId: null,
          selectedChapterId: null,
          currentTime: 0,
          confidenceScoresVersion: 0,
        },
      ],
      historyIndex: 0,
    });
  });

  it("splits a segment and undo restores original chapters", () => {
    const before = useTranscriptStore.getState();
    expect(before.chapters).toHaveLength(1);

    // perform split
    useTranscriptStore.getState().splitSegment("s1", 1);
    const afterSplit = useTranscriptStore.getState();
    expect(afterSplit.segments.length).toBe(3);
    expect(afterSplit.chapters).toHaveLength(1);

    // undo should restore original segments and chapters
    useTranscriptStore.getState().undo();
    const afterUndo = useTranscriptStore.getState();
    expect(afterUndo.segments.length).toBe(2);
    expect(afterUndo.chapters).toHaveLength(1);
    expect(afterUndo.chapters[0].startSegmentId).toBe("s1");
    expect(afterUndo.chapters[0].endSegmentId).toBe("s2");
  });
});
