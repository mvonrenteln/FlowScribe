/**
 * Speaker Classification Utilities
 *
 * Helper functions for speaker classification.
 *
 * @module ai/features/speaker/utils
 */

import type { BatchSegment } from "./types";

// ==================== Speaker Tag Normalization ====================

/**
 * Normalize a speaker tag for comparison.
 * Removes non-alphanumeric characters and converts to lowercase.
 *
 * @param tag - Speaker tag to normalize
 * @returns Normalized tag
 *
 * @example
 * normalizeSpeakerTag("[Speaker 1]") // "speaker1"
 * normalizeSpeakerTag("Dr. Smith") // "drsmith"
 */
export function normalizeSpeakerTag(tag: string): string {
  let result = "";
  for (let i = 0; i < tag.length; i++) {
    const code = tag.charCodeAt(i);
    // 0-9, A-Z, a-z
    if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      result += tag[i].toLowerCase();
    }
  }
  return result;
}

/**
 * Resolve a suggested speaker tag to an existing speaker.
 * Uses fuzzy matching to handle slight variations.
 *
 * @param rawTag - Tag suggested by AI
 * @param availableSpeakers - List of available speakers
 * @returns Matched speaker or null if no match/ambiguous
 *
 * @example
 * resolveSuggestedSpeaker("alice", ["Alice", "Bob"]) // "Alice"
 * resolveSuggestedSpeaker("unknown", ["Alice", "Bob"]) // null
 */
export function resolveSuggestedSpeaker(
  rawTag: string,
  availableSpeakers: Iterable<string>,
): string | null {
  const normalizedRaw = normalizeSpeakerTag(rawTag);
  if (!normalizedRaw) return null;

  let match: string | null = null;
  const iterator = availableSpeakers[Symbol.iterator]();

  for (let next = iterator.next(); !next.done; next = iterator.next()) {
    const speaker = next.value;
    const normalizedSpeaker = normalizeSpeakerTag(speaker);

    if (!normalizedSpeaker) {
      continue;
    }

    // Exact match or partial match
    if (normalizedRaw === normalizedSpeaker || normalizedSpeaker.includes(normalizedRaw)) {
      // If we already have a match and it's different, ambiguous
      if (match && match !== speaker) {
        return null;
      }
      match = speaker;
    }
  }

  return match;
}

/**
 * Mark a tag as a new (unknown) speaker.
 * Cleans up the tag for display.
 *
 * @param tag - Raw speaker tag
 * @returns Cleaned name and isNew flag
 */
export function markNewSpeaker(tag: string): { name: string; isNew: boolean } {
  const cleaned = tag.replace(/^\[|\]$/g, "").trim();
  return { name: cleaned, isNew: true };
}

// ==================== Prompt Formatting ====================

/**
 * Format segments for the AI prompt.
 *
 * @param segments - Segments to format
 * @returns Formatted string for prompt
 *
 * @example
 * formatSegmentsForPrompt([{id: "1", speaker: "Alice", text: "Hello"}])
 * // "[1] [Alice]: \"Hello\""
 */
export function formatSegmentsForPrompt(
  segments: Array<{ id: string; speaker: string; text: string }>,
): string {
  return segments.map((s, i) => `[${i + 1}] [${s.speaker}]: "${s.text}"`).join("\n");
}

/**
 * Format available speakers for the AI prompt.
 *
 * @param speakers - Available speaker tags
 * @returns Comma-separated list
 */
export function formatSpeakersForPrompt(speakers: string[]): string {
  return speakers.join(", ");
}

// ==================== Batch Preparation ====================

/**
 * Prepare segments for batch processing.
 *
 * @param segments - Full segments to process
 * @returns Array of batch segments with minimal data
 */
export function prepareBatchSegments(
  segments: Array<{ id: string; speaker: string; text: string }>,
): BatchSegment[] {
  return segments.map((s) => ({
    segmentId: s.id,
    speaker: s.speaker,
    text: s.text,
  }));
}

/**
 * Truncate text for prompt to avoid token limits.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text with ellipsis if needed
 */
export function truncateForPrompt(text: string, maxLength = 500): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Calculate approximate token count for a string.
 * Uses simple heuristic: ~4 characters per token.
 *
 * @param text - Text to estimate
 * @returns Approximate token count
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
