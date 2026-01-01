import { describe, expect, it } from "vitest";
import {
  computeDiff,
  computeTextChanges,
  countChanges,
  getOriginalDiffSegments,
  getRevisedDiffSegments,
  hasDifferences,
  summarizeChanges,
} from "../diffUtils";

describe("diffUtils", () => {
  describe("computeDiff", () => {
    it("returns single equal segment for identical texts", () => {
      const result = computeDiff("hello world", "hello world");
      expect(result).toEqual([{ type: "equal", text: "hello world" }]);
    });

    it("detects simple word replacement", () => {
      const result = computeDiff("hello world", "hello universe");
      expect(result).toContainEqual({ type: "delete", text: "world" });
      expect(result).toContainEqual({ type: "insert", text: "universe" });
    });

    it("detects insertion", () => {
      const result = computeDiff("hello world", "hello beautiful world");
      expect(result).toContainEqual({ type: "insert", text: "beautiful " });
    });

    it("detects deletion", () => {
      const result = computeDiff("hello beautiful world", "hello world");
      expect(result).toContainEqual({ type: "delete", text: "beautiful " });
    });

    it("handles empty strings", () => {
      expect(computeDiff("", "")).toEqual([]);
      expect(computeDiff("hello", "")).toEqual([{ type: "delete", text: "hello" }]);
      expect(computeDiff("", "hello")).toEqual([{ type: "insert", text: "hello" }]);
    });

    it("detects grammar correction (das -> dass)", () => {
      const original = "Ich denke das es richtig ist";
      const revised = "Ich denke, dass es richtig ist";
      const result = computeDiff(original, revised);

      // Should have deletion of "das" and insertion of ", dass" or similar
      const hasChanges =
        result.some((s) => s.type === "delete") && result.some((s) => s.type === "insert");
      expect(hasChanges).toBe(true);
    });

    it("keeps punctuation-only deletions local", () => {
      const original = "mitten durch den Fels durch.";
      const revised = "mitten durch den Fels.";
      const result = computeDiff(original, revised);

      const deleteSegment = result.find((s) => s.type === "delete");
      expect(deleteSegment).toBeDefined();
      expect(deleteSegment?.text.replace(/\s+/g, "")).toBe("durch");

      const equalSegment = result.find((s) => s.type === "equal" && s.text.includes("Fels"));
      expect(equalSegment?.text).toContain("Fels");
      expect(result).toContainEqual({ type: "equal", text: "." });
    });

    it("separates punctuation tokens for replacements", () => {
      const original = "Hallo!";
      const revised = "Hallo?";
      const result = computeDiff(original, revised);

      expect(result).toContainEqual({ type: "delete", text: "!" });
      expect(result).toContainEqual({ type: "insert", text: "?" });
      expect(result).toContainEqual({ type: "equal", text: "Hallo" });
    });
  });

  describe("computeTextChanges", () => {
    it("returns empty array for identical texts", () => {
      const changes = computeTextChanges("hello", "hello");
      expect(changes).toHaveLength(0);
    });

    it("returns changes with correct positions", () => {
      const changes = computeTextChanges("abc", "aXc");
      expect(changes.length).toBeGreaterThan(0);
    });

    it("tracks deletions correctly", () => {
      const changes = computeTextChanges("hello world", "hello");
      const deleteChange = changes.find((c) => c.type === "delete");
      expect(deleteChange).toBeDefined();
      expect(deleteChange?.oldText).toContain("world");
    });

    it("tracks insertions correctly", () => {
      const changes = computeTextChanges("hello", "hello world");
      const insertChange = changes.find((c) => c.type === "insert");
      expect(insertChange).toBeDefined();
      expect(insertChange?.newText).toContain("world");
    });
  });

  describe("countChanges", () => {
    it("counts meaningful changes", () => {
      const changes = computeTextChanges("hello world", "hello universe");
      const count = countChanges(changes);
      expect(count).toBeGreaterThan(0);
    });

    it("ignores whitespace-only changes", () => {
      // This depends on the implementation
      const changes = [{ type: "delete" as const, position: 0, oldText: "   " }];
      const count = countChanges(changes);
      expect(count).toBe(0);
    });
  });

  describe("summarizeChanges", () => {
    it("returns 'No changes' for identical texts", () => {
      const changes = computeTextChanges("hello world", "hello world");
      const summary = summarizeChanges(changes, "hello world", "hello world");
      expect(summary).toBe("No changes");
    });

    it("returns count for multiple changes", () => {
      const original = "hello world";
      const revised = "goodbye universe";
      const changes = computeTextChanges(original, revised);
      const summary = summarizeChanges(changes, original, revised);
      expect(summary).toMatch(/\d+ changes?/);
    });
  });

  describe("getOriginalDiffSegments", () => {
    it("excludes insertions from original view", () => {
      const segments = getOriginalDiffSegments("hello", "hello world");
      const hasInsert = segments.some((s) => s.type === "insert");
      expect(hasInsert).toBe(false);
    });

    it("includes deletions in original view", () => {
      const segments = getOriginalDiffSegments("hello world", "hello");
      const hasDelete = segments.some((s) => s.type === "delete");
      expect(hasDelete).toBe(true);
    });
  });

  describe("getRevisedDiffSegments", () => {
    it("excludes deletions from revised view", () => {
      const segments = getRevisedDiffSegments("hello world", "hello");
      const hasDelete = segments.some((s) => s.type === "delete");
      expect(hasDelete).toBe(false);
    });

    it("includes insertions in revised view", () => {
      const segments = getRevisedDiffSegments("hello", "hello world");
      const hasInsert = segments.some((s) => s.type === "insert");
      expect(hasInsert).toBe(true);
    });
  });

  describe("hasDifferences", () => {
    it("returns false for identical texts", () => {
      expect(hasDifferences("hello", "hello")).toBe(false);
    });

    it("returns true for different texts", () => {
      expect(hasDifferences("hello", "world")).toBe(true);
    });

    it("is case-sensitive", () => {
      expect(hasDifferences("Hello", "hello")).toBe(true);
    });
  });
});
