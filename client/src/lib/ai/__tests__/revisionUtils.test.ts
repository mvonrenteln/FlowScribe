/**
 * Revision Utils Tests
 *
 * Tests for pure utility functions in the revision feature.
 */

import { describe, expect, it } from "vitest";
import type { RevisionPrompt } from "../features/revision/types";
import {
  buildRevisionPromptVariables,
  calculateBatchStats,
  createErrorResult,
  createUnchangedResult,
  findContextSegments,
  generateChangePreview,
  hasSubstantiveChanges,
  hasTextChanges,
  normalizeForComparison,
  truncateWithEllipsis,
  validateRevisionPrompt,
} from "../features/revision/utils";

// ==================== buildRevisionPromptVariables ====================

describe("buildRevisionPromptVariables", () => {
  it("should build variables with text only", () => {
    const vars = buildRevisionPromptVariables("Hello world");

    expect(vars).toEqual({
      text: "Hello world",
      previousText: undefined,
      nextText: undefined,
      speaker: undefined,
    });
  });

  it("should include all context when provided", () => {
    const vars = buildRevisionPromptVariables("Hello world", {
      previousText: "Welcome!",
      nextText: "Goodbye!",
      speaker: "Alice",
    });

    expect(vars).toEqual({
      text: "Hello world",
      previousText: "Welcome!",
      nextText: "Goodbye!",
      speaker: "Alice",
    });
  });

  it("should handle partial context", () => {
    const vars = buildRevisionPromptVariables("Hello", {
      speaker: "Bob",
    });

    expect(vars.text).toBe("Hello");
    expect(vars.speaker).toBe("Bob");
    expect(vars.previousText).toBeUndefined();
    expect(vars.nextText).toBeUndefined();
  });
});

// ==================== hasTextChanges ====================

describe("hasTextChanges", () => {
  it("should return false for identical text", () => {
    expect(hasTextChanges("hello", "hello")).toBe(false);
  });

  it("should return false for whitespace-only differences", () => {
    expect(hasTextChanges("hello", " hello ")).toBe(false);
    expect(hasTextChanges(" hello", "hello ")).toBe(false);
  });

  it("should return true for content changes", () => {
    expect(hasTextChanges("hello", "Hello")).toBe(true);
    expect(hasTextChanges("hello", "hello!")).toBe(true);
    expect(hasTextChanges("hello world", "hello")).toBe(true);
  });

  it("should handle empty strings", () => {
    expect(hasTextChanges("", "")).toBe(false);
    expect(hasTextChanges("", "hello")).toBe(true);
    expect(hasTextChanges("hello", "")).toBe(true);
  });
});

// ==================== normalizeForComparison ====================

describe("normalizeForComparison", () => {
  it("should trim whitespace", () => {
    expect(normalizeForComparison("  hello  ")).toBe("hello");
  });

  it("should collapse multiple spaces", () => {
    expect(normalizeForComparison("hello   world")).toBe("hello world");
  });

  it("should collapse all whitespace types", () => {
    expect(normalizeForComparison("hello\n\t  world")).toBe("hello world");
  });
});

// ==================== hasSubstantiveChanges ====================

describe("hasSubstantiveChanges", () => {
  it("should return false for whitespace-only changes", () => {
    expect(hasSubstantiveChanges("hello world", "hello  world")).toBe(false);
    expect(hasSubstantiveChanges("hello\nworld", "hello world")).toBe(false);
  });

  it("should return true for content changes", () => {
    expect(hasSubstantiveChanges("hello", "Hello")).toBe(true);
    expect(hasSubstantiveChanges("hello world", "hello")).toBe(true);
  });
});

// ==================== truncateWithEllipsis ====================

describe("truncateWithEllipsis", () => {
  it("should return text unchanged if under limit", () => {
    expect(truncateWithEllipsis("hello", 10)).toBe("hello");
  });

  it("should return text unchanged if exactly at limit", () => {
    expect(truncateWithEllipsis("hello", 5)).toBe("hello");
  });

  it("should truncate with ellipsis if over limit", () => {
    expect(truncateWithEllipsis("hello world", 8)).toBe("hello...");
  });

  it("should handle edge case of very short max length", () => {
    expect(truncateWithEllipsis("hello", 4)).toBe("h...");
  });
});

// ==================== generateChangePreview ====================

describe("generateChangePreview", () => {
  it("should return 'No changes' for identical text", () => {
    expect(generateChangePreview("hello", "hello")).toBe("No changes");
  });

  it("should return 'No changes' for whitespace-only differences", () => {
    expect(generateChangePreview("hello", " hello ")).toBe("No changes");
  });

  it("should show before and after for changes", () => {
    const preview = generateChangePreview("hello", "Hello");
    expect(preview).toContain("hello");
    expect(preview).toContain("Hello");
    expect(preview).toContain("→");
  });

  it("should truncate long text", () => {
    const longText = "a".repeat(100);
    const preview = generateChangePreview(longText, "short", 50);
    expect(preview.length).toBeLessThanOrEqual(50);
    expect(preview).toContain("...");
  });
});

