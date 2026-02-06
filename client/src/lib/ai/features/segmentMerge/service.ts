/**
 * Segment Merge Service
 *
 * Service for analyzing transcript segments and suggesting merges using AI.
 * Uses the unified AI module for execution.
 *
 * @module ai/features/segmentMerge/service
 */

import { executeFeature } from "@/lib/ai";
import { runBatchCoordinator } from "@/lib/ai/core/batch";
import { compileTemplate } from "@/lib/ai/prompts";
import { createLogger } from "@/lib/logging";
import {
  getEffectiveAIRequestConcurrency,
  initializeSettings,
} from "@/lib/settings/settingsStorage";
import { buildMergePrompt, hasEligiblePairs } from "./promptBuilder";
import { extractRawResponse, processAIResponse } from "./responseProcessor";
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
    providerId,
    model,
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

  // Process each batch (coordinated with ordered emissions)
  const allSuggestions: RawMergeSuggestion[] = [];
  const allIssues: MergeAnalysisIssue[] = [...validationIssues];
  let totalAnalyzed = 0;
  const analyzedCounts = batches.map((batch) => Math.max(0, batch.length - 1));
  const analyzedOffsets = analyzedCounts.reduce<number[]>((acc, _count, index) => {
    const prev = index === 0 ? 0 : acc[index - 1] + analyzedCounts[index - 1];
    acc.push(prev);
    return acc;
  }, []);
  const totalExpected = Math.max(0, segments.length - 1);

  // Use explicit `batchConcurrency` when provided. The RHS is lazily evaluated
  // due to `??` semantics, so `initializeSettings()` is only called when
  // `params.batchConcurrency` is `null` or `undefined` (avoid unnecessary I/O).
  const concurrency =
    params.batchConcurrency ?? getEffectiveAIRequestConcurrency(initializeSettings());

  await runBatchCoordinator({
    inputs: batches,
    concurrency: Math.max(1, concurrency),
    signal,
    prepareYieldEvery: 5,
    emitYieldEvery: 5,
    prepare: (batch, batchIndex) => {
      logger.debug(`Preparing batch ${batchIndex + 1}/${batches.length}`);

      const idContext = createSimpleIdContext(batch);
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

      const requestPayload = `SYSTEM\n${compileTemplate(
        prompt.systemPrompt,
        prompt.variables,
      )}\n\nUSER\n${compileTemplate(prompt.userTemplate, prompt.variables)}`;

      return {
        batchIndex,
        batch,
        idContext,
        prompt,
        requestPayload,
        analyzedCount: analyzedCounts[batchIndex] ?? 0,
        processedBefore: analyzedOffsets[batchIndex] ?? 0,
      };
    },
    execute: async (plan) => {
      const batchStart = Date.now();

      if (!hasEligiblePairs(plan.prompt)) {
        logger.debug(`Batch ${plan.batchIndex + 1}: No eligible pairs`);
        return {
          status: "skipped" as const,
          plan,
          batchDurationMs: Date.now() - batchStart,
        };
      }

      const result = await executeFeature<RawMergeSuggestion[]>(
        "segment-merge",
        plan.prompt.variables,
        {
          providerId,
          model,
          customPrompt: {
            systemPrompt: plan.prompt.systemPrompt,
            userPromptTemplate: plan.prompt.userTemplate,
          },
          signal,
          onRetry: (retryInfo) => {
            if (onProgress && plan.prompt.pairCount > 0) {
              const retryLogEntry: MergeBatchLogEntry = {
                batchIndex: plan.batchIndex + 1,
                pairCount: plan.prompt.pairCount,
                rawItemCount: 0,
                normalizedCount: 0,
                suggestionCount: 0,
                processedTotal: plan.processedBefore,
                totalExpected,
                issues: [
                  {
                    level: "warn",
                    message: `Retry ${retryInfo.attempt} - ${retryInfo.errorMessage}`,
                  },
                ],
                batchDurationMs: retryInfo.attemptDurationMs,
                fatal: false,
                requestPayload: plan.requestPayload,
              };
              onProgress({
                batchIndex: plan.batchIndex + 1,
                totalBatches: batches.length,
                batchSuggestions: [],
                processedCount: plan.processedBefore,
                batchLogEntry: retryLogEntry,
              });
            }
          },
        },
      );

      logger.info(`Batch ${plan.batchIndex + 1} AI execution complete`, {
        success: result.success,
        hasData: !!result.data,
      });

      const responsePayload = extractRawResponse(result) ?? undefined;

      if (!result.success || !result.data) {
        const batchIssue: MergeAnalysisIssue = {
          level: "error",
          message: result.error ?? `Batch ${plan.batchIndex + 1} failed`,
          context: { errorCode: result.errorCode },
        };
        return {
          status: "failed" as const,
          plan,
          batchIssue,
          batchDurationMs: Date.now() - batchStart,
          responsePayload,
        };
      }

      const processed = processAIResponse(result, {
        idMapping: plan.idContext.mapping,
        enableSmoothing,
      });

      return {
        status: "success" as const,
        plan,
        processed,
        batchDurationMs: Date.now() - batchStart,
        responsePayload,
      };
    },
    onItemComplete: (_batchIndex, outcome) => {
      const { plan } = outcome;
      totalAnalyzed = plan.processedBefore + plan.analyzedCount;

      if (outcome.status === "skipped") {
        return;
      }

      if (outcome.status === "failed") {
        const batchIssue = outcome.batchIssue;
        logger.error(`Batch ${plan.batchIndex + 1} failed`, {
          error: batchIssue.message,
        });
        allIssues.push(batchIssue);

        if (onProgress && plan.prompt.pairCount > 0) {
          onProgress({
            batchIndex: plan.batchIndex + 1,
            totalBatches: batches.length,
            batchSuggestions: [],
            processedCount: totalAnalyzed,
            batchLogEntry: {
              batchIndex: plan.batchIndex + 1,
              pairCount: plan.prompt.pairCount,
              rawItemCount: 0,
              normalizedCount: 0,
              suggestionCount: 0,
              processedTotal: totalAnalyzed,
              totalExpected,
              issues: [batchIssue],
              batchDurationMs: outcome.batchDurationMs,
              fatal: true,
              requestPayload: plan.requestPayload,
              responsePayload: outcome.responsePayload,
            },
          });
        }
        return;
      }

      const processed = outcome.processed;
      allSuggestions.push(...processed.suggestions);
      allIssues.push(...processed.issues);

      const batchProcessedSuggestions = processSuggestions(
        processed.suggestions,
        segments,
        minConfidence,
      );

      const batchLogEntry: MergeBatchLogEntry = {
        batchIndex: plan.batchIndex + 1,
        pairCount: plan.prompt.pairCount,
        rawItemCount: processed.rawItemCount,
        normalizedCount: processed.normalizedCount,
        suggestionCount: batchProcessedSuggestions.length,
        processedTotal: totalAnalyzed,
        totalExpected,
        issues: processed.issues,
        batchDurationMs: outcome.batchDurationMs,
        fatal: processed.issues.some((issue) => issue.level === "error"),
        requestPayload: plan.requestPayload,
        responsePayload: outcome.responsePayload,
      };

      if (onProgress && plan.prompt.pairCount > 0) {
        onProgress({
          batchIndex: plan.batchIndex + 1,
          totalBatches: batches.length,
          batchSuggestions: batchProcessedSuggestions,
          processedCount: totalAnalyzed,
          batchLogEntry,
        });
      }
    },
  });

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
