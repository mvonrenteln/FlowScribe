import { describe, expect, it } from "vitest";
import { createBatchPairMapping } from "../../../core/batchIdMapping";
import type { MergeAnalysisSegment } from "../types";
import {
  applyBasicSmoothing,
  calculateTimeGap,
  collectSegmentPairsWithSimpleIds,
  concatenateTexts,
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
  } as any;
  const segB: MergeAnalysisSegment = {
    id: "seg-2",
    speaker: "A",
    start: 1.3,
    end: 2.5,
    text: "and welcome",
  } as any;

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
    } as any;

    const map = new Map([
      ["seg-1", segA],
      ["seg-2", segB],
    ]);
    const sug = processSuggestion(raw as any, map as any);
    expect(sug).not.toBeNull();
    expect(sug?.mergedText).toContain("Hello world");
    // Since smoothedText equals the concatenated original text, smoothing is considered not applied
    expect(sug?.smoothing).toBeUndefined();
  });

  it("normalizeRawSuggestion wrapper handles RawAIItem shapes", () => {
    // create mapping using core helper
    const pairMap = createBatchPairMapping([{ id: "seg-1" }, { id: "seg-2" }], (s: any) => s.id);
    pairMap.pairToIds.set(1, ["seg-1", "seg-2"]);

    const raw: any = { pairIndex: 1, confidence: 0.4, smoothedText: "merged" };
    const normalized = normalizeRawSuggestion(raw, pairMap as any);
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
});
