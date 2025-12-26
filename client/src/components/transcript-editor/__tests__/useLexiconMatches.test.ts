import { describe, expect, it } from "vitest";
import type { Segment } from "@/lib/store";
import { computeLexiconMatches } from "../useLexiconMatches";

describe("computeLexiconMatches", () => {
  const baseSegment: Segment = {
    id: "segment-1",
    speaker: "SPEAKER_00",
    start: 0,
    end: 1,
    text: "placeholder",
    words: [],
  };

  it("matches hyphenated words and tracks the part index", () => {
    const segments: Segment[] = [
      {
        ...baseSegment,
        words: [{ word: "well-known", start: 0, end: 1 }],
      },
    ];

    const { lexiconMatchesBySegment } = computeLexiconMatches({
      segments,
      lexiconEntries: [{ term: "known", variants: [], falsePositives: [] }],
      lexiconThreshold: 0.8,
    });

    const match = lexiconMatchesBySegment.get("segment-1")?.get(0);
    expect(match?.term).toBe("known");
    expect(match?.partIndex).toBe(1);
  });

  it("ignores false positives even when the similarity is above the threshold", () => {
    const segments: Segment[] = [
      {
        ...baseSegment,
        id: "segment-2",
        words: [{ word: "reed", start: 0, end: 1 }],
      },
    ];

    const { lexiconMatchesBySegment, hasLexiconEntries } = computeLexiconMatches({
      segments,
      lexiconEntries: [{ term: "read", variants: [], falsePositives: ["reed"] }],
      lexiconThreshold: 0.75,
    });

    expect(hasLexiconEntries).toBe(true);
    expect(lexiconMatchesBySegment.size).toBe(0);
  });

  it("counts low-score matches at the threshold boundary", () => {
    const segments: Segment[] = [
      {
        ...baseSegment,
        id: "segment-3",
        words: [{ word: "hallo", start: 0, end: 1 }],
      },
    ];

    const { lexiconLowScoreMatchCount, lexiconMatchCount } = computeLexiconMatches({
      segments,
      lexiconEntries: [{ term: "hallow", variants: [], falsePositives: [] }],
      lexiconThreshold: 0.83,
    });

    expect(lexiconMatchCount).toBe(1);
    expect(lexiconLowScoreMatchCount).toBe(1);
  });

  it("returns empty results when there are no lexicon entries", () => {
    const segments: Segment[] = [
      {
        ...baseSegment,
        id: "segment-4",
        words: [{ word: "anything", start: 0, end: 1 }],
      },
    ];

    const result = computeLexiconMatches({
      segments,
      lexiconEntries: [],
      lexiconThreshold: 0.8,
    });

    expect(result.hasLexiconEntries).toBe(false);
    expect(result.lexiconMatchesBySegment.size).toBe(0);
    expect(result.lexiconMatchCount).toBe(0);
    expect(result.lexiconLowScoreMatchCount).toBe(0);
  });
});
