import { describe, expect, it } from "vitest";
import { createBatchPairMapping } from "@/lib/ai/core";
import type { MergeAnalysisSegment } from "../types";
import {
  applyBasicSmoothing,
  calculateTimeGap,
  concatenateTexts,
  createSmoothingInfo,
  detectIncorrectSentenceBreak,
  endsWithSentencePunctuation,
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
});
