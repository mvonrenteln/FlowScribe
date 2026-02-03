/**
 * Chapter Rewrite Types
 *
 * Type definitions for the chapter rewrite feature.
 *
 * @module ai/features/rewrite/types
 */

import type { Segment } from "@/lib/store/types";
import type { Chapter } from "@/types/chapter";

/**
 * Rewrite prompt configuration.
 */
export interface RewritePrompt {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Instructions for rewrite (inserted into user prompt) */
  instructions: string;
  /** Whether this is a built-in prompt */
  isBuiltin?: boolean;
}

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
  /** Rewrite prompt to use */
  prompt: RewritePrompt;
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
