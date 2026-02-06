/**
 * Speaker Classification Service
 *
 * Service for classifying transcript segment speakers using AI.
 * Uses the unified AI module for execution.
 *
 * @module ai/features/speaker/service
 */

import { getI18nInstance } from "@/i18n/config";
import {
  getEffectiveAIRequestConcurrency,
  initializeSettings,
} from "@/lib/settings/settingsStorage";
import type { AIFeatureOptions } from "../../core";
import {
  AIError,
  executeFeature,
  formatResponsePayload,
  runBatchCoordinator,
  toAIError,
} from "../../core";
import { extractJSON } from "../../parsing";
import { speakerClassificationConfig } from "./config";
import type {
  BatchIssue,
  BatchSegment,
  ParsedSuggestionsResult,
  RawSpeakerResponseItem,
  SpeakerClassificationResult,
  SpeakerSuggestion,
} from "./types";
import {
  formatSegmentsForPrompt,
  formatSpeakersForPrompt,
  markNewSpeaker,
  resolveSuggestedSpeaker,
} from "./utils";

const t = getI18nInstance().t.bind(getI18nInstance());

// ==================== Types ====================

/**
 * Options for speaker classification.
 */
export interface ClassifySpeakersOptions extends AIFeatureOptions {
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
}

/**
 * Options for batch classification.
 */
export interface ClassifySpeakersBatchOptions extends ClassifySpeakersOptions {
  /** Number of segments per batch */
  batchSize?: number;

  /** Progress callback */
  onProgress?: (processed: number, total: number) => void;

  /** Called when a batch completes */
  onBatchComplete?: (results: SpeakerClassificationResult[]) => void;
}

/**
 * Result of batch classification.
 */
export interface ClassifySpeakersBatchResult {
  /** All classification results */
  results: SpeakerClassificationResult[];

  /** Processing summary */
  summary: {
    total: number;
    classified: number;
    unchanged: number;
    failed: number;
  };

  /** Issues encountered during processing */
  issues: BatchIssue[];
}

// ==================== Main Functions ====================

/**
 * Classify speakers for a list of segments.
 *
 * @param segments - Segments to classify
 * @param availableSpeakers - Available speaker tags
 * @param options - Classification options
 * @returns Classification results
 *
 * @example
 * ```ts
 * const results = await classifySpeakers(
 *   [{ id: "1", speaker: "[Unknown]", text: "Hello there!" }],
 *   ["Alice", "Bob", "[SL]"],
 * );
 * ```
 */
export async function classifySpeakers(
  segments: Array<{ id: string; speaker: string; text: string }>,
  availableSpeakers: string[],
  options: ClassifySpeakersOptions = {},
): Promise<SpeakerClassificationResult[]> {
  if (segments.length === 0) {
    return [];
  }

  // Build prompt variables
  const segmentsText = formatSegmentsForPrompt(segments);
  const speakersText = formatSpeakersForPrompt(availableSpeakers);

  // Execute feature
  const result = await executeFeature<SpeakerSuggestion[]>(
    "speaker-classification",
    {
      segments: segmentsText,
      speakers: speakersText,
    },
    options,
  );

  if (!result.success || !result.data) {
    const message = result.error ?? "Speaker classification failed";
    console.error("[Speaker Service] Classification failed:", message);
    const responsePayload = formatResponsePayload(result.rawResponse, result.error);
    throw new AIError(message, result.errorCode ?? "UNKNOWN_ERROR", {
      responsePayload,
      rawResponse: result.rawResponse,
    });
  }

  // Map suggestions to results
  return mapSuggestionsToResults(result.data, segments, availableSpeakers, options.minConfidence);
}

/**
 * Classify speakers in batches with progress tracking.
 *
 * @param segments - All segments to classify
 * @param availableSpeakers - Available speaker tags
 * @param options - Batch options
 * @returns Batch result with all classifications
 */
