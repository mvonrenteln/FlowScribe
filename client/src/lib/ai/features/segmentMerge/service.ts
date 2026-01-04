/**
 * Segment Merge Service
 *
 * Service for analyzing transcript segments and suggesting merges using AI.
 * Uses the unified AI module for execution.
 *
 * @module ai/features/segmentMerge/service
 */

import { executeFeature } from "@/lib/ai";
import { parseResponse } from "@/lib/ai/parsing/responseParser";
import { getMergeSystemPrompt, getMergeUserTemplate } from "./config";
import { mergeResponseSchema } from "./config";
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

    console.log("[AISegmentMerge] Raw executeFeature result:", {
      success: result.success,
      hasData: !!result.data,
      error: result.error,
      metadata: result.metadata,
    });

    // Determine raw content to inspect: prefer result.data if present, otherwise rawResponse
    const rawResponse = (result as any).rawResponse ?? null;
    const debugEnabled = (globalThis as any).__AISegmentMergeDebug === true;
    if (debugEnabled) {
      console.warn("[AISegmentMerge][DEBUG] debugEnabled = true");
      if (rawResponse !== null) {
        console.warn("[AISegmentMerge][DEBUG] Full rawResponse:", rawResponse);
      }
    }
    let parsedData: RawMergeSuggestion[] | undefined = undefined;

    // If provider returned parsed data directly (success), use it
    if (result.success && result.data) {
      parsedData = result.data as unknown as RawMergeSuggestion[];
    } else if (rawResponse !== null) {
      // Try to leniently parse raw response (string or object)
      const rawText = typeof rawResponse === "string" ? rawResponse : JSON.stringify(rawResponse);
      console.warn("[AISegmentMerge] executeFeature returned error:", result.error);
      console.warn("[AISegmentMerge] Raw response preview:", rawText.slice(0, 2000));

      // 1) Try parseResponse leniently with schema
      const lenientParsed = parseResponse<RawMergeSuggestion[]>(rawText, {
        schema: mergeResponseSchema,
        applyDefaults: true,
        jsonOptions: { lenient: true },
      });

      if (lenientParsed.success && lenientParsed.data) {
        console.warn("[AISegmentMerge] Lenient parsed data usable, proceeding with that");
        parsedData = lenientParsed.data;
        if (lenientParsed.metadata.warnings.length) {
          console.warn("[AISegmentMerge] Lenient parse warnings:", lenientParsed.metadata.warnings);
        }
      } else {
        console.warn("[AISegmentMerge] Lenient parse failed or returned no data:", lenientParsed.error?.message);

        // 2) Try recoverPartialArray to extract items from messy output
        try {
          const { recoverPartialArray } = await import("@/lib/ai/parsing/responseParser");
          const isRawSuggestion = (item: unknown): item is RawMergeSuggestion => {
            return (
              typeof item === "object" &&
              item !== null &&
              // segmentIds may be string|number|array, check presence
              ("segmentIds" in (item as any) || "segmentId" in (item as any))
            );
          };

          const { recovered, skipped } = recoverPartialArray<RawMergeSuggestion>(rawText, isRawSuggestion);
          if (recovered.length > 0) {
            console.warn("[AISegmentMerge] Recovered partial suggestions:", { recoveredCount: recovered.length, skipped });
            // Normalize recovered items to expected RawMergeSuggestion shape
            parsedData = recovered.map((r) => {
              // Ensure segmentIds is array of strings
              let sids: unknown = (r as any).segmentIds ?? (r as any).segmentId ?? [];
              if (!Array.isArray(sids)) sids = [sids];
              const sidsStr = (sids as any[]).map((v) => String(v));
              return {
                segmentIds: sidsStr,
                confidence: (r as any).confidence ?? 0.5,
                reason: (r as any).reason ?? (r as any).reason ?? "",
                smoothedText: (r as any).smoothedText,
                smoothingChanges: (r as any).smoothingChanges,
              } as RawMergeSuggestion;
            });
          } else {
            console.warn("[AISegmentMerge] No recoverable suggestions found in raw response");

            // Final fallback: try to extract first JSON array substring from the rawText
            try {
              const firstBracket = rawText.indexOf("[");
              const lastBracket = rawText.lastIndexOf("]");
              if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                const jsonCandidate = rawText.slice(firstBracket, lastBracket + 1);
                try {
                  const parsedCandidate = JSON.parse(jsonCandidate);
                  if (Array.isArray(parsedCandidate) && parsedCandidate.length > 0) {
                    console.warn("[AISegmentMerge] Parsed JSON array candidate from raw text, using as recovered data");
                    parsedData = (parsedCandidate as any[]).map((r) => {
                      let sids: unknown = r.segmentIds ?? r.segmentId ?? [];
                      if (!Array.isArray(sids)) sids = [sids];
                      const sidsStr = (sids as any[]).map((v) => String(v));
                      return {
                        segmentIds: sidsStr,
                        confidence: r.confidence ?? 0.5,
                        reason: r.reason ?? "",
                        smoothedText: r.smoothedText,
                        smoothingChanges: r.smoothingChanges ?? r.smoothing_changes,
                      } as RawMergeSuggestion;
                    });
                  }
                } catch (jsonEx) {
                  console.warn("[AISegmentMerge] JSON.parse of candidate failed:", jsonEx instanceof Error ? jsonEx.message : String(jsonEx));
                }
              }
            } catch (ex) {
              console.warn("[AISegmentMerge] JSON array fallback extraction failed:", ex instanceof Error ? ex.message : String(ex));
            }
          }
        } catch (ex) {
          console.warn("[AISegmentMerge] recoverPartialArray failed:", ex instanceof Error ? ex.message : String(ex));
        }
      }
    }

    if (!parsedData) {
      // No usable data found — record issue and exit
      issues.push({ level: "error", message: result.error || "Failed to analyze segments" });
      return {
        suggestions: [],
        summary: { analyzed: segments.length - 1, found: 0, byConfidence: { high: 0, medium: 0, low: 0 } },
        issues,
      };
    }

    // At this point we have parsedData (array of RawMergeSuggestion)
    // Process raw suggestions
    const suggestions = processSuggestions(parsedData, segments, minConfidence);
    const byConfidence = countByConfidence(suggestions);

    console.log("[AISegmentMerge] Suggestions after processing:", {
      total: suggestions.length,
      byConfidence,
    });

    return {
      suggestions,
      summary: { analyzed: segments.length - 1, found: suggestions.length, byConfidence },
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
