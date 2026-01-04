/**
 * Segment Merge Service
 *
 * Service for analyzing transcript segments and suggesting merges using AI.
 * Uses the unified AI module for execution.
 *
 * @module ai/features/segmentMerge/service
 */

import { executeFeature } from "@/lib/ai";
import { getMergeSystemPrompt, getMergeUserTemplate } from "./config";
import type {
  BatchMergeAnalysisParams,
  MergeAnalysisIssue,
  MergeAnalysisParams,
  MergeAnalysisResult,
  MergeAnalysisSegment,
  MergeSuggestion,
  RawMergeSuggestion,
} from "./types";
import {
  countByConfidence,
  formatSegmentPairsForPrompt,
  formatSegmentsForPrompt,
  processSuggestions,
} from "./utils";

// ==================== Main Analysis Function ====================

/**
 * Analyze segments for merge candidates.
 *
 * @param params - Analysis parameters
 * @returns Analysis result with suggestions
 *
 * @example
 * ```ts
 * const result = await analyzeMergeCandidates({
 *   segments: transcriptSegments,
 *   maxTimeGap: 2.0,
 *   minConfidence: "medium",
 *   sameSpeakerOnly: true,
 *   enableSmoothing: true,
 * });
 *
 * console.log(`Found ${result.suggestions.length} merge candidates`);
 * ```
 */
export async function analyzeMergeCandidates(
  params: MergeAnalysisParams,
): Promise<MergeAnalysisResult> {
  const { segments, maxTimeGap, minConfidence, sameSpeakerOnly, enableSmoothing, signal } = params;

  const issues: MergeAnalysisIssue[] = [];

  // Validate input
  if (segments.length < 2) {
    return {
      suggestions: [],
      summary: {
        analyzed: 0,
        found: 0,
        byConfidence: { high: 0, medium: 0, low: 0 },
      },
      issues: [
        {
          level: "warn",
          message: "At least 2 segments required for merge analysis",
        },
      ],
    };
  }

  // Build prompt variables
  const segmentPairs = formatSegmentPairsForPrompt(segments, maxTimeGap, sameSpeakerOnly);
  const segmentsFormatted = formatSegmentsForPrompt(segments);

  if (!segmentPairs.trim()) {
    return {
      suggestions: [],
      summary: {
        analyzed: 0,
        found: 0,
        byConfidence: { high: 0, medium: 0, low: 0 },
      },
      issues: [
        {
          level: "warn",
          message: "No eligible segment pairs found (check time gap and speaker settings)",
        },
      ],
    };
  }

  const variables = {
    segmentPairs,
    segments: segmentsFormatted,
    maxTimeGap: maxTimeGap.toString(),
    enableSmoothing,
  };

  // Get appropriate prompt template
  const userTemplate = getMergeUserTemplate(segments.length);
  const systemPrompt = getMergeSystemPrompt();

  try {
    // Execute AI analysis
    const result = await executeFeature<RawMergeSuggestion[]>("segment-merge", variables, {
      customPrompt: {
        systemPrompt,
        userPromptTemplate: userTemplate,
      },
      signal,
    });

    if (!result.success || !result.data) {
      issues.push({
        level: "error",
        message: result.error || "Failed to analyze segments",
      });

      return {
        suggestions: [],
        summary: {
          analyzed: segments.length - 1,
          found: 0,
          byConfidence: { high: 0, medium: 0, low: 0 },
        },
        issues,
      };
    }

    // Process raw suggestions
    const suggestions = processSuggestions(result.data, segments, minConfidence);
    const byConfidence = countByConfidence(suggestions);

    return {
      suggestions,
      summary: {
        analyzed: segments.length - 1,
        found: suggestions.length,
        byConfidence,
      },
      issues,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      issues.push({
        level: "warn",
        message: "Analysis cancelled by user",
      });
    } else {
      issues.push({
        level: "error",
        message: error instanceof Error ? error.message : "Unknown error during analysis",
      });
    }

    return {
      suggestions: [],
      summary: {
        analyzed: 0,
        found: 0,
        byConfidence: { high: 0, medium: 0, low: 0 },
      },
      issues,
    };
  }
}

