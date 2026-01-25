/**
 * Text Revision Utilities
 *
 * Pure helper functions for text revision.
 * These functions have no external dependencies and are easily testable.
 *
 * @module ai/features/revision/utils
 */

import { indexById } from "@/lib/arrayUtils";
import type { RevisionPrompt } from "./types";

// ==================== Prompt Variables ====================

/**
 * Context for building revision prompt variables.
 */
export interface RevisionContext {
  /** Previous segment text for context */
  previousText?: string;
  /** Next segment text for context */
  nextText?: string;
  /** Speaker name */
  speaker?: string;
}

/**
 * Variables for revision prompts.
 */
export interface RevisionPromptVariables {
  text: string;
  previousText?: string;
  nextText?: string;
  speaker?: string;
}

/**
 * Build prompt variables from segment data.
 *
 * @param text - Text to revise
 * @param context - Context from surrounding segments
 * @returns Variables ready for prompt compilation
 *
 * @example
 * ```ts
 * const vars = buildRevisionPromptVariables("Hello wrold", {
 *   previousText: "Welcome!",
 *   speaker: "Alice",
 * });
 * // { text: "Hello wrold", previousText: "Welcome!", speaker: "Alice" }
 * ```
 */
export function buildRevisionPromptVariables(
  text: string,
  context: RevisionContext = {},
): RevisionPromptVariables {
  return {
    text,
    previousText: context.previousText,
    nextText: context.nextText,
    speaker: context.speaker,
  };
}

// ==================== Text Comparison ====================

/**
 * Check if text was actually changed (ignoring leading/trailing whitespace).
 *
 * @param original - Original text
 * @param revised - Revised text
 * @returns True if content changed
 *
 * @example
 * ```ts
 * hasTextChanges("hello", "Hello") // true
 * hasTextChanges("hello", " hello ") // false
 * ```
 */
export function hasTextChanges(original: string, revised: string): boolean {
  return original.trim() !== revised.trim();
}

/**
 * Normalize text for comparison by trimming and collapsing whitespace.
 *
 * @param text - Text to normalize
 * @returns Normalized text
 */
export function normalizeForComparison(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/**
 * Check if revised text is substantively different from original.
 * More strict than hasTextChanges - ignores whitespace-only changes.
 *
 * @param original - Original text
 * @param revised - Revised text
 * @returns True if substantively different
 */
export function hasSubstantiveChanges(original: string, revised: string): boolean {
  return normalizeForComparison(original) !== normalizeForComparison(revised);
}

// ==================== Preview Generation ====================

/**
 * Truncate text with ellipsis if longer than max length.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Generate a short preview comparing original and revised text.
 *
 * @param original - Original text
 * @param revised - Revised text
 * @param maxLength - Maximum preview length
 * @returns Preview string
 *
 * @example
 * ```ts
 * generateChangePreview("hello", "Hello") // '"hello" → "Hello"'
 * generateChangePreview("same", "same") // "No changes"
 * ```
 */
export function generateChangePreview(original: string, revised: string, maxLength = 80): string {
  if (!hasTextChanges(original, revised)) {
    return "No changes";
  }

  // Calculate space for each part (minus arrow and quotes)
  const overhead = 7; // ' → "" + ""'
  const availablePerSide = Math.floor((maxLength - overhead) / 2);

  const origPreview = truncateWithEllipsis(original.trim(), availablePerSide);
  const revPreview = truncateWithEllipsis(revised.trim(), availablePerSide);

  return `"${origPreview}" → "${revPreview}"`;
}

// ==================== Prompt Validation ====================

/**
 * Validate that a revision prompt has required fields.
 *
 * @param prompt - Prompt to validate
 * @returns Validation result
 */
export function validateRevisionPrompt(prompt: RevisionPrompt): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!prompt.id?.trim()) {
    errors.push("Prompt ID is required");
  }

  if (!prompt.name?.trim()) {
    errors.push("Prompt name is required");
  }

  if (!prompt.systemPrompt?.trim()) {
    errors.push("System prompt is required");
  }

  if (!prompt.userPromptTemplate?.trim()) {
    errors.push("User prompt template is required");
  }

  // Check for {{text}} placeholder in user template
  if (prompt.userPromptTemplate && !prompt.userPromptTemplate.includes("{{text}}")) {
    errors.push("User prompt template must include {{text}} placeholder");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ==================== Result Helpers ====================

/**
 * Create an empty (unchanged) revision result.
 *
 * @param segmentId - Segment ID
 * @param originalText - Original text (returned as-is)
 * @returns Revision result with no changes
 */
export function createUnchangedResult(
  segmentId: string,
  originalText: string,
): { segmentId: string; revisedText: string; changes: never[]; isUnchanged: true } {
  return {
    segmentId,
    revisedText: originalText,
    changes: [],
    isUnchanged: true,
  };
}

/**
 * Create an error revision result.
 *
 * @param segmentId - Segment ID
 * @param originalText - Original text (returned as-is)
 * @param error - Error message
 * @returns Revision result with error
 */
export function createErrorResult(
  segmentId: string,
  originalText: string,
  error: string,
): { segmentId: string; revisedText: string; changes: never[]; reasoning: string } {
  return {
    segmentId,
    revisedText: originalText,
    changes: [],
    reasoning: error,
  };
}

// ==================== Batch Helpers ====================

/**
 * Find context segments for a given segment in a list.
 *
 * @param segments - All segments
 * @param segmentId - ID of segment to find context for
 * @returns Previous and next segment, if they exist
 */
export function findContextSegments<T extends { id: string }>(
  segments: T[],
  segmentId: string,
): { previous?: T; next?: T; index: number } {
  const indexMap = indexById(segments);
  const index = indexMap.get(segmentId) ?? -1;
  if (index === -1) return { index: -1 };
  return {
    previous: index > 0 ? segments[index - 1] : undefined,
    next: index < segments.length - 1 ? segments[index + 1] : undefined,
    index,
  };
}

/**
 * Calculate batch processing statistics.
 *
 * @param results - All results from batch
 * @param totalRequested - Total segments requested
 * @returns Summary statistics
 */
export function calculateBatchStats(
  results: Array<{ changes: unknown[] }>,
  totalRequested: number,
): { total: number; revised: number; unchanged: number; failed: number } {
  const revised = results.filter((r) => r.changes.length > 0).length;
  const unchanged = results.filter((r) => r.changes.length === 0).length;
  const failed = totalRequested - results.length;

  return {
    total: totalRequested,
    revised,
    unchanged,
    failed,
  };
}
