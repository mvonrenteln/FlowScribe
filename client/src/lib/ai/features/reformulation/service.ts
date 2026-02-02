/**
 * Chapter Reformulation Service
 *
 * Service for reformulating chapters using AI.
 * Uses the unified AI module for execution.
 *
 * @module ai/features/reformulation/service
 */

import type { Segment } from "@/lib/store/types";
import type { Chapter } from "@/types/chapter";
import { executeFeature } from "../../core";
import { parseTextResponse } from "../../parsing";
import { CHAPTER_REFORMULATION_CONFIG } from "./config";
import type { ReformulateChapterParams, ReformulationContext, ReformulationResult } from "./types";

// ==================== Main Functions ====================

/**
 * Reformulate a chapter using AI.
 *
 * @param params - Reformulation parameters
 * @returns Reformulation result with text and metadata
 *
 * @example
 * ```ts
 * const result = await reformulateChapter({
 *   chapter: { id: "1", title: "Introduction", ... },
 *   segments: [...],
 *   allChapters: [...],
 *   prompt: { instructions: "Summarize..." },
 *   includeContext: true,
 *   contextWordLimit: 500,
 * });
 * ```
 */
export async function reformulateChapter(
  params: ReformulateChapterParams,
): Promise<ReformulationResult> {
  const {
    chapter,
    segments,
    allChapters,
    prompt,
    providerId,
    model,
    customInstructions,
    signal,
    includeContext,
    contextWordLimit,
  } = params;

  // Build context (summaries + previous chapter)
  const context = buildReformulationContext({
    chapter,
    allChapters,
    includeContext,
    contextWordLimit,
  });

  // Build chapter content from segments
  const chapterContent = buildChapterContent(segments);

  // Build prompt variables
  const variables = {
    chapterTitle: chapter.title,
    chapterSummary: chapter.summary || "",
    chapterNotes: chapter.notes || "",
    chapterTags: chapter.tags?.join(", ") || "",
    chapterContent,
    previousChapterSummaries: context.summaries,
    previousChapterText: context.previousText,
    contextWordLimit,
    promptInstructions: prompt.instructions,
    customInstructions: customInstructions || "",
  };

  // Execute feature with config prompt
  const result = await executeFeature<string>("chapter-reformulation", variables, {
    customPrompt: {
      systemPrompt: CHAPTER_REFORMULATION_CONFIG.systemPrompt,
      userPromptTemplate: CHAPTER_REFORMULATION_CONFIG.userPromptTemplate,
    },
    signal,
    providerId,
    model,
  });

  if (!result.success || !result.data) {
    console.error("[Reformulation Service] Reformulation failed:", result.error);
    throw new Error(result.error || "Failed to reformulate chapter");
  }

  // Parse response (handles LLM artifacts)
  const parseResult = parseTextResponse(result.data, {
    originalText: chapterContent,
    detectErrors: true,
  });

  if (parseResult.wasError) {
    console.warn("[Reformulation Service] AI returned error-like response:", parseResult.warnings);
  }

  const reformulatedText = parseResult.text.trim();

  // Validate result
  if (!reformulatedText) {
    throw new Error("Reformulation returned empty text");
  }

  // Calculate word count
  const wordCount = reformulatedText.split(/\s+/).length;

  // Warn if text is unusually long (>2x original)
  const originalWordCount = chapterContent.split(/\s+/).length;
  if (wordCount > originalWordCount * 2) {
    console.warn(
      `[Reformulation Service] Generated text is unusually long: ${wordCount} words vs ${originalWordCount} original`,
    );
  }

  return {
    reformulatedText,
    wordCount,
  };
}

// ==================== Helper Functions ====================

/**
 * Build reformulation context from previous chapters.
 *
 * @param options - Context building options
 * @returns Context with summaries and previous chapter text
 */
function buildReformulationContext(options: {
  chapter: Chapter;
  allChapters: Chapter[];
  includeContext: boolean;
  contextWordLimit: number;
}): ReformulationContext {
  const { chapter, allChapters, includeContext, contextWordLimit } = options;

  if (!includeContext) {
    return { summaries: [], previousText: "" };
  }

  const currentIndex = allChapters.findIndex((c) => c.id === chapter.id);

  // Summaries from all previous chapters
  const summaries = allChapters
    .slice(0, currentIndex)
    .map((c) => c.summary)
    .filter((s): s is string => !!s);

  // Previous chapter text (truncated to contextWordLimit)
  let previousText = "";
  if (currentIndex > 0) {
    const prevChapter = allChapters[currentIndex - 1];
    // Use reformulated text if available, otherwise use summary
    if (prevChapter.reformulatedText) {
      previousText = truncateToWords(prevChapter.reformulatedText, contextWordLimit);
    } else if (prevChapter.summary) {
      previousText = truncateToWords(prevChapter.summary, contextWordLimit);
    }
  }

  return { summaries, previousText };
}

/**
 * Build chapter content from segments.
 *
 * @param segments - Segments in the chapter
 * @returns Combined text content
 */
export function buildChapterContent(segments: Segment[]): string {
  return segments.map((s) => s.text).join("\n\n");
}

/**
 * Truncate text to a maximum number of words.
 * Takes the last N words (most recent context).
 *
 * @param text - Text to truncate
 * @param wordLimit - Maximum number of words
 * @returns Truncated text
 */
export function truncateToWords(text: string, wordLimit: number): string {
  const words = text.split(/\s+/);
  if (words.length <= wordLimit) {
    return text;
  }
  // Return last N words (most recent context)
  return words.slice(-wordLimit).join(" ");
}
