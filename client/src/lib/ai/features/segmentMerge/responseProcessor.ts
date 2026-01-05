/**
 * Segment Merge Response Processor
 *
 * Processes AI responses for segment merge analysis.
 * Handles data extraction, normalization, and recovery.
 *
 * @module ai/features/segmentMerge/responseProcessor
 */

import type { BatchPairMapping } from "@/lib/ai/core/batchIdMapping";
import type { AIFeatureResult } from "@/lib/ai/core/types";
import { createLogger } from "@/lib/ai/logging/loggingService";
import {
  applyRecoveryStrategies,
  createStandardStrategies,
} from "@/lib/ai/parsing/recoveryStrategies";
import { mergeResponseSchema } from "./config";
import type { MergeAnalysisIssue, RawMergeSuggestion } from "./types";
import { normalizeRawSuggestion } from "./utils";

const logger = createLogger({ feature: "SegmentMerge" });

/**
 * Type guard for raw merge suggestions
 *
 * Only accepts formats that can be properly validated:
 * - segmentIds: explicit array of IDs
 * - segmentId: single ID
 * - mergeId: numeric ID that maps to a pair
 * - pairIndex: explicit pair index
 *
 * Does NOT accept segmentA/segmentB format as it cannot be validated.
 */
export function isRawMergeSuggestion(item: unknown): item is RawMergeSuggestion {
  return (
    typeof item === "object" &&
    item !== null &&
    ("segmentIds" in item || "segmentId" in item || "mergeId" in item || "pairIndex" in item)
  );
}

/**
 * Options for response processing
 */
export interface ResponseProcessOptions {
  /**
   * ID mapping for converting simple IDs to real IDs
   */
  idMapping: BatchPairMapping;

  /**
   * Enable detailed debug logging
   */
  enableDebug?: boolean;
}

/**
 * Result of response processing
 */
export interface ProcessedResponse {
  /**
   * Normalized suggestions (empty if processing failed)
   */
  suggestions: RawMergeSuggestion[];

  /**
   * Issues encountered during processing
   */
  issues: MergeAnalysisIssue[];

  /**
   * Recovery strategy used (if any)
   */
  recoveryStrategy?: string;
}

/**
 * Extract raw response content from AI result
 */
export function extractRawResponse(result: AIFeatureResult<any>): string | null {
  const rawResponse = (result as any).rawResponse ?? null;

  if (rawResponse === null) {
    return null;
  }

  return typeof rawResponse === "string" ? rawResponse : JSON.stringify(rawResponse);
}

/**
 * Normalize recovered item to RawMergeSuggestion format
 *
 * NOTE: This function should NOT extract IDs from segmentA/segmentB objects,
 * as these cannot be validated and may cause incorrect segment assignment.
 * Only use segmentIds array, pairIndex, or mergeId which can be validated
 * through the ID mapping.
 */
export function normalizeRecoveredItem(item: any): RawMergeSuggestion {
  // Extract segment IDs - only from explicit segmentIds field
  let sids: unknown = item.segmentIds ?? item.segmentId ?? [];

  if (!Array.isArray(sids)) {
    sids = [sids];
  }
  const segmentIds = (sids as any[]).map((v) => String(v));

  // Extract confidence
  const confidence = typeof item.confidence === "number" ? item.confidence : 0.5;

  // Extract reason
  const reason = item.reason ?? item.explanation ?? "";

  // Extract smoothing data (also check mergedText as alternative)
  const smoothedText = item.smoothedText ?? item.smoothed_text ?? item.mergedText;
  const smoothingChanges = item.smoothingChanges ?? item.smoothing_changes;

  return {
    segmentIds,
    confidence,
    reason,
    smoothedText,
    smoothingChanges,
  };
}

/**
 * Process AI response and extract normalized suggestions
 *
 * Handles successful responses, recovery strategies, and error cases.
 *
 * @param result - AI feature execution result
 * @param options - Processing options
 * @returns Processed response with suggestions and issues
 *
 * @example
 * ```ts
 * const processed = processAIResponse(result, {
 *   idMapping: { "1": "real-id-1", "2": "real-id-2" },
 * });
 *
 * if (processed.suggestions.length > 0) {
 *   console.log(`Found ${processed.suggestions.length} suggestions`);
 * }
 * ```
 */
export function processAIResponse(
  result: AIFeatureResult<any>,
  options: ResponseProcessOptions,
): ProcessedResponse {
  const { idMapping } = options;
  const issues: MergeAnalysisIssue[] = [];
  let parsedData: any[] | undefined;
  let recoveryStrategy: string | undefined;

  logger.info("Processing AI response", {
    success: result.success,
    hasData: !!result.data,
    hasError: !!result.error,
  });

  // Log debug info if enabled
  if (logger.isDebugEnabled) {
    const rawResponse = extractRawResponse(result);
    logger.debug("Full raw response", {
      rawResponse: rawResponse?.slice(0, 5000),
      metadata: result.metadata,
    });
  }

  // 1. Try to use direct result data (if successful)
  if (result.success && result.data) {
    logger.info("Using direct result data");
    parsedData = result.data as any[];
  }
  // 2. Try recovery strategies
  else {
    const rawResponse = extractRawResponse(result);

    if (!rawResponse) {
      logger.warn("No raw response available for recovery");
      issues.push({
        level: "error",
        message: result.error || "Failed to analyze segments",
      });
      return { suggestions: [], issues };
    }

    logger.warn("Attempting recovery strategies", {
      error: result.error,
      responsePreview: rawResponse.slice(0, 2000),
    });

    // Create and apply recovery strategies
    const strategies = createStandardStrategies(mergeResponseSchema, isRawMergeSuggestion);

    const recoveryResult = applyRecoveryStrategies(rawResponse, strategies);

    if (recoveryResult.data && recoveryResult.data.length > 0) {
      logger.info("Recovery successful", {
        strategy: recoveryResult.usedStrategy,
        count: recoveryResult.data.length,
      });

      parsedData = recoveryResult.data.map(normalizeRecoveredItem);
      recoveryStrategy = recoveryResult.usedStrategy ?? undefined;

      issues.push({
        level: "warn",
        message: `Data recovered using ${recoveryResult.usedStrategy} strategy`,
      });
    } else {
      logger.error("All recovery strategies failed", {
        attemptedStrategies: recoveryResult.attemptedStrategies,
      });

      issues.push({
        level: "error",
        message: result.error || "Failed to parse AI response",
      });

      return { suggestions: [], issues };
    }
  }

  // 3. Normalize using ID mapping
  const normalizedSuggestions: RawMergeSuggestion[] = [];

  if (!parsedData) {
    // This should never happen due to earlier check, but TypeScript needs assurance
    return { suggestions: [], issues };
  }

  for (const raw of parsedData) {
    const normalized = normalizeRawSuggestion(raw, idMapping);

    if (normalized) {
      normalizedSuggestions.push(normalized);
    } else {
      logger.debug("Failed to normalize suggestion", { raw });
      issues.push({
        level: "warn",
        message: "Some suggestions could not be normalized",
      });
    }
  }

  logger.info("Response processing complete", {
    totalParsed: parsedData.length,
    normalized: normalizedSuggestions.length,
    issues: issues.length,
  });

  return {
    suggestions: normalizedSuggestions,
    issues,
    recoveryStrategy,
  };
}
