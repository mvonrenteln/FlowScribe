/**
 * Chapter Rewrite Service
 *
 * Service for reformulating chapters using AI.
 * Uses the unified AI module for execution.
 *
 * @module ai/features/rewrite/service
 */

import { indexById } from "@/lib/arrayUtils";
import type { Segment } from "@/lib/store/types";
import type { Chapter } from "@/types/chapter";
import { executeFeature } from "../../core";
import { parseTextResponse } from "../../parsing";
import { CHAPTER_REFORMULATION_CONFIG } from "./config";
import type { RewriteChapterParams, RewriteContext, RewriteResult } from "./types";

// ==================== Main Functions ====================

/**
 * Rewrite a chapter using AI.
 *
 * @param params - Rewrite parameters
 * @returns Rewrite result with text and metadata
 *
 * @example
 * ```ts
 * const result = await rewriteChapter({
 *   chapter: { id: "1", title: "Introduction", ... },
 *   segments: [...],
 *   allChapters: [...],
 *   prompt: { instructions: "Summarize..." },
 *   includeContext: true,
 *   contextWordLimit: 500,
 * });
 * ```
 */
export async function rewriteChapter(params: RewriteChapterParams): Promise<RewriteResult> {
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
  const context = buildRewriteContext({
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
  const result = await executeFeature<string>("chapter-rewrite", variables, {
    customPrompt: {
      systemPrompt: CHAPTER_REFORMULATION_CONFIG.systemPrompt,
      userPromptTemplate: CHAPTER_REFORMULATION_CONFIG.userPromptTemplate,
    },
    signal,
    providerId,
    model,
  });

  if (!result.success || !result.data) {
    console.error("[Rewrite Service] Rewrite failed:", result.error);
    throw new Error(result.error || "Failed to rewrite chapter");
  }

  // Parse response (handles LLM artifacts)
  const parseResult = parseTextResponse(result.data, {
    originalText: chapterContent,
    detectErrors: true,
  });

  if (parseResult.wasError) {
    console.warn("[Rewrite Service] AI returned error-like response:", parseResult.warnings);
  }

  const rewrittenText = parseResult.text.trim();

  // Validate result
  if (!rewrittenText) {
    throw new Error("Rewrite returned empty text");
  }

  // Calculate word count
  const wordCount = rewrittenText.split(/\s+/).length;

  // Warn if text is unusually long (>2x original)
  const originalWordCount = chapterContent.split(/\s+/).length;
  if (wordCount > originalWordCount * 2) {
    console.warn(
      `[Rewrite Service] Generated text is unusually long: ${wordCount} words vs ${originalWordCount} original`,
    );
  }

  return {
    rewrittenText,
    wordCount,
  };
}

// ==================== Helper Functions ====================

/**
 * Build rewrite context from previous chapters.
 *
 * @param options - Context building options
 * @returns Context with summaries and previous chapter text
 */
function buildRewriteContext(options: {
  chapter: Chapter;
  allChapters: Chapter[];
  includeContext: boolean;
  contextWordLimit: number;
}): RewriteContext {
  const { chapter, allChapters, includeContext, contextWordLimit } = options;

  if (!includeContext) {
    return { summaries: [], previousText: "" };
  }

  const indexMap = indexById(allChapters);
  const currentIndex = indexMap.get(chapter.id) ?? -1;

  // Summaries from all previous chapters
  const summaries = allChapters
    .slice(0, currentIndex)
    .map((c) => c.summary)
    .filter((s): s is string => !!s);

  // Previous chapter text (truncated to contextWordLimit)
  let previousText = "";
  if (currentIndex > 0) {
    const prevChapter = allChapters[currentIndex - 1];
    // Use rewritten text if available, otherwise use summary
    if (prevChapter.rewrittenText) {
      previousText = truncateToWords(prevChapter.rewrittenText, contextWordLimit);
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
