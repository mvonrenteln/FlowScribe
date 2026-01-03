/**
 * Text Revision Service
 *
 * Service for revising transcript segments using AI.
 * Uses the unified AI module for execution.
 *
 * @module ai/features/revision/service
 */

import { computeTextChanges, summarizeChanges } from "../../../diffUtils";
import { executeFeature } from "../../core";
import { parseTextResponse } from "../../parsing";
import { compileTemplate } from "../../prompts";

import type {
  BatchRevisionParams,
  BatchRevisionResult,
  RevisionIssue,
  RevisionPrompt,
  RevisionResult,
  SingleRevisionParams,
} from "./types";

// ==================== Main Functions ====================

/**
 * Revise a single segment using AI.
 *
 * @param params - Revision parameters
 * @returns Revision result with changes
 *
 * @example
 * ```ts
 * const result = await reviseSegment({
 *   segment: { id: "1", text: "Um, hello there!" },
 *   prompt: getDefaultTemplate(),
 * });
 * ```
 */
export async function reviseSegment(params: SingleRevisionParams): Promise<RevisionResult> {
  const { segment, prompt, previousSegment, nextSegment, signal } = params;

  // Build prompt variables
  const variables = {
    text: segment.text,
    speaker: segment.speaker,
    previousText: previousSegment?.text,
    nextText: nextSegment?.text,
  };

  // Execute feature with custom prompt
  const result = await executeFeature<string>("text-revision", variables, {
    customPrompt: {
      systemPrompt: prompt.systemPrompt,
      userPromptTemplate: prompt.userPromptTemplate,
    },
    signal,
  });

  if (!result.success || !result.data) {
    console.error("[Revision Service] Revision failed:", result.error);
    return {
      segmentId: segment.id,
      revisedText: segment.text,
      changes: [],
      reasoning: result.error,
    };
  }

  // Parse response (handles LLM artifacts)
  const parseResult = parseTextResponse(result.data, {
    originalText: segment.text,
    detectErrors: true,
  });

  if (parseResult.wasError) {
    console.warn("[Revision Service] AI returned error-like response:", parseResult.warnings);
  }

  const revisedText = parseResult.text;

  // Compute changes
  const changes = computeTextChanges(segment.text, revisedText);
  const changeSummary =
    changes.length > 0 ? summarizeChanges(changes, segment.text, revisedText) : undefined;

  return {
    segmentId: segment.id,
    revisedText,
    changes,
    changeSummary,
  };
}

/**
 * Revise multiple segments in batch with progress tracking.
 *
 * @param params - Batch revision parameters
 * @returns Batch result with all revisions
 */
export async function reviseSegmentsBatch(
  params: BatchRevisionParams,
): Promise<BatchRevisionResult> {
  const { segments, allSegments, prompt, signal, onProgress, onResult } = params;

  const results: RevisionResult[] = [];
  const issues: RevisionIssue[] = [];
  let unchanged = 0;
  let failed = 0;

  // Create index for context lookup
  const segmentIndex = new Map(allSegments.map((s, i) => [s.id, { segment: s, index: i }]));

  for (let i = 0; i < segments.length; i++) {
    // Check for cancellation
    if (signal?.aborted) {
      issues.push({
        level: "warn",
        message: "Revision cancelled by user",
        context: { processed: i, total: segments.length },
      });
      break;
    }

    const segment = segments[i];
    const indexInfo = segmentIndex.get(segment.id);
    const globalIndex = indexInfo?.index ?? -1;

    // Get context segments
    const previousSegment = globalIndex > 0 ? allSegments[globalIndex - 1] : undefined;
    const nextSegment =
      globalIndex < allSegments.length - 1 ? allSegments[globalIndex + 1] : undefined;

    try {
      const result = await reviseSegment({
        segment,
        prompt,
        previousSegment,
        nextSegment,
        signal,
      });

      if (result.changes.length === 0) {
        unchanged++;
      } else {
        results.push(result);
        onResult?.(result);
      }
    } catch (error) {
      failed++;
      issues.push({
        level: "error",
        message: `Failed to revise segment: ${error instanceof Error ? error.message : String(error)}`,
        segmentId: segment.id,
      });
    }

    onProgress?.(i + 1, segments.length);
  }

  return {
    results,
    summary: {
      total: segments.length,
      revised: results.length,
      unchanged,
      failed,
    },
    issues,
  };
}

// ==================== Helper Functions ====================

/**
 * Build revision prompt with context.
 *
 * @param template - Prompt template
 * @param text - Text to revise
 * @param context - Context options
 * @returns Compiled prompt
 */
export function buildRevisionPrompt(
  template: RevisionPrompt,
  text: string,
  context: {
    previousText?: string;
    nextText?: string;
    speaker?: string;
  } = {},
): string {
  return compileTemplate(template.userPromptTemplate, {
    text,
    ...context,
  });
}

/**
 * Check if text was actually changed.
 */
export function hasChanges(original: string, revised: string): boolean {
  return original.trim() !== revised.trim();
}

/**
 * Get a preview of changes (first N characters).
 */
export function getChangePreview(original: string, revised: string, maxLength = 100): string {
  if (!hasChanges(original, revised)) {
    return "No changes";
  }

  const changes = computeTextChanges(original, revised);
  if (changes.length === 0) {
    return "No changes";
  }

  const summary = summarizeChanges(changes, original, revised);
  if (summary.length <= maxLength) {
    return summary;
  }

  return `${summary.slice(0, maxLength - 3)}...`;
}