// ==================== validateRevisionPrompt ====================

describe("validateRevisionPrompt", () => {
  const validPrompt: RevisionPrompt = {
    id: "test-prompt",
    name: "Test Prompt",
    systemPrompt: "You are a helpful editor.",
    userPromptTemplate: "Please revise: {{text}}",
  };

  it("should accept valid prompt", () => {
    const result = validateRevisionPrompt(validPrompt);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject empty id", () => {
    const result = validateRevisionPrompt({ ...validPrompt, id: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Prompt ID is required");
  });

  it("should reject empty name", () => {
    const result = validateRevisionPrompt({ ...validPrompt, name: "  " });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Prompt name is required");
  });

  it("should reject empty system prompt", () => {
    const result = validateRevisionPrompt({ ...validPrompt, systemPrompt: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("System prompt is required");
  });

  it("should reject template without {{text}} placeholder", () => {
    const result = validateRevisionPrompt({
      ...validPrompt,
      userPromptTemplate: "No placeholder here",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("User prompt template must include {{text}} placeholder");
  });

  it("should collect multiple errors", () => {
    const result = validateRevisionPrompt({
      id: "",
      name: "",
      systemPrompt: "",
      userPromptTemplate: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

// ==================== createUnchangedResult ====================

describe("createUnchangedResult", () => {
  it("should create result with no changes", () => {
    const result = createUnchangedResult("seg-1", "original text");

    expect(result.segmentId).toBe("seg-1");
    expect(result.revisedText).toBe("original text");
    expect(result.changes).toEqual([]);
    expect(result.isUnchanged).toBe(true);
  });
});

// ==================== createErrorResult ====================

describe("createErrorResult", () => {
  it("should create result with error", () => {
    const result = createErrorResult("seg-1", "original text", "API failed");

    expect(result.segmentId).toBe("seg-1");
    expect(result.revisedText).toBe("original text");
    expect(result.changes).toEqual([]);
    expect(result.reasoning).toBe("API failed");
  });
});

// ==================== findContextSegments ====================

describe("findContextSegments", () => {
  const segments = [
    { id: "1", text: "First" },
    { id: "2", text: "Second" },
    { id: "3", text: "Third" },
  ];

  it("should find previous and next for middle segment", () => {
    const result = findContextSegments(segments, "2");

    expect(result.index).toBe(1);
    expect(result.previous?.id).toBe("1");
    expect(result.next?.id).toBe("3");
  });

  it("should have no previous for first segment", () => {
    const result = findContextSegments(segments, "1");

    expect(result.index).toBe(0);
    expect(result.previous).toBeUndefined();
    expect(result.next?.id).toBe("2");
  });

  it("should have no next for last segment", () => {
    const result = findContextSegments(segments, "3");

    expect(result.index).toBe(2);
    expect(result.previous?.id).toBe("2");
    expect(result.next).toBeUndefined();
  });

  it("should return -1 index for unknown segment", () => {
    const result = findContextSegments(segments, "unknown");

    expect(result.index).toBe(-1);
    expect(result.previous).toBeUndefined();
    expect(result.next).toBeUndefined();
  });

  it("should handle empty array", () => {
    const result = findContextSegments([], "1");
    expect(result.index).toBe(-1);
  });

  it("should handle single segment", () => {
    const result = findContextSegments([{ id: "1", text: "Only" }], "1");

    expect(result.index).toBe(0);
    expect(result.previous).toBeUndefined();
    expect(result.next).toBeUndefined();
  });
});

// ==================== calculateBatchStats ====================

describe("calculateBatchStats", () => {
  it("should calculate stats for mixed results", () => {
    const results = [
      { changes: [{ type: "insert" }] }, // revised
      { changes: [] }, // unchanged
      { changes: [{ type: "delete" }] }, // revised
    ];

    const stats = calculateBatchStats(results, 5);

    expect(stats.total).toBe(5);
    expect(stats.revised).toBe(2);
    expect(stats.unchanged).toBe(1);
    expect(stats.failed).toBe(2); // 5 requested - 3 results = 2 failed
  });

  it("should handle all unchanged", () => {
    const results = [{ changes: [] }, { changes: [] }];
    const stats = calculateBatchStats(results, 2);

    expect(stats.revised).toBe(0);
    expect(stats.unchanged).toBe(2);
    expect(stats.failed).toBe(0);
  });

  it("should handle all revised", () => {
    const results = [{ changes: [{}] }, { changes: [{}] }];
    const stats = calculateBatchStats(results, 2);

    expect(stats.revised).toBe(2);
    expect(stats.unchanged).toBe(0);
    expect(stats.failed).toBe(0);
  });

  it("should handle empty results", () => {
    const stats = calculateBatchStats([], 3);

    expect(stats.total).toBe(3);
    expect(stats.revised).toBe(0);
    expect(stats.unchanged).toBe(0);
    expect(stats.failed).toBe(3);
  });
});
