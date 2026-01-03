/**
 * Formatting Utilities Tests
 *
 * Tests for core formatting functions.
 */

import { describe, expect, it } from "vitest";
import {
  summarizeError,
  summarizeMessages,
  truncateText,
} from "../core/formatting";

describe("truncateText", () => {
  it("should return '<empty>' for null", () => {
    expect(truncateText(null)).toBe("<empty>");
  });

  it("should return '<empty>' for undefined", () => {
    expect(truncateText(undefined)).toBe("<empty>");
  });

  it("should return '<empty>' for empty string", () => {
    expect(truncateText("")).toBe("<empty>");
  });

  it("should return text unchanged if under limit", () => {
    expect(truncateText("Hello", 10)).toBe("Hello");
  });

  it("should return text unchanged if exactly at limit", () => {
    expect(truncateText("Hello", 5)).toBe("Hello");
  });

  it("should truncate with ellipsis", () => {
    expect(truncateText("Hello world", 8)).toBe("Hello w…");
  });

  it("should use custom ellipsis", () => {
    expect(truncateText("Hello world", 8, "...")).toBe("Hello...");
  });

  it("should use default max length of 600", () => {
    const longText = "a".repeat(700);
    const result = truncateText(longText);
    expect(result.length).toBe(600);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("summarizeMessages", () => {
  it("should return empty string for undefined", () => {
    expect(summarizeMessages(undefined)).toBe("");
  });

  it("should return empty string for null", () => {
    expect(summarizeMessages(null)).toBe("");
  });

  it("should return empty string for empty array", () => {
    expect(summarizeMessages([])).toBe("");
  });

  it("should join string messages", () => {
    expect(summarizeMessages(["a", "b", "c"])).toBe("a; b; c");
  });

  it("should extract message from objects", () => {
    const issues = [{ message: "first" }, { message: "second" }];
    expect(summarizeMessages(issues)).toBe("first; second");
  });

  it("should handle msg property", () => {
    expect(summarizeMessages([{ msg: "alt" }])).toBe("alt");
  });

  it("should handle error property", () => {
    expect(summarizeMessages([{ error: "err" }])).toBe("err");
  });

  it("should truncate beyond max messages", () => {
    expect(summarizeMessages(["a", "b", "c", "d", "e"])).toBe("a; b; c (+2 more)");
  });

  it("should respect custom max messages", () => {
    expect(summarizeMessages(["a", "b", "c", "d"], 2)).toBe("a; b (+2 more)");
  });

  it("should JSON stringify unknown objects", () => {
    const result = summarizeMessages([{ foo: "bar" }]);
    expect(result).toContain("foo");
    expect(result).toContain("bar");
  });
});

describe("summarizeError", () => {
  it("should return message for error without details", () => {
    const error = new Error("Simple error");
    expect(summarizeError(error)).toBe("Simple error");
  });

  it("should extract issues from details", () => {
    const error = Object.assign(new Error("Failed"), {
      details: { issues: ["issue 1", "issue 2"] },
    });
    expect(summarizeError(error)).toBe("Failed: issue 1; issue 2");
  });

  it("should handle empty issues array", () => {
    const error = Object.assign(new Error("Failed"), {
      details: { issues: [] },
    });
    expect(summarizeError(error)).toBe("Failed");
  });

  it("should handle details without issues", () => {
    const error = Object.assign(new Error("Failed"), {
      details: { other: "data" },
    });
    expect(summarizeError(error)).toBe("Failed");
  });

  it("should truncate many issues", () => {
    const error = Object.assign(new Error("Failed"), {
      details: { issues: ["a", "b", "c", "d", "e"] },
    });
    expect(summarizeError(error)).toBe("Failed: a; b; c (+2 more)");
  });
});

