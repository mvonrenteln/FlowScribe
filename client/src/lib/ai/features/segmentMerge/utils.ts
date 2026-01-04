/**
 * Segment Merge Utilities
 *
 * Pure helper functions for segment merge analysis.
 * These functions have no external dependencies and are easily testable.
 *
 * @module ai/features/segmentMerge/utils
 */

import type {
  MergeAnalysisSegment,
  MergeConfidenceLevel,
  MergeSuggestion,
  RawMergeSuggestion,
  TextSmoothingInfo,
} from "./types";

// ==================== Time & Gap Calculations ====================

/**
 * Calculate time gap between two segments.
 *
 * @param segment1 - First segment (earlier)
 * @param segment2 - Second segment (later)
 * @returns Time gap in seconds (negative if overlapping)
 *
 * @example
 * ```ts
 * const gap = calculateTimeGap(
 *   { end: 10.5 },
 *   { start: 11.2 }
 * );
 * // 0.7
 * ```
 */
export function calculateTimeGap(
  segment1: Pick<MergeAnalysisSegment, "end">,
  segment2: Pick<MergeAnalysisSegment, "start">,
): number {
  return segment2.start - segment1.end;
}

/**
 * Check if time gap is within threshold.
 *
 * @param gap - Time gap in seconds
 * @param threshold - Maximum allowed gap
 * @returns True if gap is acceptable
 */
export function isTimeGapAcceptable(gap: number, threshold: number): boolean {
  return gap >= 0 && gap <= threshold;
}

/**
 * Format time for display (MM:SS.ms).
 *
 * @param seconds - Time in seconds
 * @returns Formatted time string
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toFixed(1).padStart(4, "0")}`;
}

/**
 * Format time range for display.
 *
 * @param start - Start time in seconds
 * @param end - End time in seconds
 * @returns Formatted time range string
 */
export function formatTimeRange(start: number, end: number): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

// ==================== Speaker Comparison ====================

/**
 * Check if two segments have the same speaker.
 *
 * @param segment1 - First segment
 * @param segment2 - Second segment
 * @returns True if same speaker
 */
export function isSameSpeaker(
  segment1: Pick<MergeAnalysisSegment, "speaker">,
  segment2: Pick<MergeAnalysisSegment, "speaker">,
): boolean {
  return segment1.speaker === segment2.speaker;
}

// ==================== Sentence Analysis ====================

/**
 * Check if text ends with sentence-ending punctuation.
 *
 * @param text - Text to check
 * @returns True if ends with . ! ?
 */
export function endsWithSentencePunctuation(text: string): boolean {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed);
}

/**
 * Check if text starts with a capital letter (suggesting new sentence).
 *
 * @param text - Text to check
 * @returns True if starts with capital
 */
export function startsWithCapital(text: string): boolean {
  const trimmed = text.trim();
  return /^[A-ZÄÖÜ]/.test(trimmed);
}

/**
 * Check if text ends with a conjunction or incomplete phrase.
 *
 * @param text - Text to check
 * @returns True if sentence appears incomplete
 */
export function endsIncomplete(text: string): boolean {
  const trimmed = text.trim().toLowerCase();

  // Common patterns suggesting incomplete sentence
  const incompletePatterns = [
    /\b(and|but|or|because|since|while|when|if|that|which|who|whom|whose|where|what|how|why|so|as|than|the|a|an|to|of|in|on|at|for|with|by)$/i,
    /,$/,
    /-$/,
    /\.{2,}$/,
  ];

  return incompletePatterns.some((pattern) => pattern.test(trimmed));
}

/**
 * Detect if there's an incorrect sentence break between segments.
 * Common Whisper artifact: period followed by capital letter mid-sentence.
 *
 * @param segment1 - First segment
 * @param segment2 - Second segment
 * @returns True if likely incorrect break
 *
 * @example
 * ```ts
 * // "So what we're trying to." + "Achieve here is"
 * // Returns true - likely mid-sentence break
 * ```
 */
export function detectIncorrectSentenceBreak(
  segment1: Pick<MergeAnalysisSegment, "text">,
  segment2: Pick<MergeAnalysisSegment, "text">,
): boolean {
  const text1 = segment1.text.trim();
  const text2 = segment2.text.trim();

  // Pattern: First segment ends with period, second starts with lowercase-looking word
  // that was capitalized (common Whisper artifact)
  if (endsWithSentencePunctuation(text1) && startsWithCapital(text2)) {
    // Check if second segment starts with a word that's usually lowercase
    const firstWord = text2.split(/\s+/)[0]?.toLowerCase();
    const usuallyLowercaseWords = [
      "achieve",
      "because",
      "but",
      "and",
      "or",
      "so",
      "which",
      "that",
      "when",
      "where",
      "how",
      "what",
      "if",
      "as",
      "than",
      "to",
      "for",
      "with",
      "about",
      "into",
      "through",
      "during",
      "before",
      "after",
      "above",
      "below",
      "from",
      "up",
      "down",
      "in",
      "out",
      "on",
      "off",
      "over",
      "under",
      "again",
      "further",
      "then",
      "once",
      "here",
      "there",
      "all",
      "each",
      "few",
      "more",
      "most",
      "other",
      "some",
      "such",
      "no",
      "nor",
      "not",
      "only",
      "own",
      "same",
      "too",
      "very",
      "just",
      "also",
      "now",
    ];

    if (firstWord && usuallyLowercaseWords.includes(firstWord)) {
      return true;
    }
  }

  // Pattern: First segment doesn't end with punctuation at all
  if (!endsWithSentencePunctuation(text1) && !text1.endsWith(",")) {
    return true;
  }

  return false;
}

