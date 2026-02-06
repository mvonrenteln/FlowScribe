/**
 * Text Revision Types
 *
 * Type definitions for the text revision feature.
 *
 * @module ai/features/revision/types
 */

import type { TextChange } from "@/lib/store/types";

// ==================== Public Types ====================

/**
 * Result of revising a single segment.
 */
export interface RevisionResult {
  /** Segment ID */
  segmentId: string;

  /** Revised text content */
  revisedText: string;

  /** List of changes made */
  changes: TextChange[];

  /** Summary of changes */
  changeSummary?: string;

  /** AI reasoning for changes */
  reasoning?: string;
}

/**
 * Parameters for revising a single segment.
 */
export interface SingleRevisionParams {
  /** Segment to revise */
  segment: {
    id: string;
    text: string;
    speaker?: string;
  };

  /** Prompt configuration to use */
  prompt: RevisionPrompt;

  /** Previous segment for context */
  previousSegment?: {
    id: string;
    text: string;
    speaker?: string;
  };

  /** Next segment for context */
  nextSegment?: {
    id: string;
    text: string;
    speaker?: string;
  };

  /** Abort signal for cancellation */
  signal?: AbortSignal;

  /** Selected AI provider ID */
  providerId?: string;

  /** Selected model */
  model?: string;
}

/**
 * Parameters for batch revision.
 */
export interface BatchRevisionParams {
  /** Segments to revise */
  segments: Array<{
    id: string;
    text: string;
    speaker?: string;
  }>;

  /** All segments for context lookup */
  allSegments: Array<{
    id: string;
    text: string;
    speaker?: string;
  }>;

  /** Prompt configuration to use */
  prompt: RevisionPrompt;

  /** Abort signal for cancellation */
  signal?: AbortSignal;

  /** Selected AI provider ID */
  providerId?: string;

  /** Selected model */
  model?: string;

  /** Progress callback */
  onProgress?: (processed: number, total: number) => void;

  /** Called when a single result is ready */
  onResult?: (result: RevisionResult) => void;

  /** Called when a segment is processed */
  onItemComplete?: (entry: RevisionBatchLogEntry) => void;
}

export interface RevisionBatchLogEntry {
  segmentId: string;
  status: "revised" | "unchanged" | "failed" | "cancelled";
  loggedAt: number;
  durationMs?: number;
  error?: string;
  responsePayload?: string;
  errorCode?: string;
}

/**
 * Revision prompt configuration.
 */
export interface RevisionPrompt {
  /** Prompt ID */
  id: string;

  /** Display name */
  name: string;

  /** System prompt */
  systemPrompt: string;

  /** User prompt template (supports {{text}}, {{previousText}}, {{nextText}}, {{speaker}}) */
  userPromptTemplate: string;

  /** Whether this is a built-in prompt */
  isBuiltin?: boolean;
}

/**
 * Result of batch revision.
 */
export interface BatchRevisionResult {
  /** All revision results */
  results: RevisionResult[];

  /** Processing summary */
  summary: {
    total: number;
    revised: number;
    unchanged: number;
    failed: number;
  };

  /** Issues encountered */
  issues: RevisionIssue[];
}

/**
 * Issue encountered during revision.
 */
export interface RevisionIssue {
  level: "warn" | "error";
  message: string;
  segmentId?: string;
  context?: Record<string, unknown>;
}

// ==================== Input/Output Types ====================

/**
 * Input for text revision.
 */
export interface TextRevisionInput {
  text: string;
  previousText?: string;
  nextText?: string;
  speaker?: string;
}

/**
 * Output from text revision.
 */
export interface TextRevisionOutput {
  revisedText: string;
  hasChanges: boolean;
}
