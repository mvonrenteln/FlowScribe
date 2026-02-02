/**
 * Tests for Chapter Reformulation Service
 */

import { describe, expect, it } from "vitest";
import type { Segment } from "@/lib/store/types";
import { buildChapterContent, truncateToWords } from "../service";

describe("buildChapterContent", () => {
  it("should combine segment texts with double newlines", () => {
    const segments: Segment[] = [
      {
        id: "1",
        speaker: "Speaker 1",
        start: 0,
        end: 5,
        text: "First segment.",
        words: [],
      },
      {
        id: "2",
        speaker: "Speaker 2",
        start: 5,
        end: 10,
        text: "Second segment.",
        words: [],
      },
      {
        id: "3",
        speaker: "Speaker 1",
        start: 10,
        end: 15,
        text: "Third segment.",
        words: [],
      },
    ];

    const result = buildChapterContent(segments);

    expect(result).toBe("First segment.\n\nSecond segment.\n\nThird segment.");
  });

  it("should handle empty segments array", () => {
    const result = buildChapterContent([]);
    expect(result).toBe("");
  });

  it("should handle single segment", () => {
    const segments: Segment[] = [
      {
        id: "1",
        speaker: "Speaker 1",
        start: 0,
        end: 5,
        text: "Only segment.",
        words: [],
      },
    ];

    const result = buildChapterContent(segments);
    expect(result).toBe("Only segment.");
  });
});

describe("truncateToWords", () => {
  it("should not truncate when word count is below limit", () => {
    const text = "This is a short text with few words.";
    const result = truncateToWords(text, 10);
    expect(result).toBe(text);
  });

  it("should truncate to last N words when over limit", () => {
    const text = "One two three four five six seven eight nine ten.";
    const result = truncateToWords(text, 5);
    expect(result).toBe("six seven eight nine ten.");
  });

  it("should handle exact word limit", () => {
    const text = "One two three four five.";
    const result = truncateToWords(text, 5);
    expect(result).toBe(text);
  });

  it("should handle empty text", () => {
    const result = truncateToWords("", 10);
    expect(result).toBe("");
  });

  it("should handle single word", () => {
    const result = truncateToWords("Hello", 5);
    expect(result).toBe("Hello");
  });

  it("should normalize spacing when truncating", () => {
    const text = "Word1 Word2  Word3   Word4 Word5";
    const result = truncateToWords(text, 3);
    expect(result).toBe("Word3 Word4 Word5");
  });
});
