import { describe, expect, it } from "vitest";
import { validateMergeCandidate } from "@/lib/ai/features/segmentMerge/utils";
import type { MergeAnalysisSegment } from "../types";

function makeSegment(id: string, speaker = "A"): MergeAnalysisSegment {
  return { id, speaker } as MergeAnalysisSegment;
}

describe("validateMergeCandidate", () => {
  it("rejects less than 2 segments", () => {
    const res = validateMergeCandidate([], []);
    expect(res.valid).toBe(false);
  });

  it("rejects when a segment id is missing", () => {
    const all = [makeSegment("a"), makeSegment("b")];
    const res = validateMergeCandidate(["a", "c"], all as MergeAnalysisSegment[]);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("not found");
  });

  it("rejects non-consecutive segments", () => {
    const all = [makeSegment("a"), makeSegment("b"), makeSegment("c")];
    const res = validateMergeCandidate(["a", "c"], all as MergeAnalysisSegment[]);
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Segments must be consecutive");
  });

  it("rejects segments with different speakers", () => {
    const all = [makeSegment("a", "A"), makeSegment("b", "B")];
    const res = validateMergeCandidate(["a", "b"], all as MergeAnalysisSegment[]);
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Segments must have the same speaker");
  });

  it("accepts valid consecutive same-speaker segments", () => {
    const all = [makeSegment("a", "A"), makeSegment("b", "A"), makeSegment("c", "A")];
    const res = validateMergeCandidate(["a", "b", "c"], all as MergeAnalysisSegment[]);
    expect(res.valid).toBe(true);
  });
});

import { createMergePairKey } from "@/lib/ai/core/suggestionKeys";
import { createBatchPairMapping } from "../../../core/batchIdMapping";
import {
  applyBasicSmoothing,
  calculateTimeGap,
  collectSegmentPairsWithSimpleIds,
  concatenateTexts,
  createSegmentBatches,
  createSimpleIdContext,
  createSmoothingInfo,
  detectIncorrectSentenceBreak,
  endsWithSentencePunctuation,
  isSameSpeaker,
  isTimeGapAcceptable,
  normalizeRawSuggestion,
  processSuggestion,
  startsWithCapital,
} from "../utils";