export async function classifySpeakersBatch(
  segments: Array<{ id: string; speaker: string; text: string }>,
  availableSpeakers: string[],
  options: ClassifySpeakersBatchOptions = {},
): Promise<ClassifySpeakersBatchResult> {
  const {
    batchSize = speakerClassificationConfig.defaultBatchSize,
    onProgress,
    onBatchComplete,
    signal,
    ...classifyOptions
  } = options;

  const allResults: SpeakerClassificationResult[] = [];
  const allIssues: BatchIssue[] = [];
  let unchanged = 0;
  let failed = 0;
  let processedBatches = 0;

  const totalBatches = Math.ceil(segments.length / batchSize);

  const concurrency = getEffectiveAIRequestConcurrency(initializeSettings());

  await runBatchCoordinator({
    inputs: Array.from({ length: totalBatches }, (_, batchIndex) => batchIndex),
    concurrency,
    signal,
    prepareYieldEvery: 10,
    emitYieldEvery: 10,
    prepare: (batchIndex) => {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, segments.length);
      const batchSegments = segments.slice(start, end);

      return {
        batchIndex,
        batchSegments,
        end,
      };
    },
    execute: async (prepared) => {
      try {
        const batchResults = await classifySpeakers(prepared.batchSegments, availableSpeakers, {
          ...classifyOptions,
          signal,
        });

        return {
          status: "success" as const,
          batchIndex: prepared.batchIndex,
          batchSegments: prepared.batchSegments,
          batchResults,
          end: prepared.end,
        };
      } catch (error) {
        const aiError = toAIError(error);
        const responsePayload =
          typeof aiError.details?.responsePayload === "string"
            ? aiError.details.responsePayload
            : undefined;
        return {
          status: "failed" as const,
          batchIndex: prepared.batchIndex,
          batchSegments: prepared.batchSegments,
          end: prepared.end,
          error: aiError.toUserMessage(),
          errorCode: aiError.code,
          responsePayload,
        };
      }
    },
    onItemComplete: (_, outcome) => {
      processedBatches++;

      if (outcome.status === "success") {
        const classifiedIds = new Set(outcome.batchResults.map((r) => r.segmentId));
        for (const seg of outcome.batchSegments) {
          if (!classifiedIds.has(seg.id)) {
            unchanged++;
          }
        }

        allResults.push(...outcome.batchResults);
        onBatchComplete?.(outcome.batchResults);
      } else {
        failed += outcome.batchSegments.length;
        allIssues.push({
          level: "error",
          message: outcome.error ?? t("aiBatch.errors.unknown"),
          context: {
            batchIndex: outcome.batchIndex,
            segmentIds: outcome.batchSegments.map((s) => s.id),
            errorCode: outcome.errorCode,
            responsePayload: outcome.responsePayload,
          },
        });
      }

      onProgress?.(outcome.end, segments.length);
    },
  });

  if (signal?.aborted) {
    allIssues.push({
      level: "warn",
      message: t("aiBatch.messages.cancelledByUser"),
      context: { processedBatches, totalBatches },
    });
  }

  return {
    results: allResults,
    summary: {
      total: segments.length,
      classified: allResults.length,
      unchanged,
      failed,
    },
    issues: allIssues,
  };
}

// ==================== Response Parsing ====================

/**
 * Parse raw AI response into speaker suggestions.
 * Handles malformed responses with lenient parsing.
 */
export function parseRawResponse(
  rawResponse: string,
  batchSegments: BatchSegment[],
  availableSpeakers: Iterable<string>,
  currentSpeakers: Map<string, string>,
): ParsedSuggestionsResult {
  const issues: BatchIssue[] = [];

  // Extract JSON from response
  let items: RawSpeakerResponseItem[];
  try {
    const parsed = extractJSON(rawResponse, { lenient: true });
    items = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // Fallback to regex extraction
    items = extractWithRegex(rawResponse);
  }

  if (items.length === 0) {
    return {
      suggestions: [],
      rawItemCount: 0,
      issues: [
        {
          level: "error",
          message: "Response did not contain any parseable speaker entries",
          context: { rawPreview: rawResponse.slice(0, 200) },
        },
      ],
      unchangedAssignments: 0,
      fatal: true,
    };
  }

  // Build speaker pool
  const speakerPool = new Set(availableSpeakers);
  for (const speaker of currentSpeakers.values()) {
    speakerPool.add(speaker);
  }

  const suggestions: SpeakerClassificationResult[] = [];
  let unchangedAssignments = 0;

  for (let index = 0; index < batchSegments.length; index++) {
    const segment = batchSegments[index];
    const item = items[index];

    if (!item) {
      issues.push({
        level: "warn",
        message: `Missing response entry for segment ${segment.segmentId}`,
        context: { position: index + 1 },
      });
      continue;
    }

    const result = processSingleItem(
      item,
      segment,
      speakerPool,
      currentSpeakers.get(segment.segmentId) ?? "",
      issues,
    );

    if (result) {
      if (result.suggestedSpeaker.toLowerCase() !== segment.speaker.toLowerCase()) {
        suggestions.push(result);
      } else {
        unchangedAssignments++;
      }
    }
  }

  // Warn about extra items
  if (items.length > batchSegments.length) {
    issues.push({
      level: "warn",
      message: `Model returned ${items.length - batchSegments.length} extra entries`,
      context: { returned: items.length, expected: batchSegments.length },
    });
  }

  return {
    suggestions,
    rawItemCount: items.length,
    issues,
    unchangedAssignments,
    fatal: false,
    ignoredCount: Math.max(0, items.length - batchSegments.length),
  };
}

