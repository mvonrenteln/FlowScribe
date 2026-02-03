export type ChapterSource = "manual" | "ai";

/**
 * Represents a chapter boundary and its optional metadata.
 * Chapters are defined in terms of segment IDs and must not overlap.
 */
export type Chapter = {
  /** Unique chapter identifier. */
  id: string;
  /** Chapter title shown in the transcript timeline and drawer. */
  title: string;
  /** Optional single-sentence summary for context. */
  summary?: string;
  /** Optional editor notes (excluded from AI context by default). */
  notes?: string;
  /** Optional tag IDs for quick categorization. */
  tags?: string[];
  /** First segment ID included in this chapter. */
  startSegmentId: string;
  /** Last segment ID included in this chapter. */
  endSegmentId: string;
  /** Cached count of segments in this chapter. */
  segmentCount: number;
  /** Creation timestamp (ms). */
  createdAt: number;
  /** Origin of this chapter. */
  source: ChapterSource;
  /** Rewritten/transformed text (optional). */
  rewrittenText?: string;
  /** Timestamp when rewrite was created (ms). */
  rewrittenAt?: number;
  /** ID of the prompt used for rewrite. */
  rewritePromptId?: string;
  /** Metadata about the rewrite. */
  rewriteContext?: {
    model?: string;
    providerId?: string;
    wordCount?: number;
  };
};

/**
 * Allowed updates for manual chapter edits.
 */
export type ChapterUpdate = Partial<Omit<Chapter, "id" | "createdAt" | "source" | "segmentCount">>;
