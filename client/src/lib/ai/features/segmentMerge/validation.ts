/**
 * Segment Merge Validation
 *
 * Validation rules and utilities for segment merge analysis.
 * Uses rule-based validation for flexible, testable input validation.
 *
 * @module ai/features/segmentMerge/validation
 */

import type { MergeAnalysisIssue, MergeAnalysisSegment } from "./types";

/**
 * Validation rule for segment merge analysis
 */
export interface ValidationRule<T> {
  /**
   * Check if data passes validation
   */
  check: (data: T) => boolean;

  /**
   * Issue to report if validation fails
   */
  issue: MergeAnalysisIssue;
}

/**
 * Validate input data using array of rules
 *
 * @param data - Data to validate
 * @param rules - Validation rules to apply
 * @returns Array of issues (empty if all rules pass)
 *
 * @example
 * ```ts
 * const issues = validateWithRules(segments, mergeValidationRules);
 * if (issues.some(i => i.level === "error")) {
 *   // Cannot proceed
 * }
 * ```
 */
export function validateWithRules<T>(data: T, rules: ValidationRule<T>[]): MergeAnalysisIssue[] {
  return rules.filter((rule) => !rule.check(data)).map((rule) => rule.issue);
}

/**
 * Standard validation rules for segment merge analysis
 */
export const mergeValidationRules: ValidationRule<MergeAnalysisSegment[]>[] = [
  {
    check: (segments) => segments.length >= 2,
    issue: {
      level: "warn",
      message: "At least 2 segments required for merge analysis",
    },
  },
  {
    check: (segments) => segments.every((s) => s.id && s.id.length > 0),
    issue: {
      level: "error",
      message: "All segments must have valid IDs",
    },
  },
  {
    check: (segments) => segments.every((s) => s.text !== undefined && s.text !== null),
    issue: {
      level: "error",
      message: "All segments must have text",
    },
  },
  {
    check: (segments) =>
      segments.every((s) => typeof s.start === "number" && typeof s.end === "number"),
    issue: {
      level: "error",
      message: "All segments must have valid timestamps",
    },
  },
  {
    check: (segments) => segments.every((s) => s.start < s.end),
    issue: {
      level: "error",
      message: "Segment start time must be before end time",
    },
  },
];

/**
 * Check if validation issues contain errors (vs warnings)
 */
export function hasValidationErrors(issues: MergeAnalysisIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}

/**
 * Check if validation issues contain warnings
 */
export function hasValidationWarnings(issues: MergeAnalysisIssue[]): boolean {
  return issues.some((i) => i.level === "warn");
}

/**
 * Create a custom validation rule
 *
 * @example
 * ```ts
 * const maxSegmentsRule = createRule(
 *   (segments) => segments.length <= 1000,
 *   { level: "warn", message: "Too many segments" }
 * );
 * ```
 */
export function createRule<T>(
  check: (data: T) => boolean,
  issue: MergeAnalysisIssue,
): ValidationRule<T> {
  return { check, issue };
}
