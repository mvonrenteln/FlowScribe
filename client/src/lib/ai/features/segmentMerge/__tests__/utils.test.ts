/**
 * Segment Merge Utils Tests
 *
 * Comprehensive tests for pure utility functions.
 * These functions have no external dependencies and are easily testable.
 */

import { describe, expect, it } from "vitest";
import type { MergeAnalysisSegment, MergeSuggestion, RawMergeSuggestion } from "../types";
import {
  applyBasicSmoothing,
  calculateTimeGap,
  concatenateTexts,
  countByConfidence,
  createSmoothingInfo,
  detectIncorrectSentenceBreak,
  endsIncomplete,
  endsWithSentencePunctuation,
  filterByStatus,
  formatSegmentPairsForPrompt,
  formatSegmentsForPrompt,
  formatTime,
  formatTimeRange,
  groupByConfidence,
  isSameSpeaker,
  isTimeGapAcceptable,
  meetsConfidenceThreshold,
  processSuggestion,
  processSuggestions,
  scoreToConfidenceLevel,
  startsWithCapital,
  validateMergeCandidate,
} from "../utils";

// ==================== Test Fixtures ====================

const createSegment = (
  id: string,
  text: string,
  speaker = "Speaker1",
  start = 0,
  end = 1,
): MergeAnalysisSegment => ({
  id,
  text,
  speaker,
  start,
  end,
});

const createSuggestion = (
  id: string,
  confidence: "high" | "medium" | "low",
  status: "pending" | "accepted" | "rejected" = "pending",
): MergeSuggestion => ({
  id,
  segmentIds: ["seg1", "seg2"],
  confidence,
  confidenceScore: confidence === "high" ? 0.9 : confidence === "medium" ? 0.6 : 0.3,
  reason: "Test reason",
  status,
  mergedText: "Merged text",
  timeRange: { start: 0, end: 2 },
  speaker: "Speaker1",
  timeGap: 0.5,
});

// ==================== Time & Gap Calculations ====================

describe("calculateTimeGap", () => {
  it("calculates positive gap between segments", () => {
    const seg1 = { end: 10.5 };
    const seg2 = { start: 11.2 };
    expect(calculateTimeGap(seg1, seg2)).toBeCloseTo(0.7, 5);
  });

  it("returns zero for adjacent segments", () => {
    const seg1 = { end: 10.0 };
    const seg2 = { start: 10.0 };
    expect(calculateTimeGap(seg1, seg2)).toBe(0);
  });

  it("returns negative gap for overlapping segments", () => {
    const seg1 = { end: 11.0 };
    const seg2 = { start: 10.5 };
    expect(calculateTimeGap(seg1, seg2)).toBeCloseTo(-0.5, 5);
  });
});

describe("isTimeGapAcceptable", () => {
  it("accepts gap within threshold", () => {
    expect(isTimeGapAcceptable(1.5, 2.0)).toBe(true);
  });

  it("accepts gap exactly at threshold", () => {
    expect(isTimeGapAcceptable(2.0, 2.0)).toBe(true);
  });

  it("rejects gap exceeding threshold", () => {
    expect(isTimeGapAcceptable(2.5, 2.0)).toBe(false);
  });

  it("accepts zero gap", () => {
    expect(isTimeGapAcceptable(0, 2.0)).toBe(true);
  });

  it("rejects negative gap (overlapping)", () => {
    expect(isTimeGapAcceptable(-0.5, 2.0)).toBe(false);
  });
});

describe("formatTime", () => {
  it("formats zero seconds", () => {
    expect(formatTime(0)).toBe("00:00.0");
  });

  it("formats seconds under a minute", () => {
    expect(formatTime(45.5)).toBe("00:45.5");
  });

  it("formats exactly one minute", () => {
    expect(formatTime(60)).toBe("01:00.0");
  });

  it("formats minutes and seconds", () => {
    expect(formatTime(125.7)).toBe("02:05.7");
  });

  it("formats large values", () => {
    expect(formatTime(3661.2)).toBe("61:01.2");
  });

  it("pads single-digit values", () => {
    expect(formatTime(5.3)).toBe("00:05.3");
  });
});