describe("segmentMerge utils", () => {
  const segA: MergeAnalysisSegment = {
    id: "seg-1",
    speaker: "A",
    start: 0,
    end: 1.2,
    text: "Hello world",
  } as MergeAnalysisSegment;
  const segB: MergeAnalysisSegment = {
    id: "seg-2",
    speaker: "A",
    start: 1.3,
    end: 2.5,
    text: "and welcome",
  } as MergeAnalysisSegment;

  it("calculateTimeGap and isTimeGapAcceptable", () => {
    expect(calculateTimeGap(segA, segB)).toBeCloseTo(1.3 - 1.2, 5);
    expect(isTimeGapAcceptable(0.1, 0.5)).toBe(true);
    expect(isTimeGapAcceptable(1.0, 0.5)).toBe(false);
  });

  it("sentence heuristics", () => {
    expect(endsWithSentencePunctuation("Hello.")).toBe(true);
    expect(endsWithSentencePunctuation("Hello")).toBe(false);
    expect(startsWithCapital("World")).toBe(true);
    expect(startsWithCapital("äpfel")).toBe(false);

    expect(
      detectIncorrectSentenceBreak({ text: "So this is fine." }, { text: "and continues" }),
    ).toBe(true);
    expect(
      detectIncorrectSentenceBreak({ text: "This ends" }, { text: "Now a new sentence." }),
    ).toBe(true);
    expect(detectIncorrectSentenceBreak({ text: "Complete." }, { text: "Next." })).toBe(false);
  });

  it("concatenate and smoothing", () => {
    const concat = concatenateTexts([segA, segB]);
    expect(concat).toContain("Hello world");
    const sm = applyBasicSmoothing("Hello  , world...");
    expect(sm).toBe("Hello, world.");

    const info = createSmoothingInfo("a b", "a b c", "added c");
    expect(info).toBeDefined();
    expect(info?.smoothedText).toBe("a b c");
  });

  it("processSuggestion builds suggestion correctly", () => {
    const raw = {
      segmentIds: ["seg-1", "seg-2"],
      confidence: 0.9,
      smoothedText: "Hello world and welcome",
      smoothingChanges: "joined",
    } as Record<string, unknown>;

    const map = new Map([
      ["seg-1", segA],
      ["seg-2", segB],
    ]);
    const sug = processSuggestion(
      raw as Record<string, unknown>,
      map as Map<string, MergeAnalysisSegment>,
    );
    expect(sug).not.toBeNull();
    expect(sug?.mergedText).toContain("Hello world");
    // Since smoothedText equals the concatenated original text, smoothing is considered not applied
    expect(sug?.smoothing).toBeUndefined();
  });

  it("collectSegmentPairsWithSimpleIds skips existing pair keys", () => {
    const segments: MergeAnalysisSegment[] = [
      {
        id: "seg-1",
        speaker: "A",
        start: 0,
        end: 1,
        text: "One",
      },
      {
        id: "seg-2",
        speaker: "A",
        start: 1.1,
        end: 2,
        text: "Two",
      },
      {
        id: "seg-3",
        speaker: "A",
        start: 2.1,
        end: 3,
        text: "Three",
      },
    ];

    const context = createSimpleIdContext(segments);
    const mapping = createBatchPairMapping(segments, (segment) => segment.id);
    const skipPairKeys = new Set([createMergePairKey(["seg-1", "seg-2"])]);

    const pairs = collectSegmentPairsWithSimpleIds(
      segments,
      5,
      true,
      mapping,
      context.getSimpleId,
      skipPairKeys,
    );

    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.segmentA.id).toBe("seg-2");
    expect(pairs[0]?.segmentB.id).toBe("seg-3");
    expect(mapping.pairToIds.get(1)).toEqual(["seg-2", "seg-3"]);
  });

  it("drops suggestion when returned text is too different", () => {
    const raw = {
      segmentIds: ["seg-1", "seg-2"],
      confidence: 0.9,
      smoothedText: "Completely different output",
    } as Record<string, unknown>;

    const map = new Map([
      ["seg-1", segA],
      ["seg-2", segB],
    ]);
    const sug = processSuggestion(
      raw as Record<string, unknown>,
      map as Map<string, MergeAnalysisSegment>,
    );

    expect(sug).toBeNull();
  });

  it("normalizeRawSuggestion wrapper handles RawAIItem shapes", () => {
    // create mapping using core helper
    const pairMap = createBatchPairMapping(
      [{ id: "seg-1" }, { id: "seg-2" }],
      (s: { id: string }) => s.id,
    );
    pairMap.pairToIds.set(1, ["seg-1", "seg-2"]);

    const raw = { pairIndex: 1, confidence: 0.4, smoothedText: "merged" } as Record<
      string,
      unknown
    >;
    const normalized = normalizeRawSuggestion(raw, pairMap);
    expect(normalized).not.toBeNull();
    expect(normalized?.segmentIds).toEqual(["seg-1", "seg-2"]);
    expect(normalized?.smoothedText).toBe("merged");
  });

  describe("isSameSpeaker", () => {
    it("returns true for same speaker", () => {
      expect(isSameSpeaker({ speaker: "Alice" }, { speaker: "Alice" })).toBe(true);
    });

    it("returns false for different speakers", () => {
      expect(isSameSpeaker({ speaker: "Alice" }, { speaker: "Bob" })).toBe(false);
    });

    it("is case-sensitive", () => {
      expect(isSameSpeaker({ speaker: "Alice" }, { speaker: "alice" })).toBe(false);
    });
  });

  describe("collectSegmentPairsWithSimpleIds", () => {
    const createSegment = (
      id: string,
      speaker: string,
      start: number,
      end: number,
      text: string,
    ): MergeAnalysisSegment => ({
      id,
      speaker,
      start,
      end,
      text,
    });

    it("collects pairs with same speaker when sameSpeakerOnly is true", () => {
      const segments = [
        createSegment("1", "Alice", 0, 1, "Hello"),
        createSegment("2", "Alice", 1.1, 2, "world"),
        createSegment("3", "Bob", 2.1, 3, "Hi"),
        createSegment("4", "Alice", 3.1, 4, "there"),
      ];

      const idContext = createSimpleIdContext(segments);
      const pairs = collectSegmentPairsWithSimpleIds(
        segments,
        1.0, // maxTimeGap
        true, // sameSpeakerOnly
        idContext.mapping,
        idContext.getSimpleId,
      );

      // Should only collect Alice-Alice pairs (1-2), not Alice-Bob (2-3) or Bob-Alice (3-4)
      expect(pairs).toHaveLength(1);
      expect(pairs[0].segmentA.speaker).toBe("Alice");
      expect(pairs[0].segmentB.speaker).toBe("Alice");
      expect(pairs[0].segmentA.id).toBe("1");
      expect(pairs[0].segmentB.id).toBe("2");
    });

    it("collects all pairs when sameSpeakerOnly is false", () => {
      const segments = [
        createSegment("1", "Alice", 0, 1, "Hello"),
        createSegment("2", "Bob", 1.1, 2, "Hi"),
        createSegment("3", "Alice", 2.1, 3, "there"),
      ];

      const idContext = createSimpleIdContext(segments);
      const pairs = collectSegmentPairsWithSimpleIds(
        segments,
        1.0, // maxTimeGap
        false, // sameSpeakerOnly
        idContext.mapping,
        idContext.getSimpleId,
      );

      // Should collect all adjacent pairs regardless of speaker
      expect(pairs).toHaveLength(2);
      expect(pairs[0].segmentA.id).toBe("1");
      expect(pairs[0].segmentB.id).toBe("2");
      expect(pairs[1].segmentA.id).toBe("2");
      expect(pairs[1].segmentB.id).toBe("3");
    });

    it("filters pairs by time gap", () => {
      const segments = [
        createSegment("1", "Alice", 0, 1, "Hello"),
        createSegment("2", "Alice", 1.1, 2, "world"), // gap: 0.1s
        createSegment("3", "Alice", 5, 6, "there"), // gap: 3s
      ];

      const idContext = createSimpleIdContext(segments);
      const pairs = collectSegmentPairsWithSimpleIds(
        segments,
        0.5, // maxTimeGap
        true, // sameSpeakerOnly
        idContext.mapping,
        idContext.getSimpleId,
      );

      // Should only collect pair 1-2 (gap 0.1s), not 2-3 (gap 3s)
      expect(pairs).toHaveLength(1);
      expect(pairs[0].segmentA.id).toBe("1");
      expect(pairs[0].segmentB.id).toBe("2");
    });

    it("combines speaker and gap filtering", () => {
      const segments = [
        createSegment("1", "Alice", 0, 1, "Hello"),
        createSegment("2", "Alice", 1.1, 2, "world"), // same speaker, small gap ✓
        createSegment("3", "Bob", 2.1, 3, "Hi"), // different speaker ✗
        createSegment("4", "Bob", 6, 7, "there"), // same speaker, large gap ✗
      ];

      const idContext = createSimpleIdContext(segments);
      const pairs = collectSegmentPairsWithSimpleIds(
        segments,
        0.5, // maxTimeGap
        true, // sameSpeakerOnly
        idContext.mapping,
        idContext.getSimpleId,
      );

      // Should only collect pair 1-2 (same speaker + small gap)
      expect(pairs).toHaveLength(1);
      expect(pairs[0].segmentA.id).toBe("1");
      expect(pairs[0].segmentB.id).toBe("2");
    });

    it("assigns correct simple IDs", () => {
      const segments = [
        createSegment("seg-100", "Alice", 0, 1, "Hello"),
        createSegment("seg-200", "Alice", 1.1, 2, "world"),
      ];

      const idContext = createSimpleIdContext(segments);
      const pairs = collectSegmentPairsWithSimpleIds(
        segments,
        1.0,
        true,
        idContext.mapping,
        idContext.getSimpleId,
      );

      expect(pairs).toHaveLength(1);
      expect(pairs[0].simpleIdA).toBe(1);
      expect(pairs[0].simpleIdB).toBe(2);
    });

    it("populates pair mapping correctly", () => {
      const segments = [
        createSegment("seg-1", "Alice", 0, 1, "Hello"),
        createSegment("seg-2", "Alice", 1.1, 2, "world"),
      ];

      const idContext = createSimpleIdContext(segments);
      const pairs = collectSegmentPairsWithSimpleIds(
        segments,
        1.0,
        true,
        idContext.mapping,
        idContext.getSimpleId,
      );

      expect(pairs).toHaveLength(1);
      expect(idContext.mapping.pairToIds.get(1)).toEqual(["seg-1", "seg-2"]);
    });

    it("returns empty array when no pairs match criteria", () => {
      const segments = [
        createSegment("1", "Alice", 0, 1, "Hello"),
        createSegment("2", "Bob", 10, 11, "world"), // different speaker + large gap
      ];

      const idContext = createSimpleIdContext(segments);
      const pairs = collectSegmentPairsWithSimpleIds(
        segments,
        1.0,
        true,
        idContext.mapping,
        idContext.getSimpleId,
      );

      expect(pairs).toHaveLength(0);
    });
  });

  describe("createSegmentBatches", () => {
    const makeSegment = (id: string, speaker: string): MergeAnalysisSegment => ({
      id,
      speaker,
      start: Number(id),
      end: Number(id) + 0.5,
      text: `${speaker}-${id}`,
    });

    it("chunks purely by size when filtering is disabled", () => {
      const segments = [
        makeSegment("1", "Alice"),
        makeSegment("2", "Bob"),
        makeSegment("3", "Eve"),
      ];
      const batches = createSegmentBatches(segments, 2, false);

      expect(batches).toHaveLength(2);
      expect(batches[0].map((s) => s.id)).toEqual(["1", "2"]);
      expect(batches[1].map((s) => s.id)).toEqual(["3"]);
    });

    it("splits batches at speaker boundaries when filtering is enabled", () => {
      const segments = [
        makeSegment("1", "Alice"),
        makeSegment("2", "Alice"),
        makeSegment("3", "Bob"),
        makeSegment("4", "Bob"),
        makeSegment("5", "Alice"),
      ];

      const batches = createSegmentBatches(segments, 5, true);
      expect(batches).toHaveLength(3);
      expect(new Set(batches[0].map((s) => s.speaker))).toEqual(new Set(["Alice"]));
      expect(new Set(batches[1].map((s) => s.speaker))).toEqual(new Set(["Bob"]));
      expect(new Set(batches[2].map((s) => s.speaker))).toEqual(new Set(["Alice"]));
    });

    it("still respects batch size limits within a single speaker run", () => {
      const segments = [
        makeSegment("1", "Alice"),
        makeSegment("2", "Alice"),
        makeSegment("3", "Alice"),
        makeSegment("4", "Alice"),
      ];

      const batches = createSegmentBatches(segments, 2, true);
      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(2);
      expect(batches[1]).toHaveLength(2);
    });
  });
});
