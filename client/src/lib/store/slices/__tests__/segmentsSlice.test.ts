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

type StoreState = {
  segments: Segment[];
  speakers: unknown[];
  tags: unknown[];
  chapters: Chapter[];
  history: unknown[];
  historyIndex: number;
  selectedSegmentId: string | null;
  selectedChapterId: string | null;
  currentTime: number;
  confidenceScoresVersion: number;
};

const makeStore = (initialSegments: Segment[], initialChapters: Chapter[]) => {
  let state: StoreState = {
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

  const set = (
    patch: Partial<StoreState> | ((s: StoreState) => Partial<StoreState> | undefined),
  ) => {
    if (typeof patch === "function") {
      const res = patch(state as StoreState);
      if (res && typeof res === "object") state = { ...state, ...res };
    } else if (patch && typeof patch === "object") {
      state = { ...state, ...patch };
    }
  };
  const get = () => state;

  const context = { getSessionsCache: () => ({}) };

  const slice = createSegmentsSlice(
    set as unknown as Parameters<typeof createSegmentsSlice>[0],
    get as unknown as Parameters<typeof createSegmentsSlice>[1],
    context as unknown as Parameters<typeof createSegmentsSlice>[2],
  );
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

  it("keeps chapter when deleting its first segment and remaps start to next segment", () => {
    const s1: Segment = { id: "s1", start: 0, end: 1, words: [{ word: "a", start: 0, end: 1 }] };
    const s2: Segment = { id: "s2", start: 1, end: 2, words: [{ word: "b", start: 1, end: 2 }] };
    const s3: Segment = { id: "s3", start: 2, end: 3, words: [{ word: "c", start: 2, end: 3 }] };
    // chapter spans from s1 to s2; deleting s1 should keep the chapter with start->s2
    const chapters = [{ id: "c1", startSegmentId: "s1", endSegmentId: "s2" }];

    const store = makeStore([s1, s2, s3], chapters);
    store.slice.deleteSegment("s1");

    const state = store.getState();
    const c = state.chapters.find((ch: Chapter) => ch.id === "c1");
    expect(c).toBeDefined();
    expect(c.startSegmentId).toBe("s2");
    expect(c.endSegmentId).toBe("s2");
  });

  it("remaps chapter end to previous segment when deleting the last segment", () => {
    const s1: Segment = { id: "s1", start: 0, end: 1, words: [{ word: "a", start: 0, end: 1 }] };
    const s2: Segment = { id: "s2", start: 1, end: 2, words: [{ word: "b", start: 1, end: 2 }] };
    const s3: Segment = { id: "s3", start: 2, end: 3, words: [{ word: "c", start: 2, end: 3 }] };
    // chapter spans from s1 to s3; deleting s3 should keep the chapter and set end->s2
    const chapters = [{ id: "c1", startSegmentId: "s1", endSegmentId: "s3" }];

    const store = makeStore([s1, s2, s3], chapters);
    store.slice.deleteSegment("s3");

    const state = store.getState();
    const c = state.chapters.find((ch: Chapter) => ch.id === "c1");
    expect(c).toBeDefined();
    expect(c.endSegmentId).toBe("s2");
    expect(c.startSegmentId).toBe("s1");
  });

  it("no-ops when attempting to delete a non-existent segment id", () => {
    const s1: Segment = { id: "s1", start: 0, end: 1, words: [{ word: "a", start: 0, end: 1 }] };
    const chapters = [{ id: "c1", startSegmentId: "s1", endSegmentId: "s1" }];
    const store = makeStore([s1], chapters);

    store.slice.deleteSegment("does-not-exist");

    const state = store.getState();
    expect(state.segments.length).toBe(1);
    expect(state.chapters.length).toBe(1);
    expect(state.chapters[0].startSegmentId).toBe("s1");
  });

  it("no-ops when splitting at invalid index", () => {
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

    // invalid indices: 0 and >= words.length
    store.slice.splitSegment("s1", 0);
    store.slice.splitSegment("s1", 2);

    const state = store.getState();
    // nothing changed
    expect(state.segments.length).toBe(1);
    expect(state.chapters.length).toBe(1);
    expect(state.chapters[0].startSegmentId).toBe("s1");
  });

  it("split → merge → split sequence keeps chapters consistent", () => {
    const s1: Segment = {
      id: "s1",
      start: 0,
      end: 6,
      words: [
        { word: "one", start: 0, end: 1 },
        { word: "two", start: 1, end: 2 },
        { word: "three", start: 2, end: 6 },
      ],
    };
    const s2: Segment = { id: "s2", start: 6, end: 8, words: [{ word: "x", start: 6, end: 8 }] };
    const chapters = [{ id: "c1", startSegmentId: "s1", endSegmentId: "s2", title: "Seq" }];

    const store = makeStore([s1, s2], chapters);

    // split s1 into two
    store.slice.splitSegment("s1", 2);
    let state = store.getState();
    expect(state.segments.length).toBe(3);

    const first = state.segments.find((s: Segment) => s.start === s1.start && s.end < s1.end);
    const second = state.segments.find((s: Segment) => s.end === s1.end && s.start > s1.start);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) throw new Error("Expected split to produce two segments");

    // merge the two back
    const mergedId = store.slice.mergeSegments(first.id, second.id);
    expect(mergedId).toBeDefined();
    state = store.getState();
    expect(state.segments.some((s: Segment) => s.id === mergedId)).toBe(true);

    // split the merged segment at a different index
    if (!mergedId) throw new Error("Expected merged id from mergeSegments");
    const mergedSegment = state.segments.find((s: Segment) => s.id === mergedId);
    expect(mergedSegment).toBeDefined();
    if (!mergedSegment) throw new Error("Expected merged segment");
    // simulate split at index 1 if possible
    if (mergedSegment.words.length > 1) {
      store.slice.splitSegment(mergedId, 1);
    }

    state = store.getState();
    // chapters should still reference valid segment ids and cover same overall range
    expect(state.chapters.length).toBe(1);
    const ch = state.chapters[0];
    const ids = state.segments.map((s: Segment) => s.id);
    expect(ids.includes(ch.startSegmentId)).toBe(true);
    expect(ids.includes(ch.endSegmentId)).toBe(true);
  });

  it("merge non-adjacent segments is a no-op and leaves chapters unchanged", () => {
    const s1: Segment = { id: "s1", start: 0, end: 1, words: [{ word: "a", start: 0, end: 1 }] };
    const s2: Segment = { id: "s2", start: 1, end: 2, words: [{ word: "b", start: 1, end: 2 }] };
    const s3: Segment = { id: "s3", start: 2, end: 3, words: [{ word: "c", start: 2, end: 3 }] };
    const chapters = [{ id: "c1", startSegmentId: "s1", endSegmentId: "s3" }];

    const store = makeStore([s1, s2, s3], chapters);
    const before = store.getState();
    const res = store.slice.mergeSegments("s1", "s3");
    expect(res).toBeNull();
    const after = store.getState();
    // segments and chapters unchanged
    expect(after.segments.map((s: Segment) => s.id)).toEqual(
      before.segments.map((s: Segment) => s.id),
    );
    expect(after.chapters).toEqual(before.chapters);
  });

  it("clears chapters when deleting all segments", () => {
    const s1: Segment = { id: "s1", start: 0, end: 1, words: [{ word: "a", start: 0, end: 1 }] };
    const s2: Segment = { id: "s2", start: 1, end: 2, words: [{ word: "b", start: 1, end: 2 }] };
    const chapters = [{ id: "c1", startSegmentId: "s1", endSegmentId: "s2" }];

    const store = makeStore([s1, s2], chapters);
    // delete both segments
    store.slice.deleteSegment("s1");
    store.slice.deleteSegment("s2");

    const state = store.getState();
    expect(state.segments.length).toBe(0);
    expect(state.chapters.length).toBe(0);
  });
});