describe("formatTimeRange", () => {
  it("formats a time range", () => {
    expect(formatTimeRange(10.5, 25.3)).toBe("00:10.5 - 00:25.3");
  });

  it("formats zero range", () => {
    expect(formatTimeRange(0, 0)).toBe("00:00.0 - 00:00.0");
  });
});

// ==================== Speaker Comparison ====================

describe("isSameSpeaker", () => {
  it("returns true for same speaker", () => {
    expect(isSameSpeaker({ speaker: "Alice" }, { speaker: "Alice" })).toBe(true);
  });

  it("returns false for different speakers", () => {
    expect(isSameSpeaker({ speaker: "Alice" }, { speaker: "Bob" })).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isSameSpeaker({ speaker: "alice" }, { speaker: "Alice" })).toBe(false);
  });

  it("handles special characters", () => {
    expect(isSameSpeaker({ speaker: "[SL]" }, { speaker: "[SL]" })).toBe(true);
  });
});

// ==================== Sentence Analysis ====================

describe("endsWithSentencePunctuation", () => {
  it("detects period", () => {
    expect(endsWithSentencePunctuation("Hello world.")).toBe(true);
  });

  it("detects question mark", () => {
    expect(endsWithSentencePunctuation("How are you?")).toBe(true);
  });

  it("detects exclamation mark", () => {
    expect(endsWithSentencePunctuation("Stop right there!")).toBe(true);
  });

  it("returns false for comma", () => {
    expect(endsWithSentencePunctuation("Hello,")).toBe(false);
  });

  it("returns false for no punctuation", () => {
    expect(endsWithSentencePunctuation("Hello world")).toBe(false);
  });

  it("handles trailing whitespace", () => {
    expect(endsWithSentencePunctuation("Hello.  ")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(endsWithSentencePunctuation("")).toBe(false);
  });
});

describe("startsWithCapital", () => {
  it("detects capital A-Z", () => {
    expect(startsWithCapital("Hello")).toBe(true);
  });

  it("returns false for lowercase", () => {
    expect(startsWithCapital("hello")).toBe(false);
  });

  it("detects German umlauts", () => {
    expect(startsWithCapital("Über")).toBe(true);
    expect(startsWithCapital("Änderung")).toBe(true);
    expect(startsWithCapital("Öffnung")).toBe(true);
  });

  it("handles leading whitespace", () => {
    expect(startsWithCapital("  Hello")).toBe(true);
  });

  it("returns false for numbers", () => {
    expect(startsWithCapital("123")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(startsWithCapital("")).toBe(false);
  });
});

describe("endsIncomplete", () => {
  it("detects trailing conjunction 'and'", () => {
    expect(endsIncomplete("I went to the store and")).toBe(true);
  });

  it("detects trailing conjunction 'but'", () => {
    expect(endsIncomplete("I wanted to go but")).toBe(true);
  });

  it("detects trailing articles", () => {
    expect(endsIncomplete("I saw the")).toBe(true);
    expect(endsIncomplete("It was a")).toBe(true);
  });

  it("detects trailing comma", () => {
    expect(endsIncomplete("First of all,")).toBe(true);
  });

  it("detects trailing hyphen", () => {
    expect(endsIncomplete("This is a well-")).toBe(true);
  });

  it("detects ellipsis", () => {
    expect(endsIncomplete("And then...")).toBe(true);
  });

  it("returns false for complete sentences", () => {
    expect(endsIncomplete("This is a complete sentence")).toBe(false);
  });

  it("returns false for sentence with period", () => {
    // Note: period is not an incomplete marker
    expect(endsIncomplete("Hello.")).toBe(false);
  });
});

describe("detectIncorrectSentenceBreak", () => {
  it("detects mid-sentence break with period + capital", () => {
    const seg1 = { text: "So what we're trying to." };
    const seg2 = { text: "Achieve here is better" };
    expect(detectIncorrectSentenceBreak(seg1, seg2)).toBe(true);
  });

  it("detects missing punctuation", () => {
    const seg1 = { text: "I want to" };
    const seg2 = { text: "go home" };
    expect(detectIncorrectSentenceBreak(seg1, seg2)).toBe(true);
  });

  it("returns false for proper sentence break", () => {
    const seg1 = { text: "This is a complete sentence." };
    const seg2 = { text: "This is another one." };
    expect(detectIncorrectSentenceBreak(seg1, seg2)).toBe(false);
  });

  it("returns false for comma continuation", () => {
    const seg1 = { text: "First," };
    const seg2 = { text: "second thing." };
    expect(detectIncorrectSentenceBreak(seg1, seg2)).toBe(false);
  });

  it("detects common lowercase words after period", () => {
    const commonWords = ["because", "and", "but", "so", "which", "that"];
    for (const word of commonWords) {
      const seg1 = { text: "Something." };
      const seg2 = { text: `${word.charAt(0).toUpperCase()}${word.slice(1)} more text` };
      expect(detectIncorrectSentenceBreak(seg1, seg2)).toBe(true);
    }
  });
});

// ==================== Merge Text Operations ====================

describe("concatenateTexts", () => {
  it("joins segment texts with space", () => {
    const segments = [{ text: "Hello" }, { text: "world" }];
    expect(concatenateTexts(segments)).toBe("Hello world");
  });

  it("uses custom separator", () => {
    const segments = [{ text: "Hello" }, { text: "world" }];
    expect(concatenateTexts(segments, " | ")).toBe("Hello | world");
  });

  it("trims whitespace from segments", () => {
    const segments = [{ text: "  Hello  " }, { text: "  world  " }];
    expect(concatenateTexts(segments)).toBe("Hello world");
  });

  it("handles empty segments", () => {
    const segments = [{ text: "" }, { text: "world" }];
    expect(concatenateTexts(segments)).toBe(" world");
  });

  it("handles single segment", () => {
    const segments = [{ text: "Hello" }];
    expect(concatenateTexts(segments)).toBe("Hello");
  });

  it("handles multiple segments", () => {
    const segments = [{ text: "One" }, { text: "Two" }, { text: "Three" }];
    expect(concatenateTexts(segments)).toBe("One Two Three");
  });
});

describe("applyBasicSmoothing", () => {
  it("removes double spaces", () => {
    expect(applyBasicSmoothing("Hello  world")).toBe("Hello world");
  });

  it("removes multiple spaces", () => {
    expect(applyBasicSmoothing("Hello    world")).toBe("Hello world");
  });

  it("fixes space before punctuation", () => {
    expect(applyBasicSmoothing("Hello .")).toBe("Hello.");
    expect(applyBasicSmoothing("What ?")).toBe("What?");
    expect(applyBasicSmoothing("Stop !")).toBe("Stop!");
  });

  it("fixes double punctuation", () => {
    expect(applyBasicSmoothing("Hello..")).toBe("Hello.");
    expect(applyBasicSmoothing("What??")).toBe("What?");
  });

  it("trims leading/trailing whitespace", () => {
    expect(applyBasicSmoothing("  Hello world  ")).toBe("Hello world");
  });

  it("handles already clean text", () => {
    expect(applyBasicSmoothing("Hello world.")).toBe("Hello world.");
  });

  it("handles newlines as spaces", () => {
    expect(applyBasicSmoothing("Hello\nworld")).toBe("Hello world");
  });
});

describe("createSmoothingInfo", () => {
  it("returns undefined if no smoothed text", () => {
    expect(createSmoothingInfo("original", undefined, undefined)).toBeUndefined();
  });

  it("returns undefined if smoothed equals original", () => {
    expect(createSmoothingInfo("same text", "same text", undefined)).toBeUndefined();
  });

  it("creates smoothing info when text changed", () => {
    const result = createSmoothingInfo("original. Text", "original text", "Fixed casing");
    expect(result).toEqual({
      applied: true,
      originalConcatenated: "original. Text",
      smoothedText: "original text",
      changes: "Fixed casing",
    });
  });

  it("uses default changes description", () => {
    const result = createSmoothingInfo("original", "smoothed", undefined);
    expect(result?.changes).toBe("Text was smoothed");
  });
});

// ==================== Confidence Calculation ====================

describe("scoreToConfidenceLevel", () => {
  it("returns high for >= 0.8", () => {
    expect(scoreToConfidenceLevel(0.8)).toBe("high");
    expect(scoreToConfidenceLevel(0.9)).toBe("high");
    expect(scoreToConfidenceLevel(1.0)).toBe("high");
  });

  it("returns medium for >= 0.5 and < 0.8", () => {
    expect(scoreToConfidenceLevel(0.5)).toBe("medium");
    expect(scoreToConfidenceLevel(0.6)).toBe("medium");
    expect(scoreToConfidenceLevel(0.79)).toBe("medium");
  });

  it("returns low for < 0.5", () => {
    expect(scoreToConfidenceLevel(0.0)).toBe("low");
    expect(scoreToConfidenceLevel(0.3)).toBe("low");
    expect(scoreToConfidenceLevel(0.49)).toBe("low");
  });
});

describe("meetsConfidenceThreshold", () => {
  it("high meets all thresholds", () => {
    expect(meetsConfidenceThreshold("high", "low")).toBe(true);
    expect(meetsConfidenceThreshold("high", "medium")).toBe(true);
    expect(meetsConfidenceThreshold("high", "high")).toBe(true);
  });

  it("medium meets low and medium thresholds", () => {
    expect(meetsConfidenceThreshold("medium", "low")).toBe(true);
    expect(meetsConfidenceThreshold("medium", "medium")).toBe(true);
    expect(meetsConfidenceThreshold("medium", "high")).toBe(false);
  });

  it("low only meets low threshold", () => {
    expect(meetsConfidenceThreshold("low", "low")).toBe(true);
    expect(meetsConfidenceThreshold("low", "medium")).toBe(false);
    expect(meetsConfidenceThreshold("low", "high")).toBe(false);
  });
});

// ==================== Prompt Formatting ====================

describe("formatSegmentsForPrompt", () => {
  it("formats single segment", () => {
    const segments = [createSegment("seg1", "Hello world", "Alice", 10.5, 12.3)];
    const result = formatSegmentsForPrompt(segments);
    expect(result).toBe('[seg1] [Alice] (00:10.5 - 00:12.3): "Hello world"');
  });

  it("formats multiple segments", () => {
    const segments = [
      createSegment("seg1", "Hello", "Alice", 0, 1),
      createSegment("seg2", "World", "Bob", 1.5, 2.5),
    ];
    const result = formatSegmentsForPrompt(segments);
    expect(result).toContain("[seg1] [Alice]");
    expect(result).toContain("[seg2] [Bob]");
    expect(result.split("\n")).toHaveLength(2);
  });
});

describe("formatSegmentPairsForPrompt", () => {
  it("formats valid pairs", () => {
    const segments = [
      createSegment("seg1", "Hello", "Alice", 0, 1),
      createSegment("seg2", "World", "Alice", 1.5, 2.5),
    ];
    const result = formatSegmentPairsForPrompt(segments, 2.0, true);
    expect(result).toContain("--- Pair 1 ---");
    expect(result).toContain("Segment A [seg1]");
    expect(result).toContain("Segment B [seg2]");
    expect(result).toContain("Gap: 0.50s");
  });

  it("excludes different speakers when sameSpeakerOnly", () => {
    const segments = [
      createSegment("seg1", "Hello", "Alice", 0, 1),
      createSegment("seg2", "World", "Bob", 1.5, 2.5),
    ];
    const result = formatSegmentPairsForPrompt(segments, 2.0, true);
    expect(result).toBe("");
  });

  it("includes different speakers when not sameSpeakerOnly", () => {
    const segments = [
      createSegment("seg1", "Hello", "Alice", 0, 1),
      createSegment("seg2", "World", "Bob", 1.5, 2.5),
    ];
    const result = formatSegmentPairsForPrompt(segments, 2.0, false);
    expect(result).toContain("--- Pair 1 ---");
  });

  it("excludes pairs with large time gap", () => {
    const segments = [
      createSegment("seg1", "Hello", "Alice", 0, 1),
      createSegment("seg2", "World", "Alice", 5, 6),
    ];
    const result = formatSegmentPairsForPrompt(segments, 2.0, true);
    expect(result).toBe("");
  });

  it("returns empty for single segment", () => {
    const segments = [createSegment("seg1", "Hello", "Alice", 0, 1)];
    const result = formatSegmentPairsForPrompt(segments, 2.0, true);
    expect(result).toBe("");
  });
});

// ==================== Suggestion Processing ====================

describe("processSuggestion", () => {
  const segments = [
    createSegment("seg1", "Hello", "Alice", 0, 1),
    createSegment("seg2", "World", "Alice", 1.5, 2.5),
    createSegment("seg3", "Test", "Alice", 3, 4),
  ];
  const segmentMap = new Map(segments.map((s) => [s.id, s]));

  it("creates suggestion from valid raw data", () => {
    const raw: RawMergeSuggestion = {
      segmentIds: ["seg1", "seg2"],
      confidence: 0.9,
      reason: "Test reason",
    };
    const result = processSuggestion(raw, segmentMap);

    expect(result).not.toBeNull();
    expect(result?.segmentIds).toEqual(["seg1", "seg2"]);
    expect(result?.confidence).toBe("high");
    expect(result?.confidenceScore).toBe(0.9);
    expect(result?.reason).toBe("Test reason");
    expect(result?.status).toBe("pending");
    expect(result?.mergedText).toBe("Hello World");
    expect(result?.speaker).toBe("Alice");
  });

  it("returns null for invalid segment IDs", () => {
    const raw: RawMergeSuggestion = {
      segmentIds: ["invalid1", "invalid2"],
      confidence: 0.9,
    };
    const result = processSuggestion(raw, segmentMap);
    expect(result).toBeNull();
  });

  it("returns null for single segment", () => {
    const raw: RawMergeSuggestion = {
      segmentIds: ["seg1"],
      confidence: 0.9,
    };
    const result = processSuggestion(raw, segmentMap);
    expect(result).toBeNull();
  });

  it("includes smoothing info when provided", () => {
    const raw: RawMergeSuggestion = {
      segmentIds: ["seg1", "seg2"],
      confidence: 0.9,
      smoothedText: "Hello world",
      smoothingChanges: "Fixed capitalization",
    };
    const result = processSuggestion(raw, segmentMap);

    expect(result?.smoothing).toBeDefined();
    expect(result?.smoothing?.smoothedText).toBe("Hello world");
    expect(result?.smoothing?.changes).toBe("Fixed capitalization");
  });

  it("calculates correct time range", () => {
    const raw: RawMergeSuggestion = {
      segmentIds: ["seg1", "seg3"],
      confidence: 0.9,
    };
    const result = processSuggestion(raw, segmentMap);

    expect(result?.timeRange.start).toBe(0);
    expect(result?.timeRange.end).toBe(4);
  });

  it("uses default values for missing fields", () => {
    const raw: RawMergeSuggestion = {
      segmentIds: ["seg1", "seg2"],
      confidence: 0.5, // Required field
    };
    const result = processSuggestion(raw, segmentMap);

    expect(result?.confidenceScore).toBe(0.5);
    expect(result?.reason).toBe("Segments appear to belong together");
  });
});

describe("processSuggestions", () => {
  const segments = [
    createSegment("seg1", "Hello", "Alice", 0, 1),
    createSegment("seg2", "World", "Alice", 1.5, 2.5),
  ];

  it("processes array of raw suggestions", () => {
    const rawSuggestions: RawMergeSuggestion[] = [
      { segmentIds: ["seg1", "seg2"], confidence: 0.9 },
    ];
    const result = processSuggestions(rawSuggestions, segments);
    expect(result).toHaveLength(1);
  });

  it("filters out invalid suggestions", () => {
    const rawSuggestions: RawMergeSuggestion[] = [
      { segmentIds: ["seg1", "seg2"], confidence: 0.9 },
      { segmentIds: ["invalid1", "invalid2"], confidence: 0.9 },
    ];
    const result = processSuggestions(rawSuggestions, segments);
    expect(result).toHaveLength(1);
  });

  it("filters by minimum confidence", () => {
    const rawSuggestions: RawMergeSuggestion[] = [
      { segmentIds: ["seg1", "seg2"], confidence: 0.9 },
      { segmentIds: ["seg1", "seg2"], confidence: 0.3 },
    ];
    const result = processSuggestions(rawSuggestions, segments, "medium");
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe("high");
  });

  it("returns empty array for empty input", () => {
    const result = processSuggestions([], segments);
    expect(result).toEqual([]);
  });
});

// ==================== Grouping & Filtering ====================

describe("groupByConfidence", () => {
  it("groups suggestions correctly", () => {
    const suggestions = [
      createSuggestion("s1", "high"),
      createSuggestion("s2", "medium"),
      createSuggestion("s3", "low"),
      createSuggestion("s4", "high"),
    ];
    const result = groupByConfidence(suggestions);

    expect(result.high).toHaveLength(2);
    expect(result.medium).toHaveLength(1);
    expect(result.low).toHaveLength(1);
  });

  it("handles empty array", () => {
    const result = groupByConfidence([]);
    expect(result.high).toEqual([]);
    expect(result.medium).toEqual([]);
    expect(result.low).toEqual([]);
  });
});

describe("filterByStatus", () => {
  it("filters pending suggestions", () => {
    const suggestions = [
      createSuggestion("s1", "high", "pending"),
      createSuggestion("s2", "high", "accepted"),
      createSuggestion("s3", "high", "rejected"),
    ];
    const result = filterByStatus(suggestions, "pending");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s1");
  });

  it("filters accepted suggestions", () => {
    const suggestions = [
      createSuggestion("s1", "high", "pending"),
      createSuggestion("s2", "high", "accepted"),
    ];
    const result = filterByStatus(suggestions, "accepted");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s2");
  });
});

describe("countByConfidence", () => {
  it("counts suggestions by confidence", () => {
    const suggestions = [
      createSuggestion("s1", "high"),
      createSuggestion("s2", "high"),
      createSuggestion("s3", "medium"),
      createSuggestion("s4", "low"),
    ];
    const result = countByConfidence(suggestions);

    expect(result.high).toBe(2);
    expect(result.medium).toBe(1);
    expect(result.low).toBe(1);
  });

  it("returns zeros for empty array", () => {
    const result = countByConfidence([]);
    expect(result).toEqual({ high: 0, medium: 0, low: 0 });
  });
});

// ==================== Validation ====================

describe("validateMergeCandidate", () => {
  const segments = [
    createSegment("seg1", "Hello", "Alice", 0, 1),
    createSegment("seg2", "World", "Alice", 1.5, 2.5),
    createSegment("seg3", "Test", "Bob", 3, 4),
  ];

  it("validates valid consecutive same-speaker segments", () => {
    const result = validateMergeCandidate(["seg1", "seg2"], segments);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects single segment", () => {
    const result = validateMergeCandidate(["seg1"], segments);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("At least 2 segments required for merge");
  });

  it("rejects empty array", () => {
    const result = validateMergeCandidate([], segments);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("At least 2 segments required for merge");
  });

  it("rejects non-existent segment", () => {
    const result = validateMergeCandidate(["seg1", "invalid"], segments);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Segment invalid not found");
  });

  it("rejects non-consecutive segments", () => {
    const result = validateMergeCandidate(["seg1", "seg3"], segments);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Segments must be consecutive");
  });

  it("rejects different speakers", () => {
    const result = validateMergeCandidate(["seg2", "seg3"], segments);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Segments must have the same speaker");
  });
});