// ==================== Helper Functions ====================

/**
 * Map AI suggestions to classification results.
 */
function mapSuggestionsToResults(
  suggestions: SpeakerSuggestion[],
  segments: Array<{ id: string; speaker: string; text: string }>,
  availableSpeakers: string[],
  minConfidence = 0,
): SpeakerClassificationResult[] {
  const results: SpeakerClassificationResult[] = [];
  const speakerSet = new Set(availableSpeakers);

  for (let i = 0; i < Math.min(suggestions.length, segments.length); i++) {
    const suggestion = suggestions[i];
    const segment = segments[i];

    // Skip low confidence
    if (suggestion.confidence < minConfidence) {
      continue;
    }

    // Resolve speaker
    const resolved = resolveSuggestedSpeaker(suggestion.tag, speakerSet);
    const speakerInfo = resolved
      ? { name: resolved, isNew: false }
      : markNewSpeaker(suggestion.tag);

    // Skip if unchanged
    if (speakerInfo.name.toLowerCase() === segment.speaker.toLowerCase()) {
      continue;
    }

    results.push({
      segmentId: segment.id,
      suggestedSpeaker: speakerInfo.name,
      confidence: suggestion.confidence,
      isNew: speakerInfo.isNew,
      originalSpeaker: segment.speaker,
      reason: suggestion.reason,
    });
  }

  return results;
}

/**
 * Process a single response item into a classification result.
 */
function processSingleItem(
  item: RawSpeakerResponseItem,
  segment: BatchSegment,
  speakerPool: Set<string>,
  currentSpeaker: string,
  issues: BatchIssue[],
): SpeakerClassificationResult | null {
  const rawTag = item.tag ?? "";

  if (!rawTag.trim()) {
    issues.push({
      level: "warn",
      message: `Missing speaker tag for segment ${segment.segmentId}`,
      context: { item },
    });
    return null;
  }

  // Clean up tag
  const cleanedTag = rawTag.replace(/^[[<(\s]+|[\]>)\s]+$/g, "").trim();
  if (!cleanedTag) {
    issues.push({
      level: "warn",
      message: `Empty speaker tag after cleanup for segment ${segment.segmentId}`,
      context: { rawTag },
    });
    return null;
  }

  // Resolve speaker
  const resolved = resolveSuggestedSpeaker(cleanedTag, speakerPool);
  const speakerInfo = resolved ? { name: resolved, isNew: false } : markNewSpeaker(cleanedTag);

  // Normalize confidence
  let confidence = 0.5;
  if (typeof item.confidence === "number") {
    confidence = Math.max(0, Math.min(1, item.confidence));
  }

  return {
    segmentId: segment.segmentId,
    suggestedSpeaker: speakerInfo.name,
    confidence,
    isNew: speakerInfo.isNew,
    originalSpeaker: currentSpeaker,
    reason: item.reason,
  };
}

/**
 * Extract speaker items using regex fallback.
 */
function extractWithRegex(raw: string): RawSpeakerResponseItem[] {
  const pattern =
    /\{\s*"tag"\s*:\s*"([^"]+)"(?:\s*,\s*"confidence"\s*:\s*([\d.]+))?(?:\s*,\s*"reason"\s*:\s*"([^"]*)")?\s*}/gi;
  const items: RawSpeakerResponseItem[] = [];
  let match: RegExpExecArray | null = pattern.exec(raw);
  while (match !== null) {
    items.push({
      tag: match[1],
      confidence: match[2] ? parseFloat(match[2]) : undefined,
      reason: match[3] || undefined,
    });
    match = pattern.exec(raw);
  }

  return items;
}