// ==================== Merge Text Operations ====================

/**
 * Concatenate segment texts with a separator.
 *
 * @param segments - Segments to concatenate
 * @param separator - Separator between texts (default: " ")
 * @returns Concatenated text
 */
export function concatenateTexts(
  segments: Pick<MergeAnalysisSegment, "text">[],
  separator = " ",
): string {
  return segments.map((s) => s.text.trim()).join(separator);
}

/**
 * Apply basic text smoothing (without AI).
 * Removes obvious artifacts like double spaces, trailing punctuation issues.
 *
 * @param text - Text to smooth
 * @returns Smoothed text
 */
export function applyBasicSmoothing(text: string): string {
  return (
    text
      // Remove double spaces
      .replace(/\s+/g, " ")
      // Fix space before punctuation
      .replace(/\s+([.,!?;:])/g, "$1")
      // Fix double punctuation
      .replace(/([.!?])\s*\1+/g, "$1")
      .trim()
  );
}

/**
 * Create smoothing info from raw AI response.
 *
 * @param originalConcat - Original concatenated text
 * @param smoothedText - Smoothed text from AI
 * @param changesDescription - Description of changes
 * @returns TextSmoothingInfo object
 */
export function createSmoothingInfo(
  originalConcat: string,
  smoothedText: string | undefined,
  changesDescription: string | undefined,
): TextSmoothingInfo | undefined {
  if (!smoothedText || smoothedText === originalConcat) {
    return undefined;
  }

  return {
    applied: true,
    originalConcatenated: originalConcat,
    smoothedText,
    changes: changesDescription || "Text was smoothed",
  };
}

// ==================== Confidence Calculation ====================

/**
 * Convert numeric confidence score to level.
 *
 * @param score - Confidence score (0-1)
 * @returns Confidence level
 */
export function scoreToConfidenceLevel(score: number): MergeConfidenceLevel {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

/**
 * Check if confidence meets minimum threshold.
 *
 * @param level - Confidence level to check
 * @param minLevel - Minimum required level
 * @returns True if meets threshold
 */
export function meetsConfidenceThreshold(
  level: MergeConfidenceLevel,
  minLevel: MergeConfidenceLevel,
): boolean {
  const order: Record<MergeConfidenceLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };

  return order[level] >= order[minLevel];
}

// ==================== Prompt Formatting ====================

/**
 * Format segments for AI prompt.
 *
 * @param segments - Segments to format
 * @returns Formatted string for prompt
 */
export function formatSegmentsForPrompt(segments: MergeAnalysisSegment[]): string {
  return segments
    .map((seg) => {
      const timeRange = formatTimeRange(seg.start, seg.end);
      return `[${seg.id}] [${seg.speaker}] (${timeRange}): "${seg.text}"`;
    })
    .join("\n");
}

/**
 * Format segment pairs for analysis.
 * Groups consecutive segments for merge analysis.
 *
 * @param segments - All segments
 * @param maxTimeGap - Maximum time gap to consider
 * @param sameSpeakerOnly - Only include same-speaker pairs
 * @returns Formatted pairs for prompt
 */
export function formatSegmentPairsForPrompt(
  segments: MergeAnalysisSegment[],
  maxTimeGap: number,
  sameSpeakerOnly: boolean,
): string {
  const pairs: string[] = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const seg1 = segments[i];
    const seg2 = segments[i + 1];

    // Skip if different speakers (when required)
    if (sameSpeakerOnly && !isSameSpeaker(seg1, seg2)) {
      continue;
    }

    // Skip if time gap too large
    const gap = calculateTimeGap(seg1, seg2);
    if (!isTimeGapAcceptable(gap, maxTimeGap)) {
      continue;
    }

    pairs.push(`--- Pair ${pairs.length + 1} ---
Segment A [${seg1.id}]:
  Speaker: ${seg1.speaker}
  Time: ${formatTimeRange(seg1.start, seg1.end)}
  Text: "${seg1.text}"

Segment B [${seg2.id}]:
  Speaker: ${seg2.speaker}
  Time: ${formatTimeRange(seg2.start, seg2.end)}
  Text: "${seg2.text}"

Gap: ${gap.toFixed(2)}s`);
  }

  return pairs.join("\n\n");
}

// ==================== Suggestion Processing ====================

/**
 * Generate unique ID for a merge suggestion.
 */
