import { describe, expect, it } from "vitest";
import {
  createSearchRegex,
  escapeRegExp,
  findMatchesInText,
  normalizeForSearch,
} from "../searchUtils";

describe("searchUtils", () => {
  describe("normalizeForSearch", () => {
    it("normalizes unicode and lowercases", () => {
      // Müller (NFC) vs Müller (NFD: u + \u0308)
      const nfc = "Müller";
      const nfd = "Mu\u0308ller";
      expect(normalizeForSearch(nfc)).toBe("müller");
      expect(normalizeForSearch(nfd)).toBe("müller");
    });

    it("collapses multiple whitespaces", () => {
      expect(normalizeForSearch("hello   world")).toBe("hello world");
      expect(normalizeForSearch("\nhello\t  world ")).toBe(" hello world ");
    });
  });

  describe("escapeRegExp", () => {
    it("escapes special regex characters", () => {
      expect(escapeRegExp("hello.world*")).toBe("hello\\.world\\*");
      expect(escapeRegExp("[()]")).toBe("\\[\\(\\)\\]");
    });
  });

  describe("createSearchRegex", () => {
    it("creates a literal search regex", () => {
      const regex = createSearchRegex("hello.", false);
      expect(regex).not.toBeNull();
      expect(regex?.source).toBe("(hello\\.)");
      expect(regex?.flags).toBe("gi");
    });

    it("creates a custom regex when isRegex is true", () => {
      const regex = createSearchRegex("h.llo", true);
      expect(regex).not.toBeNull();
      expect(regex?.source).toBe("h.llo");
      expect(regex?.test("hello")).toBe(true);
    });

    it("preserves capturing groups for regex replacements", () => {
      const regex = createSearchRegex("Tanzenprobe- (.*)probe", true);
      expect(regex).not.toBeNull();
      expect(regex?.source).toBe("Tanzenprobe- (.*)probe");
    });

    it("returns null for invalid custom regex", () => {
      const regex = createSearchRegex("[invalid", true);
      expect(regex).toBeNull();
    });
  });

  describe("findMatchesInText", () => {
    it("returns all occurrences of a match", () => {
      const regex = /hello/gi;
      const text = "Hello world, hello again.";
      const matches = findMatchesInText(text, regex);
      expect(matches).toHaveLength(2);
      expect(matches[0]).toEqual({ start: 0, end: 5, match: "Hello" });
      expect(matches[1]).toEqual({ start: 13, end: 18, match: "hello" });
    });

    it("handles empty strings and null regex gracefully", () => {
      expect(findMatchesInText("", /test/)).toEqual([]);
      // @ts-expect-error - testing runtime robustness
      expect(findMatchesInText("text", null)).toEqual([]);
    });

    it("works with capturing groups (since createSearchRegex adds one)", () => {
      const regex = /(test)/gi;
      const text = "test test";
      const matches = findMatchesInText(text, regex);
      expect(matches).toHaveLength(2);
      expect(matches[0].match).toBe("test");
    });
  });
});
