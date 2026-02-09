/**
 * Chapter Rewrite Types
 *
 * Type definitions for the chapter rewrite feature.
 *
 * @module ai/features/rewrite/types
 */

import type { AIPrompt, Segment } from "@/lib/store/types";
import type { Chapter } from "@/types/chapter";

/**
 * Parameters for reformulating a chapter.
 */
export interface RewriteChapterParams {
  /** Chapter to rewrite */
  chapter: Chapter;
  /** Segments in the chapter */
  segments: Segment[];
  /** All chapters (for context) */
  allChapters: Chapter[];
  /** Rewrite prompt to use (must have operation='rewrite') */
  prompt: AIPrompt;
  /** AI provider ID (optional, uses default if not specified) */
  providerId?: string;
  /** Model to use (optional, uses provider default if not specified) */
  model?: string;
  /** Custom instructions to append to prompt */
  customInstructions?: string;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Include context (summaries + previous chapter) */
  includeContext: boolean;
  /** Maximum words from previous chapter to include */
  contextWordLimit: number;
}

/**
 * Parameters for reformulating a paragraph within a rewritten chapter.
 */
export interface RewriteParagraphParams {
  /** Chapter containing the paragraph */
  chapter: Chapter;
  /** Paragraph text to rewrite */
  paragraphContent: string;
  /** Previous paragraphs for context */
  previousParagraphs: string[];
  /** Paragraph context count */
  paragraphContextCount: number;
  /** Rewrite prompt to use (must have operation='rewrite') */
  prompt: AIPrompt;
  /** AI provider ID (optional, uses default if not specified) */
  providerId?: string;
  /** Model to use (optional, uses provider default if not specified) */
  model?: string;
  /** Custom instructions to append to prompt */
  customInstructions?: string;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Include paragraph context in prompt */
  includeParagraphContext: boolean;
}

/**
 * Result of a rewrite operation.
 */
export interface RewriteResult {
  /** Rewritten text */
  rewrittenText: string;
  /** Word count of rewritten text */
  wordCount: number;
}

/**
 * Context for rewrite (previous chapters).
 */
export interface RewriteContext {
  /** Summaries from previous chapters */
  summaries: string[];
  /** Text from previous chapter (truncated) */
  previousText: string;
}