// ==================== Batch Analysis ====================

/**
 * Analyze segments in batches with progress tracking.
 *
 * @param params - Batch analysis parameters
 * @returns Combined analysis result
 */
export async function analyzeMergeCandidatesBatch(
  params: BatchMergeAnalysisParams,
): Promise<MergeAnalysisResult> {
  const {
    segments,
    maxTimeGap,
    minConfidence,
    sameSpeakerOnly,
    enableSmoothing,
    batchSize,
    signal,
    onProgress,
    onSuggestions,
  } = params;

  const allSuggestions: MergeSuggestion[] = [];
  const allIssues: MergeAnalysisIssue[] = [];
  let totalAnalyzed = 0;

  // Calculate batches (overlap by 1 to catch cross-batch merges)
  const batches = createBatches(segments, batchSize);
  const totalBatches = batches.length;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    // Check for cancellation
    if (signal?.aborted) {
      allIssues.push({
        level: "warn",
        message: `Analysis cancelled after ${batchIndex} batches`,
      });
      break;
    }

    const batchSegments = batches[batchIndex];

    try {
      const result = await analyzeMergeCandidates({
        segments: batchSegments,
        maxTimeGap,
        minConfidence,
        sameSpeakerOnly,
        enableSmoothing,
        signal,
      });

      // Collect suggestions (dedupe by segment IDs)
      const newSuggestions = result.suggestions.filter(
        (s) =>
          !allSuggestions.some(
            (existing) =>
              existing.segmentIds[0] === s.segmentIds[0] &&
              existing.segmentIds[1] === s.segmentIds[1],
          ),
      );

      allSuggestions.push(...newSuggestions);
      allIssues.push(...result.issues);
      totalAnalyzed += result.summary.analyzed;

      // Callbacks
      if (newSuggestions.length > 0) {
        onSuggestions?.(newSuggestions);
      }

      onProgress?.(batchIndex + 1, totalBatches);
    } catch (error) {
      allIssues.push({
        level: "error",
        message: `Batch ${batchIndex + 1} failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  const byConfidence = countByConfidence(allSuggestions);

  return {
    suggestions: allSuggestions,
    summary: {
      analyzed: totalAnalyzed,
      found: allSuggestions.length,
      byConfidence,
    },
    issues: allIssues,
  };
}

// ==================== Helper Functions ====================

/**
 * Create batches of segments with overlap.
 *
 * @param segments - All segments
 * @param batchSize - Size of each batch
 * @returns Array of segment batches
 */
function createBatches(
  segments: MergeAnalysisSegment[],
  batchSize: number,
): MergeAnalysisSegment[][] {
  if (segments.length <= batchSize) {
    return [segments];
  }

  const batches: MergeAnalysisSegment[][] = [];
  // Overlap by 1 to catch merges at batch boundaries
  const step = batchSize - 1;

  for (let i = 0; i < segments.length; i += step) {
    const batch = segments.slice(i, i + batchSize);
    if (batch.length >= 2) {
      batches.push(batch);
    }
  }

  return batches;
}

/**
 * Get a preview of what merged text would look like.
 *
 * @param suggestion - Merge suggestion
 * @returns Preview text (smoothed if available, otherwise merged)
 */
export function getMergePreview(suggestion: MergeSuggestion): string {
  if (suggestion.smoothing?.applied) {
    return suggestion.smoothing.smoothedText;
  }
  return suggestion.mergedText;
}

/**
 * Check if a suggestion has smoothing changes.
 *
 * @param suggestion - Merge suggestion
 * @returns True if smoothing was applied
 */
export function hasSmoothingChanges(suggestion: MergeSuggestion): boolean {
  return (
    suggestion.smoothing?.applied === true &&
    suggestion.smoothing.smoothedText !== suggestion.smoothing.originalConcatenated
  );
}
