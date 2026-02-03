/**
 * Segment Merge Service
 *
 * Service for analyzing transcript segments and suggesting merges using AI.
 * Uses the unified AI module for execution.
 *
 * @module ai/features/segmentMerge/service
 */

import { executeFeature } from "@/lib/ai";
import { createLogger } from "@/lib/logging";
import { buildMergePrompt, hasEligiblePairs } from "./promptBuilder";
import { processAIResponse } from "./responseProcessor";
import type {
  MergeAnalysisIssue,
  MergeAnalysisParams,
  MergeAnalysisResult,
  MergeBatchLogEntry,
  RawMergeSuggestion,
} from "./types";
import {
  countByConfidence,
  createSegmentBatches,
  createSimpleIdContext,
  processSuggestions,
} from "./utils";
import { hasValidationErrors, mergeValidationRules, validateWithRules } from "./validation";

const logger = createLogger({ feature: "SegmentMerge" });

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
  const {
    segments,
    maxTimeGap,
    minConfidence,
    sameSpeakerOnly,
    enableSmoothing,
    batchSize = 10,
    skipPairKeys,
    signal,
    onProgress,
    systemPrompt,
    userTemplate,
  } = params;

  logger.info("Starting merge analysis", {
    segmentCount: segments.length,
    batchSize,
  });

  // Validate input
  const validationIssues = validateWithRules(segments, mergeValidationRules);

  if (hasValidationErrors(validationIssues)) {
    logger.warn("Validation failed", { issues: validationIssues });
    return {
      suggestions: [],
      summary: {
        analyzed: 0,
        found: 0,
        byConfidence: { high: 0, medium: 0, low: 0 },
      },
      issues: validationIssues,
    };
  }

  // Split segments into batches
  const batches = createSegmentBatches(segments, batchSize, sameSpeakerOnly);

  logger.info(`Processing ${batches.length} batches of up to ${batchSize} segments each`);

  // Process each batch
  const allSuggestions: RawMergeSuggestion[] = [];
  const allIssues: MergeAnalysisIssue[] = [...validationIssues];
  let totalAnalyzed = 0;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchStart = Date.now();

    logger.debug(`Processing batch ${batchIndex + 1}/${batches.length}`);

    // Create simple-id context per batch (simple IDs start at 1 for each batch)
    const idContext = createSimpleIdContext(batch);

    // Build prompt for this batch
    const prompt = buildMergePrompt({
      segments: batch,
      maxTimeGap,
      sameSpeakerOnly,
      enableSmoothing: enableSmoothing ? "true" : "false",
      idContext,
      skipPairKeys,
      systemPrompt,
      userTemplate,
    });

    // Check if we have eligible pairs
    if (!hasEligiblePairs(prompt)) {
      logger.debug(`Batch ${batchIndex + 1}: No eligible pairs`);
      totalAnalyzed += batch.length - 1;

      // Do not emit noisy batch log entries when there are zero pairs
      // and no issues to report. This prevents cluttering the UI with
      // many "Expected 0 / Returned 0" rows for batches that cannot
      // produce any pair analysis (e.g. single-segment batches).
      continue;
    }

    try {
      // Execute AI analysis for this batch
      const result = await executeFeature<RawMergeSuggestion[]>("segment-merge", prompt.variables, {
        customPrompt: {
          systemPrompt: prompt.systemPrompt,
          userPromptTemplate: prompt.userTemplate,
        },
        signal,
        onRetry: (retryInfo) => {
          // Report retry attempt in batch log
          if (onProgress && prompt.pairCount > 0) {
            const retryLogEntry: MergeBatchLogEntry = {
              batchIndex: batchIndex + 1,
              pairCount: prompt.pairCount,
              rawItemCount: 0,
              normalizedCount: 0,
              suggestionCount: 0,
              processedTotal: totalAnalyzed,
              totalExpected: segments.length - 1,
              issues: [
                {
                  level: "warn",
                  message: `Retry ${retryInfo.attempt} - ${retryInfo.errorMessage}`,
                },
              ],
              batchDurationMs: retryInfo.attemptDurationMs,
              fatal: false,
            };
            onProgress({
              batchIndex: batchIndex + 1,
              totalBatches: batches.length,
              batchSuggestions: [],
              processedCount: totalAnalyzed,
              batchLogEntry: retryLogEntry,
            });
          }
        },
      });

      logger.info(`Batch ${batchIndex + 1} AI execution complete`, {
        success: result.success,
        hasData: !!result.data,
      });

      // Process response using new processor
      const processed = processAIResponse(result, {
        idMapping: idContext.mapping,
        enableSmoothing,
      });

      allSuggestions.push(...processed.suggestions);
      allIssues.push(...processed.issues);
      totalAnalyzed += batch.length - 1;

      // Process and filter suggestions for this batch
      const batchProcessedSuggestions = processSuggestions(
        processed.suggestions,
        segments,
        minConfidence,
      );

      const batchLogEntry: MergeBatchLogEntry = {
        batchIndex: batchIndex + 1,
        pairCount: prompt.pairCount,
        rawItemCount: processed.rawItemCount,
        normalizedCount: processed.normalizedCount,
        suggestionCount: batchProcessedSuggestions.length,
        processedTotal: totalAnalyzed,
        totalExpected: segments.length - 1,
        issues: processed.issues,
        batchDurationMs: Date.now() - batchStart,
        fatal: processed.issues.some((issue) => issue.level === "error"),
      };

      // Notify progress after each batch — only for batches that actually had pairs
      if (onProgress && prompt.pairCount > 0) {
        onProgress({
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          batchSuggestions: batchProcessedSuggestions,
          processedCount: totalAnalyzed,
          batchLogEntry,
        });
      }
    } catch (error) {
      const batchIssue: MergeAnalysisIssue = {
        level: "error",
        message: `Batch ${batchIndex + 1} failed: ${error instanceof Error ? error.message : String(error)}`,
      };
      logger.error(`Batch ${batchIndex + 1} failed`, {
        error: batchIssue.message,
      });
      allIssues.push(batchIssue);
      totalAnalyzed += batch.length - 1;

      // Only report failures for batches that were actually analyzed (had pairs)
      if (onProgress && prompt.pairCount > 0) {
        onProgress({
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          batchSuggestions: [],
          processedCount: totalAnalyzed,
          batchLogEntry: {
            batchIndex: batchIndex + 1,
            pairCount: prompt.pairCount,
            rawItemCount: 0,
            normalizedCount: 0,
            suggestionCount: 0,
            processedTotal: totalAnalyzed,
            totalExpected: segments.length - 1,
            issues: [batchIssue],
            batchDurationMs: Date.now() - batchStart,
            fatal: true,
          },
        });
      }
    }
  }

  if (allSuggestions.length === 0) {
    logger.warn("No suggestions extracted from any batch");
    return {
      suggestions: [],
      summary: {
        analyzed: totalAnalyzed,
        found: 0,
        byConfidence: { high: 0, medium: 0, low: 0 },
      },
      issues: allIssues,
    };
  }

  // Process and filter suggestions
  const processedSuggestions = processSuggestions(allSuggestions, segments, minConfidence);

  logger.info("Merge analysis complete", {
    batches: batches.length,
    found: processedSuggestions.length,
    filtered: allSuggestions.length - processedSuggestions.length,
  });

  return {
    suggestions: processedSuggestions,
    summary: {
      analyzed: totalAnalyzed,
      found: processedSuggestions.length,
      byConfidence: countByConfidence(processedSuggestions),
    },
    issues: allIssues,
  };
}
