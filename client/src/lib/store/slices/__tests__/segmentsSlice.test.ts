import { describe, expect, it } from "vitest";
import { createSegmentsSlice } from "../segmentsSlice";

type Word = { word: string; start: number; end: number };
type Segment = {
  id: string;
  start: number;
  end: number;
  words: Word[];
  speaker?: string;
  tags?: unknown[];
};
type Chapter = { id: string; startSegmentId: string; endSegmentId: string; title?: string };

const makeStore = (initialSegments: Segment[], initialChapters: Chapter[]) => {
  let state: any = {
    segments: initialSegments,
    speakers: [],
    tags: [],
    chapters: initialChapters,
    history: [],
    historyIndex: 0,
    selectedSegmentId: null,
    selectedChapterId: null,
    currentTime: 0,
    confidenceScoresVersion: 0,
  };

  const set = (patch: any) => {
    if (typeof patch === "function") {
      const res = patch(state);
      if (res && typeof res === "object") state = { ...state, ...res };
    } else {
      state = { ...state, ...patch };
    }
  };
  const get = () => state;

  const context = { getSessionsCache: () => ({}) } as any;

  const slice = createSegmentsSlice(set as any, get as any, context);
  return { getState: () => state, slice } as const;
};

describe("segmentsSlice chapter updates", () => {
  it("updates chapters when splitting a segment", () => {
    const s1: Segment = {
      id: "s1",
      start: 0,
      end: 4,
      words: [
        { word: "hello", start: 0, end: 1 },
        { word: "world", start: 2, end: 4 },
      ],
    };
    const chapters = [{ id: "c1", startSegmentId: "s1", endSegmentId: "s1", title: "A" }];
    const store = makeStore([s1], chapters);

    store.slice.splitSegment("s1", 1);

    const state = store.getState();
    expect(state.segments.length).toBe(2);

    const first = state.segments.find((s: Segment) => s.start === s1.start && s.end < s1.end);
    const second = state.segments.find((s: Segment) => s.end === s1.end && s.start > s1.start);
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    expect(state.chapters.length).toBe(1);
    expect(state.chapters[0].startSegmentId).toBe(first.id);
    expect(state.chapters[0].endSegmentId).toBe(second.id);
  });

  it("remaps chapters when merging adjacent segments", () => {
    const s1: Segment = { id: "s1", start: 0, end: 2, words: [{ word: "a", start: 0, end: 1 }] };
    const s2: Segment = { id: "s2", start: 2, end: 5, words: [{ word: "b", start: 2, end: 5 }] };
    const chapters = [
      { id: "c1", startSegmentId: "s1", endSegmentId: "s2", title: "MergeMe" },
      { id: "c2", startSegmentId: "s1", endSegmentId: "s1", title: "Keep" },
    ];

    const store = makeStore([s1, s2], chapters);
    const mergedId = store.slice.mergeSegments("s1", "s2");

    const state = store.getState();
    expect(mergedId).toBeDefined();
    expect(state.segments.some((s: Segment) => s.id === mergedId)).toBe(true);

    // Chapter that referenced s1->s2 should now reference mergedId for both
    const c = state.chapters.find((ch: Chapter) => ch.id === "c1");
    expect(c).toBeDefined();
    expect(c.startSegmentId).toBe(mergedId);
    expect(c.endSegmentId).toBe(mergedId);

    // Chapter that didn't reference merged segments should remain
    const keep = state.chapters.find((ch: Chapter) => ch.id === "c2");
    expect(keep).toBeDefined();
  });

  it("removes chapters referencing a deleted segment", () => {
    const s1: Segment = { id: "s1", start: 0, end: 1, words: [{ word: "a", start: 0, end: 1 }] };
    const s2: Segment = { id: "s2", start: 1, end: 2, words: [{ word: "b", start: 1, end: 2 }] };
    const s3: Segment = { id: "s3", start: 2, end: 3, words: [{ word: "c", start: 2, end: 3 }] };
    const chapters = [
      { id: "c1", startSegmentId: "s2", endSegmentId: "s2" },
      { id: "c2", startSegmentId: "s1", endSegmentId: "s3" },
    ];

    const store = makeStore([s1, s2, s3], chapters);
    store.slice.deleteSegment("s2");

    const state = store.getState();
    // chapter c1 referenced deleted s2 and should be removed
    expect(state.chapters.find((c: Chapter) => c.id === "c1")).toBeUndefined();
    // other chapter should remain
    expect(state.chapters.find((c: Chapter) => c.id === "c2")).toBeDefined();
  });
});
