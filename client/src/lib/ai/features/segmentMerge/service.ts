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
import { countByConfidence, createSimpleIdContext, processSuggestions } from "./utils";
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
  const { segments, maxTimeGap, minConfidence, sameSpeakerOnly, enableSmoothing, signal } = params;

  logger.info("Starting merge analysis", { segmentCount: segments.length });

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

  // Create simple-id context per batch (simple IDs start at 1 for each batch)
  const idContext = createSimpleIdContext(segments);

  // Build prompt
  const prompt = buildMergePrompt({
    segments,
    maxTimeGap,
    sameSpeakerOnly,
    enableSmoothing: enableSmoothing ? "true" : "false",
    idContext,
  });

  // Check if we have eligible pairs
  if (!hasEligiblePairs(prompt)) {
    logger.warn("No eligible segment pairs found");
    return {
      suggestions: [],
      summary: {
        analyzed: 0,
        found: 0,
        byConfidence: { high: 0, medium: 0, low: 0 },
      },
      issues: [
        ...validationIssues,
        {
          level: "warn",
          message: "No eligible segment pairs found (check time gap and speaker settings)",
        },
      ],
    };
  }

  logger.debug("Built prompt", {
    pairCount: prompt.pairCount,
    variableKeys: Object.keys(prompt.variables),
  });

  try {
    // Execute AI analysis
    const result = await executeFeature<RawMergeSuggestion[]>("segment-merge", prompt.variables, {
      customPrompt: {
        systemPrompt: prompt.systemPrompt,
        userPromptTemplate: prompt.userTemplate,
      },
      signal,
    });

    logger.info("AI execution complete", {
      success: result.success,
      hasData: !!result.data,
    });

    // Process response using new processor
    const processed = processAIResponse(result, {
      idMapping: idContext.mapping,
    });

    // Merge issues from validation and processing
    const allIssues = [...validationIssues, ...processed.issues];

    if (processed.suggestions.length === 0) {
      logger.warn("No suggestions extracted from response");
      return {
        suggestions: [],
        summary: {
          analyzed: segments.length - 1,
          found: 0,
          byConfidence: { high: 0, medium: 0, low: 0 },
        },
        issues: allIssues,
      };
    }

    // Process and filter suggestions
    const processedSuggestions = processSuggestions(processed.suggestions, segments, minConfidence);

    logger.info("Merge analysis complete", {
      found: processedSuggestions.length,
      filtered: processed.suggestions.length - processedSuggestions.length,
    });

    return {
      suggestions: processedSuggestions,
      summary: {
        analyzed: segments.length - 1,
        found: processedSuggestions.length,
        byConfidence: countByConfidence(processedSuggestions),
      },
      issues: allIssues,
    };
  } catch (error) {
    logger.error("Analysis failed with exception", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      suggestions: [],
      summary: {
        analyzed: segments.length - 1,
        found: 0,
        byConfidence: { high: 0, medium: 0, low: 0 },
      },
      issues: [
        ...validationIssues,
        {
          level: "error",
          message: error instanceof Error ? error.message : "Analysis failed",
        },
      ],
    };
  }
}
