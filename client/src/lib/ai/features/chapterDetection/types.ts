/**
 * Chapter Detection Types
 *
 * Types for AI-driven chapter detection suggestions.
 *
 * @module ai/features/chapterDetection/types
 */

export interface ChapterDetectionConfig {
  batchSize: number;
  minChapterLength: number;
  maxChapterLength: number;
  tagsAvailable: Array<{ id: string; label: string }>;
}

export interface ChapterDetectionResponse {
  chapters: Array<{
    title: string;
    summary?: string;
    notes?: string;
    tags?: string[];
    start: number;
    end: number;
  }>;
  chapterContinuation?: {
    lastChapterTitle: string;
    endsAtSimpleId: number;
    continuesIntoNextBatch: boolean;
  };
}

export interface ChapterDetectionIssue {
  level: "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}

export interface ChapterDetectionBatchLogEntry {
  batchIndex: number;
  batchSize: number;
  rawItemCount: number;
  suggestionCount: number;
  processedTotal: number;
  totalExpected: number;
  issues: ChapterDetectionIssue[];
  loggedAt: number;
  batchDurationMs?: number;
  elapsedMs?: number;
  fatal: boolean;
  requestPayload?: string;
  responsePayload?: string;
}

export interface ChapterDetectionBatch {
  batchIndex: number;
  totalBatches: number;
  segments: Array<{
    id: string;
    speaker: string;
    text: string;
    start: number;
    end: number;
  }>;
  previousChapterContext?: {
    title: string;
    summary?: string;
  };
}
