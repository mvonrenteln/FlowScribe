import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as fuzzy from "@/lib/fuzzy";
import type { Segment } from "@/lib/store";
import { computeLexiconMatches, useLexiconMatches } from "../useLexiconMatches";

describe("computeLexiconMatches", () => {
  const baseSegment: Segment = {
    id: "segment-1",
    speaker: "SPEAKER_00",
    tags: [],
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

  it("matches the full variant list in a long transcript paragraph", () => {
    const variantList = [
      "Klimmer",
      "Klümmer",
      "Klimba",
      "Plimber",
      "Glimber",
      "Dürmer",
      "Dumba",
      "Glumberg",
      "Glühmann",
      "Klümpa",
      "Blümmer",
      "Klüpper",
      "Klümper",
      "Klümba",
      "Glimbar",
      "Glimmer",
      "Klimper",
      "Glümpar",
      "Glümper",
      "Glümmer",
      "Glimba",
      "Glimbach",
      "Lümba",
      "Lümmer",
      "Limba",
    ];

    const longTextWords = [
      "During",
      "the",
      "interview",
      "we",
      "collected",
      "many",
      "possible",
      "renderings",
      "for",
      "the",
      "same",
      "name",
      "and",
      "we",
      "need",
      "the",
      "uncertain",
      "glossary",
      "filter",
      "to",
      "surface",
      "all",
      "of",
      "them",
      "without",
      "missing",
      "any",
      "variant",
      "in",
      "this",
      "long",
      "sample",
      "paragraph",
      ...variantList,
      "while",
      "the",
      "speaker",
      "continues",
      "with",
      "additional",
      "context",
      "for",
      "quality",
      "assurance",
      "checks",
    ];

    const words = longTextWords.map((word, index) => ({
      word,
      start: index,
      end: index + 1,
    }));

    const segments: Segment[] = [
      {
        ...baseSegment,
        id: "segment-long-variants",
        text: longTextWords.join(" "),
        words,
      },
    ];

    const result = computeLexiconMatches({
      segments,
      lexiconEntries: [{ term: "Glymbar", variants: variantList, falsePositives: [] }],
      lexiconThreshold: 0.82,
    });

    const matches = result.lexiconMatchesBySegment.get("segment-long-variants");
    expect(matches).toBeDefined();

    const firstVariantIndex = longTextWords.indexOf(variantList[0]);
    const lastVariantIndex = longTextWords.indexOf(variantList[variantList.length - 1]);
    expect(firstVariantIndex).toBeGreaterThan(0);
    expect(lastVariantIndex).toBeGreaterThan(firstVariantIndex);

    const matchedVariantWords = new Set(
      Array.from(matches?.entries() ?? [])
        .filter(([index, match]) => index >= firstVariantIndex && match.term === "Glymbar")
        .map(([index]) => longTextWords[index]),
    );

    expect(matchedVariantWords).toEqual(new Set(variantList));
    expect(result.lexiconLowScoreMatchCount).toBeGreaterThanOrEqual(variantList.length);
  });

  it("matches two-word variants in uncertain glossary filter data", () => {
    const segments: Segment[] = [
      {
        ...baseSegment,
        id: "segment-two-word-variant",
        text: "The long transcript includes new phrase details for validation.",
        words: [
          { word: "The", start: 0, end: 1 },
          { word: "long", start: 1, end: 2 },
          { word: "transcript", start: 2, end: 3 },
          { word: "includes", start: 3, end: 4 },
          { word: "new", start: 4, end: 5 },
          { word: "phrase", start: 5, end: 6 },
          { word: "details", start: 6, end: 7 },
          { word: "for", start: 7, end: 8 },
          { word: "validation", start: 8, end: 9 },
        ],
      },
    ];

    const result = computeLexiconMatches({
      segments,
      lexiconEntries: [
        {
          term: "CanonicalName",
          variants: ["new phrase"],
          falsePositives: [],
        },
      ],
      lexiconThreshold: 0.82,
    });

    const matches = result.lexiconMatchesBySegment.get("segment-two-word-variant");
    expect(matches?.get(4)?.term).toBe("CanonicalName");
    expect(matches?.get(5)?.term).toBe("CanonicalName");
    expect(matches?.get(4)?.score).toBeLessThan(1);
    expect(matches?.get(5)?.score).toBeLessThan(1);
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

  it("skips similarity work when the length gap cannot reach the threshold", () => {
    const segments: Segment[] = [
      {
        ...baseSegment,
        id: "segment-5",
        words: [{ word: "a", start: 0, end: 1 }],
      },
    ];

    const similaritySpy = vi.spyOn(fuzzy, "similarityScore");

    computeLexiconMatches({
      segments,
      lexiconEntries: [{ term: "extraordinarylongword", variants: [], falsePositives: [] }],
      lexiconThreshold: 0.9,
    });

    expect(similaritySpy).not.toHaveBeenCalled();
    similaritySpy.mockRestore();
  });
});

describe("useLexiconMatches", () => {
  it("reuses matches for unchanged segments", () => {
    const segmentA: Segment = {
      id: "segment-a",
      speaker: "SPEAKER_00",
      tags: [],
      start: 0,
      end: 1,
      text: "alpha",
      words: [{ word: "alpha", start: 0, end: 1 }],
    };
    const segmentB: Segment = {
      id: "segment-b",
      speaker: "SPEAKER_00",
      tags: [],
      start: 1,
      end: 2,
      text: "beta",
      words: [{ word: "beta", start: 1, end: 2 }],
    };

    const similaritySpy = vi.spyOn(fuzzy, "similarityScore");
    const lexiconEntries = [{ term: "alphi", variants: [], falsePositives: [] }];

    const { rerender } = renderHook(
      ({ segments }) =>
        useLexiconMatches({
          segments,
          lexiconEntries,
          lexiconThreshold: 0.8,
        }),
      { initialProps: { segments: [segmentA, segmentB] } },
    );

    const initialCalls = similaritySpy.mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);

    similaritySpy.mockClear();
    rerender({ segments: [segmentA, { ...segmentB }] });

    expect(similaritySpy.mock.calls.length).toBeGreaterThan(0);
    expect(similaritySpy.mock.calls.length).toBeLessThan(initialCalls);
    similaritySpy.mockRestore();
  });
});