export function generateSuggestionId(): string {
  return `merge-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create MergeSuggestion from raw AI response.
 *
 * @param raw - Raw suggestion from AI
 * @param segments - Original segments for context
 * @returns Processed MergeSuggestion or null if invalid
 */
export function processSuggestion(
  raw: RawMergeSuggestion,
  segmentMap: Map<string, MergeAnalysisSegment>,
): MergeSuggestion | null {
  // Validate segment IDs
  const relevantSegments = raw.segmentIds
    .map((id) => segmentMap.get(id))
    .filter((s): s is MergeAnalysisSegment => s !== undefined);

  if (relevantSegments.length < 2) {
    return null;
  }

  // Calculate merged text
  const mergedText = concatenateTexts(relevantSegments);

  // Calculate time range
  const timeRange = {
    start: Math.min(...relevantSegments.map((s) => s.start)),
    end: Math.max(...relevantSegments.map((s) => s.end)),
  };

  // Calculate time gap (between first and second segment)
  const timeGap =
    relevantSegments.length >= 2 ? calculateTimeGap(relevantSegments[0], relevantSegments[1]) : 0;

  // Create smoothing info if provided
  const smoothing = createSmoothingInfo(mergedText, raw.smoothedText, raw.smoothingChanges);

  return {
    id: generateSuggestionId(),
    segmentIds: raw.segmentIds,
    confidence: scoreToConfidenceLevel(raw.confidence ?? 0.5),
    confidenceScore: raw.confidence ?? 0.5,
    reason: raw.reason || "Segments appear to belong together",
    status: "pending",
    mergedText,
    smoothing,
    timeRange,
    speaker: relevantSegments[0].speaker,
    timeGap,
  };
}

/**
 * Process multiple raw suggestions.
 *
 * @param rawSuggestions - Raw suggestions from AI
 * @param segments - Original segments
 * @param minConfidence - Minimum confidence to include
 * @returns Processed suggestions
 */
export function processSuggestions(
  rawSuggestions: RawMergeSuggestion[],
  segments: MergeAnalysisSegment[],
  minConfidence: MergeConfidenceLevel = "low",
): MergeSuggestion[] {
  const segmentMap = new Map(segments.map((s) => [s.id, s]));

  return rawSuggestions
    .map((raw) => processSuggestion(raw, segmentMap))
    .filter((s): s is MergeSuggestion => s !== null)
    .filter((s) => meetsConfidenceThreshold(s.confidence, minConfidence));
}

// ==================== Grouping & Filtering ====================

/**
 * Group suggestions by confidence level.
 *
 * @param suggestions - Suggestions to group
 * @returns Grouped suggestions
 */
export function groupByConfidence(suggestions: MergeSuggestion[]): {
  high: MergeSuggestion[];
  medium: MergeSuggestion[];
  low: MergeSuggestion[];
} {
  return {
    high: suggestions.filter((s) => s.confidence === "high"),
    medium: suggestions.filter((s) => s.confidence === "medium"),
    low: suggestions.filter((s) => s.confidence === "low"),
  };
}

/**
 * Filter suggestions by status.
 *
 * @param suggestions - All suggestions
 * @param status - Status to filter by
 * @returns Filtered suggestions
 */
export function filterByStatus(
  suggestions: MergeSuggestion[],
  status: MergeSuggestion["status"],
): MergeSuggestion[] {
  return suggestions.filter((s) => s.status === status);
}

/**
 * Count suggestions by confidence level.
 *
 * @param suggestions - Suggestions to count
 * @returns Count by level
 */
export function countByConfidence(suggestions: MergeSuggestion[]): {
  high: number;
  medium: number;
  low: number;
} {
  const grouped = groupByConfidence(suggestions);
  return {
    high: grouped.high.length,
    medium: grouped.medium.length,
    low: grouped.low.length,
  };
}

// ==================== Validation ====================

/**
 * Validate that segments can be merged.
 *
 * @param segmentIds - IDs of segments to merge
 * @param allSegments - All available segments
 * @returns Validation result
 */
export function validateMergeCandidate(
  segmentIds: string[],
  allSegments: MergeAnalysisSegment[],
): { valid: boolean; error?: string } {
  if (segmentIds.length < 2) {
    return { valid: false, error: "At least 2 segments required for merge" };
  }

  const segmentMap = new Map(allSegments.map((s) => [s.id, s]));

  // Check all segments exist
  for (const id of segmentIds) {
    if (!segmentMap.has(id)) {
      return { valid: false, error: `Segment ${id} not found` };
    }
  }

  // Check segments are consecutive
  const indices = segmentIds.map((id) => allSegments.findIndex((s) => s.id === id));
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) {
      return { valid: false, error: "Segments must be consecutive" };
    }
  }

  // Check same speaker
  const speakers = new Set(segmentIds.map((id) => segmentMap.get(id)?.speaker));
  if (speakers.size > 1) {
    return { valid: false, error: "Segments must have the same speaker" };
  }

  return { valid: true };
}
