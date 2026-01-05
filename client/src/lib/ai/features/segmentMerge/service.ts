/**
 * Segment Merge Service
 *
 * Service for analyzing transcript segments and suggesting merges using AI.
 * Uses the unified AI module for execution.
 *
 * @module ai/features/segmentMerge/service
 */

import { executeFeature } from "@/lib/ai";
import { createLogger } from "@/lib/ai/logging/loggingService";
import { buildMergePrompt, hasEligiblePairs } from "./promptBuilder";
import { processAIResponse } from "./responseProcessor";
import type {
  MergeAnalysisIssue,
  MergeAnalysisParams,
  MergeAnalysisResult,
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
      systemPrompt,
      userTemplate,
    });

    // Check if we have eligible pairs
    if (!hasEligiblePairs(prompt)) {
      logger.debug(`Batch ${batchIndex + 1}: No eligible pairs`);
      totalAnalyzed += batch.length - 1;

      // Notify progress even if no pairs
      if (onProgress) {
        onProgress({
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          batchSuggestions: [],
          processedCount: totalAnalyzed,
        });
      }
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
      });

      logger.info(`Batch ${batchIndex + 1} AI execution complete`, {
        success: result.success,
        hasData: !!result.data,
      });

      // Process response using new processor
      const processed = processAIResponse(result, {
        idMapping: idContext.mapping,
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

      // Notify progress after each batch
      if (onProgress) {
        onProgress({
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          batchSuggestions: batchProcessedSuggestions,
          processedCount: totalAnalyzed,
        });
      }
    } catch (error) {
      logger.error(`Batch ${batchIndex + 1} failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
      allIssues.push({
        level: "error",
        message: `Batch ${batchIndex + 1} failed: ${error instanceof Error ? error.message : String(error)}`,
      });
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
