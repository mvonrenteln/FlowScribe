/**
 * Text Revision Service
 *
 * Service for revising transcript segments using AI.
 * Uses the unified AI module for execution.
 *
 * @module ai/features/revision/service
 */

import { createLogger } from "@/lib/logging";
import {
  getEffectiveAIRequestConcurrency,
  initializeSettings,
} from "@/lib/settings/settingsStorage";
import { computeTextChanges, summarizeChanges } from "../../../diffUtils";
import {
  AIError,
  executeFeature,
  formatResponsePayload,
  runBatchCoordinator,
  toAIError,
} from "../../core";
import { parseTextResponse } from "../../parsing";
import { compileTemplate } from "../../prompts";

import type {
  BatchRevisionParams,
  BatchRevisionResult,
  RevisionBatchLogEntry,
  RevisionIssue,
  RevisionPrompt,
  RevisionResult,
  SingleRevisionParams,
} from "./types";

const logger = createLogger({ feature: "RevisionService" });

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
 *   prompt: getDefaultPrompt(),
 * });
 * ```
 */
export async function reviseSegment(params: SingleRevisionParams): Promise<RevisionResult> {
  const { segment, prompt, previousSegment, nextSegment, signal, providerId, model } = params;

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
    providerId,
    model,
  });

  if (!result.success || !result.data) {
    const responsePayload = formatResponsePayload(result.rawResponse, result.error);
    const message = result.error ?? "Revision failed";
    logger.error("Revision failed.", { message });
    throw new AIError(message, result.errorCode ?? "UNKNOWN_ERROR", {
      responsePayload,
    });
  }

  // Parse response (handles LLM artifacts)
  const parseResult = parseTextResponse(result.data, {
    originalText: segment.text,
    detectErrors: true,
  });

  if (parseResult.wasError) {
    logger.warn("AI returned error-like response.", { warnings: parseResult.warnings });
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
  const {
    segments,
    allSegments,
    prompt,
    signal,
    providerId,
    model,
    onProgress,
    onResult,
    onItemComplete,
  } = params;

  const results: RevisionResult[] = [];
  const issues: RevisionIssue[] = [];
  let unchanged = 0;
  let failed = 0;
  let processed = 0;
  let succeeded = 0;
  let abortedByFailures = false;

  // Create index for context lookup
  const segmentIndex = new Map(allSegments.map((s, i) => [s.id, { segment: s, index: i }]));

  const concurrency = getEffectiveAIRequestConcurrency(initializeSettings());
  const internalAbortController = new AbortController();

  if (signal) {
    if (signal.aborted) {
      internalAbortController.abort(signal.reason);
    } else {
      signal.addEventListener("abort", () => internalAbortController.abort(signal.reason), {
        once: true,
      });
    }
  }

  await runBatchCoordinator({
    inputs: segments,
    concurrency,
    signal: internalAbortController.signal,
    prepareYieldEvery: 10,
    emitYieldEvery: 10,
    prepare: (segment) => {
      const indexInfo = segmentIndex.get(segment.id);
      const globalIndex = indexInfo?.index ?? -1;
      const previousSegment = globalIndex > 0 ? allSegments[globalIndex - 1] : undefined;
      const nextSegment =
        globalIndex < allSegments.length - 1 ? allSegments[globalIndex + 1] : undefined;

      return {
        segment,
        previousSegment,
        nextSegment,
      };
    },
    execute: async (prepared) => {
      const itemStart = Date.now();

      try {
        const result = await reviseSegment({
          segment: prepared.segment,
          prompt,
          previousSegment: prepared.previousSegment,
          nextSegment: prepared.nextSegment,
          signal: internalAbortController.signal,
          providerId,
          model,
        });

        if (result.changes.length === 0) {
          return {
            status: "unchanged" as const,
            segmentId: prepared.segment.id,
            loggedAt: Date.now(),
            durationMs: Date.now() - itemStart,
          };
        }

        return {
          status: "revised" as const,
          segmentId: prepared.segment.id,
          loggedAt: Date.now(),
          durationMs: Date.now() - itemStart,
          result,
        };
      } catch (error) {
        const aiError = toAIError(error);
        const responsePayload = getErrorResponsePayload(aiError);
        if (aiError.code === "CANCELLED") {
          return {
            status: "cancelled" as const,
            segmentId: prepared.segment.id,
            loggedAt: Date.now(),
            durationMs: Date.now() - itemStart,
            errorCode: aiError.code,
          };
        }

        return {
          status: "failed" as const,
          segmentId: prepared.segment.id,
          loggedAt: Date.now(),
          durationMs: Date.now() - itemStart,
          error: aiError.toUserMessage(),
          responsePayload,
          errorCode: aiError.code,
        };
      }
    },
    onItemComplete: (_, outcome) => {
      processed++;

      if (outcome.status === "revised" && outcome.result) {
        results.push(outcome.result);
        succeeded++;
        onResult?.(outcome.result);
      }

      if (outcome.status === "unchanged") {
        unchanged++;
      }

      if (outcome.status === "failed") {
        failed++;
        issues.push({
          level: "error",
          message: `Failed to revise segment: ${outcome.error}`,
          segmentId: outcome.segmentId,
          context: { errorCode: outcome.errorCode },
        });

        if (
          !abortedByFailures &&
          succeeded === 0 &&
          failed >= 5 &&
          !internalAbortController.signal.aborted
        ) {
          abortedByFailures = true;
          internalAbortController.abort(
            new Error("Batch stopped after repeated connection failures."),
          );
        }
      }

      const entry: RevisionBatchLogEntry = {
        segmentId: outcome.segmentId,
        status: outcome.status,
        loggedAt: outcome.loggedAt,
        durationMs: outcome.durationMs,
        error: outcome.status === "failed" ? outcome.error : undefined,
        responsePayload: outcome.status === "failed" ? outcome.responsePayload : undefined,
        errorCode: outcome.errorCode,
      };

      onItemComplete?.(entry);
      onProgress?.(processed, segments.length);
    },
  });

  if (internalAbortController.signal.aborted) {
    issues.push({
      level: abortedByFailures ? "error" : "warn",
      message: abortedByFailures
        ? "Batch stopped after repeated connection failures"
        : "Revision cancelled by user",
      context: {
        processed,
        total: segments.length,
        errorCode: abortedByFailures ? "CONNECTION_ERROR" : "CANCELLED",
      },
    });
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

function getErrorResponsePayload(error: AIError): string | undefined {
  const details = error.details;
  if (details && typeof details === "object") {
    const responsePayload = (details as Record<string, unknown>).responsePayload;
    const originalError = (details as Record<string, unknown>).originalError;
    return formatResponsePayload(responsePayload ?? originalError, error.message);
  }
  return formatResponsePayload(undefined, error.message);
}

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
