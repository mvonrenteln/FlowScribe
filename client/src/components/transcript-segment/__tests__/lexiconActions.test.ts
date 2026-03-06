import { describe, expect, it } from "vitest";
import type { Word } from "@/lib/store";
import { buildReplacementText, getHyphenTarget } from "../lexiconActions";

describe("buildReplacementText", () => {
  const words: Word[] = [
    { word: "Hello", start: 0, end: 1 },
    { word: "world", start: 1, end: 2 },
  ];

  it("replaces a single word without partIndex or spanLength", () => {
    expect(buildReplacementText(words, 0, "Hi")).toBe("Hi world");
  });

  it("preserves leading/trailing punctuation on single-word replacement", () => {
    const wordsWithPunctuation: Word[] = [
      { word: '"Hello,', start: 0, end: 1 },
      { word: "world!", start: 1, end: 2 },
    ];
    expect(buildReplacementText(wordsWithPunctuation, 0, "Hi")).toBe('"Hi, world!');
  });

  it("replaces a hyphen part when partIndex is given", () => {
    const hyphenWords: Word[] = [{ word: "well-known", start: 0, end: 1 }];
    expect(buildReplacementText(hyphenWords, 0, "famous", 1)).toBe("well-famous");
  });

  describe("multi-word span replacement (glossary phrase matches)", () => {
    it("replaces two consecutive words with a single glossary term", () => {
      const phraseWords: Word[] = [
        { word: "The", start: 0, end: 1 },
        { word: "Shere", start: 1, end: 2 },
        { word: "Khan", start: 2, end: 3 },
        { word: "appeared.", start: 3, end: 4 },
      ];
      const result = buildReplacementText(phraseWords, 1, "Sherkan", undefined, 2);
      expect(result).toBe("The Sherkan appeared.");
    });

    it("preserves leading punctuation of the first word and trailing punctuation of the last word", () => {
      const phraseWords: Word[] = [
        { word: '"Shere', start: 0, end: 1 },
        { word: 'Khan"', start: 1, end: 2 },
      ];
      const result = buildReplacementText(phraseWords, 0, "Sherkan", undefined, 2);
      expect(result).toBe('"Sherkan"');
    });

    it("replaces a three-word span", () => {
      const phraseWords: Word[] = [
        { word: "I", start: 0, end: 1 },
        { word: "New", start: 1, end: 2 },
        { word: "York", start: 2, end: 3 },
        { word: "City", start: 3, end: 4 },
        { word: "today", start: 4, end: 5 },
      ];
      const result = buildReplacementText(phraseWords, 1, "NYC", undefined, 3);
      expect(result).toBe("I NYC today");
    });

    it("does not use span logic when spanLength is 1", () => {
      const phraseWords: Word[] = [
        { word: "Hello", start: 0, end: 1 },
        { word: "world", start: 1, end: 2 },
      ];
      const result = buildReplacementText(phraseWords, 0, "Hi", undefined, 1);
      expect(result).toBe("Hi world");
    });
  });
});

describe("getHyphenTarget", () => {
  it("returns the full value when partIndex is undefined", () => {
    expect(getHyphenTarget("well-known")).toBe("well-known");
  });

  it("returns the part at partIndex for hyphenated words", () => {
    expect(getHyphenTarget("well-known", 0)).toBe("well");
    expect(getHyphenTarget("well-known", 1)).toBe("known");
  });

  it("returns the full value when no hyphen exists despite partIndex", () => {
    expect(getHyphenTarget("hello", 0)).toBe("hello");
  });
});
