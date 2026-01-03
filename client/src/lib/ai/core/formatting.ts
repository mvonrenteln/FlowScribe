/**
 * Output Formatting Utilities
 *
 * Generic utilities for formatting output in AI features.
 * Includes preview generation, issue summarization, etc.
 *
 * @module ai/core/formatting
 */

// ==================== Preview Generation ====================

/**
 * Truncate text with ellipsis for preview/logging.
 * Returns "<empty>" for empty/null/undefined input.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 600)
 * @param ellipsis - Ellipsis character (default: …)
 * @returns Truncated text or "<empty>" if no input
 *
 * @example
 * ```ts
 * truncateText("Hello world", 8) // "Hello w…"
 * truncateText("Short", 10) // "Short"
 * truncateText(null) // "<empty>"
 * ```
 */
export function truncateText(
  text: string | null | undefined,
  maxLength = 600,
  ellipsis = "…",
): string {
  if (!text) return "<empty>";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * @deprecated Use truncateText instead
 */
export const previewText = truncateText;

/**
 * @deprecated Use truncateText instead
 */
export const previewResponse = truncateText;

// ==================== Issue Summarization ====================

/**
 * Issue-like object with a message.
 */
export interface Summarizable {
  message?: string;
  msg?: string;
  error?: string;
  [key: string]: unknown;
}

/**
 * Extract message from an issue object.
 *
 * @param issue - Issue object or string
 * @returns Extracted message
 */
function extractMessage(issue: unknown): string {
  if (typeof issue === "string") return issue;

  if (issue && typeof issue === "object") {
    const obj = issue as Summarizable;
    const message = obj.message ?? obj.msg ?? obj.error;
    if (typeof message === "string") return message;
    return JSON.stringify(obj);
  }

  return String(issue);
}

/**
 * Summarize an array of issues into a short string.
 * Shows first N messages, then count of remaining.
 *
 * @param issues - Array of issues (strings or objects with message)
 * @param maxMessages - Maximum messages to show (default: 3)
 * @returns Summary string
 *
 * @example
 * ```ts
 * summarizeMessages(["a", "b", "c", "d", "e"])
 * // "a; b; c (+2 more)"
 * ```
 */
export function summarizeMessages(
  issues: unknown[] | undefined | null,
  maxMessages = 3,
): string {
  if (!issues || issues.length === 0) return "";

  const messages = issues.map(extractMessage).filter(Boolean);
  if (messages.length === 0) return "";

  if (messages.length <= maxMessages) {
    return messages.join("; ");
  }

  const shown = messages.slice(0, maxMessages).join("; ");
  const remaining = messages.length - maxMessages;
  return `${shown} (+${remaining} more)`;
}

/**
 * Summarize an error with its issues for display.
 * Extracts issues from error.details if present.
 *
 * @param error - Error to summarize
 * @returns Formatted error message with issues
 *
 * @example
 * ```ts
 * const err = new AIError("Failed", "CODE", {
 *   issues: ["issue 1", "issue 2"]
 * });
 * summarizeError(err) // "Failed: issue 1; issue 2"
 * ```
 */
export function summarizeError(error: Error): string {
  // Check for details with issues array
  if ("details" in error && error.details && typeof error.details === "object") {
    const details = error.details as Record<string, unknown>;
    const issues = details.issues;

    if (Array.isArray(issues) && issues.length > 0) {
      const summary = summarizeMessages(issues);
      if (summary) {
        return `${error.message}: ${summary}`;
      }
    }
  }

  return error.message;
}

// ==================== Deprecated Aliases ====================

/**
 * @deprecated Use summarizeMessages instead
 */
export const summarizeIssues = summarizeMessages;
