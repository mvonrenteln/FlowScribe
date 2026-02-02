/**
 * Chapter Reformulation Types
 *
 * Type definitions for the chapter reformulation feature.
 *
 * @module ai/features/reformulation/types
 */

import type { Segment } from "@/lib/store/types";
import type { Chapter } from "@/types/chapter";

/**
 * Reformulation prompt configuration.
 */
export interface ReformulationPrompt {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Instructions for reformulation (inserted into user prompt) */
  instructions: string;
  /** Whether this is a built-in prompt */
  isBuiltin?: boolean;
}

/**
 * Parameters for reformulating a chapter.
 */
export interface ReformulateChapterParams {
  /** Chapter to reformulate */
  chapter: Chapter;
  /** Segments in the chapter */
  segments: Segment[];
  /** All chapters (for context) */
  allChapters: Chapter[];
  /** Reformulation prompt to use */
  prompt: ReformulationPrompt;
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
 * Result of a reformulation operation.
 */
export interface ReformulationResult {
  /** Reformulated text */
  reformulatedText: string;
  /** Word count of reformulated text */
  wordCount: number;
}

/**
 * Context for reformulation (previous chapters).
 */
export interface ReformulationContext {
  /** Summaries from previous chapters */
  summaries: string[];
  /** Text from previous chapter (truncated) */
  previousText: string;
}
