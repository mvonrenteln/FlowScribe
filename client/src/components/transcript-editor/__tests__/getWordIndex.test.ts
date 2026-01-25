import { describe, expect, it } from "vitest";
import type { Word } from "@/lib/store/types";
import { getWordIndexForTime } from "../useSegmentSelection";

describe("getWordIndexForTime", () => {
  it("finds the containing word index", () => {
    const words: Word[] = [
      { word: "a", start: 0, end: 1 },
      { word: "b", start: 2, end: 3 },
      { word: "c", start: 4, end: 5 },
    ];
    expect(getWordIndexForTime(words, 0.5)).toBe(0);
    expect(getWordIndexForTime(words, 2.5)).toBe(1);
    expect(getWordIndexForTime(words, 4.2)).toBe(2);
  });

  it("returns next word index if time is between words", () => {
    const words: Word[] = [
      { word: "a", start: 0, end: 1 },
      { word: "b", start: 2, end: 3 },
    ];
    // between end of first and start of second -> should return index of second
    expect(getWordIndexForTime(words, 1.5)).toBe(1);
  });

  it("returns last index when time is after all words", () => {
    const words: Word[] = [
      { word: "a", start: 0, end: 1 },
      { word: "b", start: 2, end: 3 },
    ];
    expect(getWordIndexForTime(words, 10)).toBe(1);
  });

  it("handles single-word arrays", () => {
    const words: Word[] = [{ word: "a", start: 0, end: 1 }];
    expect(getWordIndexForTime(words, -1)).toBe(0);
    expect(getWordIndexForTime(words, 0.5)).toBe(0);
    expect(getWordIndexForTime(words, 5)).toBe(0);
  });
});
