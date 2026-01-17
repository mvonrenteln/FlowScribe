import { describe, expect, it } from "vitest";
import { computeAutoConfidenceThreshold } from "@/lib/transcript/lowConfidenceThreshold";

const buildSegment = (id: string, scores: Array<number | undefined>) => ({
  id,
  speaker: "SPEAKER_00",
  start: 0,
  end: 1,
  text: "segment",
  words: scores.map((score, index) => ({
    word: `w${index}`,
    start: index,
    end: index + 0.5,
    score,
  })),
  tags: [],
});

describe("computeAutoConfidenceThreshold", () => {
  it("returns null when no scores exist", () => {
    const segments = [buildSegment("seg-1", [undefined, undefined])];

    expect(computeAutoConfidenceThreshold(segments)).toBeNull();
  });

  it("selects the 10th percentile without sorting the full list", () => {
    const segments = [
      buildSegment("seg-1", [0.9, 0.1, 0.5, 0.2, 0.8]),
      buildSegment("seg-2", [0.3, 0.4, 0.6, 0.7, 0.05]),
    ];

    expect(computeAutoConfidenceThreshold(segments)).toBeCloseTo(0.1, 5);
  });

  it("clamps the threshold to the max", () => {
    const segments = [buildSegment("seg-1", [0.8, 0.9])];

    expect(computeAutoConfidenceThreshold(segments)).toBeCloseTo(0.4, 5);
  });
});
