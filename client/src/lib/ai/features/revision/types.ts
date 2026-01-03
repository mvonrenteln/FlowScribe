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

  /** Prompt template to use */
  prompt: RevisionTemplate;

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

  /** Prompt template to use */
  prompt: RevisionTemplate;

  /** Abort signal for cancellation */
  signal?: AbortSignal;

  /** Progress callback */
  onProgress?: (processed: number, total: number) => void;

  /** Called when a single result is ready */
  onResult?: (result: RevisionResult) => void;
}

/**
 * Revision prompt template.
 */
export interface RevisionTemplate {
  /** Template ID */
  id: string;

  /** Display name */
  name: string;

  /** System prompt */
  systemPrompt: string;

  /** User prompt template (supports {{text}}, {{previousText}}, {{nextText}}, {{speaker}}) */
  userPromptTemplate: string;

  /** Whether this is a built-in template */
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
