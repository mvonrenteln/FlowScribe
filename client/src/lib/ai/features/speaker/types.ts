/**
 * Speaker Classification Types
 *
 * Type definitions for the speaker classification feature.
 *
 * @module ai/features/speaker/types
 */

// ==================== Public Types ====================

/**
 * A single speaker suggestion from the AI.
 */
export interface SpeakerSuggestion {
  /** The suggested speaker tag */
  tag: string;

  /** Confidence level (0-1) */
  confidence: number;

  /** Optional reasoning for the suggestion */
  reason?: string;
}

/**
 * Input for speaker classification.
 */
export interface SpeakerClassificationInput {
  /** Segments to classify */
  segments: Array<{
    id: string;
    speaker: string;
    text: string;
  }>;

  /** Available speaker tags to choose from */
  availableSpeakers: string[];
}

/**
 * Output from speaker classification.
 */
export type SpeakerClassificationOutput = SpeakerSuggestion[];

/**
 * Result of classifying a single segment.
 */
export interface SpeakerClassificationResult {
  /** Segment ID */
  segmentId: string;

  /** Suggested speaker tag */
  suggestedSpeaker: string;

  /** Confidence level (0-1) */
  confidence: number;

  /** Whether this is a new (unknown) speaker */
  isNew: boolean;

  /** Original speaker tag */
  originalSpeaker: string;

  /** Optional reasoning */
  reason?: string;
}

// ==================== Internal Types ====================

/**
 * Raw response item from LLM.
 */
export interface RawSpeakerResponseItem {
  tag: string;
  confidence?: number;
  reason?: string;
}

/**
 * Segment prepared for batch processing.
 */
export interface BatchSegment {
  segmentId: string;
  speaker: string;
  text: string;
}

/**
 * Issue encountered during batch processing.
 */
export interface BatchIssue {
  level: "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Result of parsing speaker suggestions from raw response.
 */
export interface ParsedSuggestionsResult {
  /** Parsed suggestions */
  suggestions: SpeakerClassificationResult[];

  /** Number of items returned by model */
  rawItemCount: number;

  /** Issues encountered during parsing */
  issues: BatchIssue[];

  /** Count of unchanged speaker assignments */
  unchangedAssignments: number;

  /** Whether a fatal error occurred */
  fatal: boolean;

  /** Number of ignored items (e.g., mismatched count) */
  ignoredCount?: number;
}

// ==================== Configuration Types ====================

/**
 * Configuration for speaker classification.
 * Used by the store and UI.
 */
export interface SpeakerClassificationConfig {
  /** System prompt for AI */
  systemPrompt: string;

  /** User prompt template */
  userPromptTemplate: string;

  /** Batch size for processing */
  batchSize: number;

  /** Minimum confidence threshold */
  minConfidence?: number;
}

