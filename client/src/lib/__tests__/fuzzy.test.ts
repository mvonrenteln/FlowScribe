import { describe, expect, it } from "vitest";
import { normalizeToken, similarityScore } from "@/lib/fuzzy";

describe("fuzzy utilities", () => {
  it("normalizes tokens by stripping punctuation and diacritics", () => {
    expect(normalizeToken("Zwergenb\u00e4r!")).toBe("zwergenbar");
  });

  it("returns perfect similarity for identical tokens", () => {
    expect(similarityScore("abc", "abc")).toBe(1);
  });

  it("returns lower similarity for different tokens", () => {
    const score = similarityScore("zwergenbar", "zwergenb");
    expect(score).toBeLessThan(1);
    expect(score).toBeGreaterThan(0.7);
  });
});
