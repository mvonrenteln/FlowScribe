/**
 * Text Parser Tests
 *
 * Tests for the text response parsing utilities.
 */

import { describe, expect, it } from "vitest";
import {
  parseTextResponse,
  parseTextSimple,
  stripQuotes,
  stripCodeBlocks,
  looksLikeError,
  extractFirstParagraph,
  removePreamble,
} from "../parsing/text";

describe("Text Parser", () => {
  describe("parseTextResponse", () => {
    it("should return trimmed text", () => {
      const result = parseTextResponse("  Hello, world!  ");
      expect(result.text).toBe("Hello, world!");
      expect(result.wasError).toBe(false);
      expect(result.usedFallback).toBe(false);
    });

    it("should remove double quotes", () => {
      const result = parseTextResponse('"Hello, world!"');
      expect(result.text).toBe("Hello, world!");
    });

    it("should remove single quotes", () => {
      const result = parseTextResponse("'Hello, world!'");
      expect(result.text).toBe("Hello, world!");
    });

    it("should remove markdown code blocks", () => {
      const result = parseTextResponse("```\nHello, world!\n```");
      expect(result.text).toBe("Hello, world!");
    });

    it("should remove code blocks with language identifier", () => {
      const result = parseTextResponse("```text\nHello, world!\n```");
      expect(result.text).toBe("Hello, world!");
    });

    it("should detect error-like responses", () => {
      const result = parseTextResponse(
        "I'm sorry, I cannot help with that.",
        { originalText: "Original text" }
      );
      expect(result.wasError).toBe(true);
      expect(result.usedFallback).toBe(true);
      expect(result.text).toBe("Original text");
    });

    it("should detect 'as an ai' responses", () => {
      const result = parseTextResponse(
        "As an AI language model, I cannot process that request.",
        { originalText: "Fallback" }
      );
      expect(result.wasError).toBe(true);
      expect(result.text).toBe("Fallback");
    });

    it("should not fallback without originalText", () => {
      const result = parseTextResponse("I'm sorry, I cannot help.");
      expect(result.wasError).toBe(true);
      expect(result.usedFallback).toBe(false);
      expect(result.text).toBe("I'm sorry, I cannot help.");
    });

    it("should respect removeQuotes option", () => {
      const result = parseTextResponse('"Quoted"', { removeQuotes: false });
      expect(result.text).toBe('"Quoted"');
    });

    it("should respect removeCodeBlocks option", () => {
      const result = parseTextResponse("```code```", { removeCodeBlocks: false });
      expect(result.text).toBe("```code```");
    });

    it("should respect detectErrors option", () => {
      const result = parseTextResponse("I'm sorry", {
        detectErrors: false,
        originalText: "Original",
      });
      expect(result.wasError).toBe(false);
      expect(result.text).toBe("I'm sorry");
    });

    it("should use custom error patterns", () => {
      const result = parseTextResponse("CUSTOM_ERROR_CODE", {
        errorPatterns: ["custom_error"],
        originalText: "Fallback",
      });
      expect(result.wasError).toBe(true);
      expect(result.text).toBe("Fallback");
    });

    it("should add warnings for errors", () => {
      const result = parseTextResponse("I cannot do that", {
        originalText: "Original",
      });
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("parseTextSimple", () => {
    it("should return clean text", () => {
      const result = parseTextSimple('"Hello!"');
      expect(result).toBe("Hello!");
    });

    it("should fallback on error with original", () => {
      const result = parseTextSimple("I'm sorry, I cannot.", "Original");
      expect(result).toBe("Original");
    });
  });

  describe("stripQuotes", () => {
    it("should remove double quotes", () => {
      expect(stripQuotes('"test"')).toBe("test");
    });

    it("should remove single quotes", () => {
      expect(stripQuotes("'test'")).toBe("test");
    });

    it("should remove smart quotes", () => {
      expect(stripQuotes("\u201Ctest\u201D")).toBe("test");
      expect(stripQuotes("\u2018test\u2019")).toBe("test");
    });

    it("should not remove mismatched quotes", () => {
      expect(stripQuotes('"test\'')).toBe('"test\'');
    });

    it("should handle empty string", () => {
      expect(stripQuotes("")).toBe("");
    });

    it("should trim whitespace", () => {
      expect(stripQuotes('  "test"  ')).toBe("test");
    });
  });

  describe("stripCodeBlocks", () => {
    it("should remove simple code blocks", () => {
      expect(stripCodeBlocks("```\ncode\n```")).toBe("code");
    });

    it("should remove code blocks with language", () => {
      expect(stripCodeBlocks("```javascript\ncode\n```")).toBe("code");
    });

    it("should remove inline code", () => {
      expect(stripCodeBlocks("`inline`")).toBe("inline");
    });

    it("should not remove multi-line inline code", () => {
      expect(stripCodeBlocks("`line1\nline2`")).toBe("`line1\nline2`");
    });

    it("should handle empty string", () => {
      expect(stripCodeBlocks("")).toBe("");
    });
  });

  describe("looksLikeError", () => {
    it("should detect 'I cannot'", () => {
      expect(looksLikeError("I cannot help with that.")).toBe(true);
    });

    it("should detect 'I\\'m sorry'", () => {
      expect(looksLikeError("I'm sorry, but I can't do that.")).toBe(true);
    });

    it("should detect 'as an ai'", () => {
      expect(looksLikeError("As an AI, I don't have feelings.")).toBe(true);
    });

    it("should be case insensitive", () => {
      expect(looksLikeError("I CANNOT DO THAT")).toBe(true);
    });

    it("should return false for normal text", () => {
      expect(looksLikeError("The weather is nice today.")).toBe(false);
    });

    it("should use custom patterns", () => {
      expect(looksLikeError("custom error", ["custom error"])).toBe(true);
      expect(looksLikeError("normal text", ["custom error"])).toBe(false);
    });
  });

  describe("extractFirstParagraph", () => {
    it("should extract first paragraph", () => {
      const text = "First paragraph.\n\nSecond paragraph.";
      expect(extractFirstParagraph(text)).toBe("First paragraph.");
    });

    it("should handle single paragraph", () => {
      expect(extractFirstParagraph("Just one paragraph.")).toBe("Just one paragraph.");
    });

    it("should handle multiple newlines", () => {
      const text = "First.\n\n\n\nSecond.";
      expect(extractFirstParagraph(text)).toBe("First.");
    });

    it("should handle empty string", () => {
      expect(extractFirstParagraph("")).toBe("");
    });
  });

  describe("removePreamble", () => {
    it("should remove 'Here is the revised text:'", () => {
      expect(removePreamble("Here is the revised text: Hello")).toBe("Hello");
    });

    it("should remove 'Revised text:'", () => {
      expect(removePreamble("Revised text: Hello")).toBe("Hello");
    });

    it("should remove 'The corrected version is:'", () => {
      expect(removePreamble("The corrected version is: Hello")).toBe("Hello");
    });

    it("should be case insensitive", () => {
      expect(removePreamble("HERE IS THE REVISED TEXT: Hello")).toBe("Hello");
    });

    it("should handle text without preamble", () => {
      expect(removePreamble("No preamble here.")).toBe("No preamble here.");
    });

    it("should handle empty string", () => {
      expect(removePreamble("")).toBe("");
    });
  });
});

