/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import type { MergeAnalysisSegment } from "../types";
import {
  createRule,
  hasValidationErrors,
  hasValidationWarnings,
  mergeValidationRules,
  type ValidationRule,
  validateWithRules,
} from "../validation";

const createSegment = (overrides?: Partial<MergeAnalysisSegment>): MergeAnalysisSegment => ({
  id: "seg-1",
  text: "Hello world",
  start: 0,
  end: 1,
  speaker: "Speaker 1",
  ...overrides,
});

describe("Segment Merge Validation", () => {
  describe("validateWithRules", () => {
    it("should return empty array for valid data", () => {
      const segments = [createSegment({ id: "1" }), createSegment({ id: "2" })];
      const issues = validateWithRules(segments, mergeValidationRules);

      expect(issues).toEqual([]);
    });

    it("should return issues for invalid data", () => {
      const segments = [createSegment()]; // Only 1 segment
      const issues = validateWithRules(segments, mergeValidationRules);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain("At least 2 segments");
    });

    it("should collect multiple issues", () => {
      const rules: ValidationRule<number>[] = [
        {
          check: (n) => n > 0,
          issue: { level: "error", message: "Must be positive" },
        },
        {
          check: (n) => n < 100,
          issue: { level: "warn", message: "Should be less than 100" },
        },
      ];

      const issues = validateWithRules(-5, rules);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toBe("Must be positive");

      const issues2 = validateWithRules(150, rules);
      expect(issues2).toHaveLength(1);
      expect(issues2[0].message).toBe("Should be less than 100");
    });
  });

  describe("mergeValidationRules", () => {
    it("should require at least 2 segments", () => {
      const segments = [createSegment()];
      const issues = validateWithRules(segments, mergeValidationRules);

      expect(issues.some((i) => i.message.includes("At least 2 segments"))).toBe(true);
    });

    it("should require valid IDs", () => {
      const segments = [createSegment({ id: "" }), createSegment({ id: "valid" })];
      const issues = validateWithRules(segments, mergeValidationRules);

      expect(issues.some((i) => i.message.includes("valid IDs"))).toBe(true);
    });

    it("should require text on all segments", () => {
      const segments = [createSegment({ text: "" }), createSegment({ text: "valid" })];
      const issues = validateWithRules(segments, mergeValidationRules);

      expect(issues).toHaveLength(0); // Empty string is still a string

      const invalidSegments = [
        createSegment({ text: undefined as unknown as string }),
        createSegment(),
      ];
      const invalidIssues = validateWithRules(invalidSegments, mergeValidationRules);
      expect(invalidIssues.some((i) => i.message.includes("text"))).toBe(true);
    });

    it("should require valid timestamps", () => {
      const segments = [createSegment({ start: NaN }), createSegment()];
      const issues = validateWithRules(segments, mergeValidationRules);

      expect(issues.some((i) => i.message.includes("valid timestamps"))).toBe(true);
    });

    it("should require start before end", () => {
      const segments = [createSegment({ start: 5, end: 3 }), createSegment()];
      const issues = validateWithRules(segments, mergeValidationRules);

      expect(issues.some((i) => i.message.includes("start time must be before"))).toBe(true);
    });

    it("should pass for valid segments", () => {
      const segments = [
        createSegment({ id: "1", start: 0, end: 1 }),
        createSegment({ id: "2", start: 1, end: 2 }),
        createSegment({ id: "3", start: 2, end: 3 }),
      ];
      const issues = validateWithRules(segments, mergeValidationRules);

      expect(issues).toEqual([]);
    });
  });

  describe("hasValidationErrors", () => {
    it("should return true when errors present", () => {
      const issues = [
        { level: "error" as const, message: "Error" },
        { level: "warn" as const, message: "Warning" },
      ];

      expect(hasValidationErrors(issues)).toBe(true);
    });

    it("should return false when only warnings", () => {
      const issues = [
        { level: "warn" as const, message: "Warning 1" },
        { level: "warn" as const, message: "Warning 2" },
      ];

      expect(hasValidationErrors(issues)).toBe(false);
    });

    it("should return false for empty array", () => {
      expect(hasValidationErrors([])).toBe(false);
    });
  });

  describe("hasValidationWarnings", () => {
    it("should return true when warnings present", () => {
      const issues = [{ level: "warn" as const, message: "Warning" }];

      expect(hasValidationWarnings(issues)).toBe(true);
    });

    it("should return false when only errors", () => {
      const issues = [{ level: "error" as const, message: "Error" }];

      expect(hasValidationWarnings(issues)).toBe(false);
    });
  });

  describe("createRule", () => {
    it("should create a validation rule", () => {
      const rule = createRule((n: number) => n > 0, {
        level: "error",
        message: "Must be positive",
      });

      expect(rule.check(5)).toBe(true);
      expect(rule.check(-1)).toBe(false);
      expect(rule.issue.message).toBe("Must be positive");
    });

    it("should work with validateWithRules", () => {
      const customRule = createRule((segments: MergeAnalysisSegment[]) => segments.length <= 10, {
        level: "warn",
        message: "Too many segments",
      });

      const segments = Array.from({ length: 15 }, (_, i) => createSegment({ id: `${i}` }));
      const issues = validateWithRules(segments, [customRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toBe("Too many segments");
    });
  });
});
