/**
 * Speaker Classification Service
 *
 * Service for classifying transcript segment speakers using AI.
 * Uses the unified AI module for execution.
 *
 * @module ai/features/speaker/service
 */

import type { AIFeatureOptions } from "../../core";
import { executeFeature } from "../../core";
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

// ==================== Types ====================

/**
 * Options for speaker classification.
 */
export interface ClassifySpeakersOptions extends AIFeatureOptions {
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Provider ID to use (alternative to provider object) */
  providerId?: string;
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

  console.log(
    "[Speaker Service] Classifying",
    segments.length,
    "segments with",
    availableSpeakers.length,
    "speakers",
  );
  console.log("[Speaker Service] Options:", {
    hasCustomPrompt: !!options.customPrompt,
    providerId: (options as { providerId?: string }).providerId,
    model: options.model,
  });

  // Execute feature
  const result = await executeFeature<SpeakerSuggestion[]>(
    "speaker-classification",
    {
      segments: segmentsText,
      speakers: speakersText,
    },
    options,
  );

  console.log("[Speaker Service] Result:", {
    success: result.success,
    hasData: !!result.data,
    dataLength: result.data?.length,
    error: result.error,
  });

  if (!result.success || !result.data) {
    console.error("[Speaker Service] Classification failed:", result.error);
    return [];
  }

  // Map suggestions to results
  const mapped = mapSuggestionsToResults(
    result.data,
    segments,
    availableSpeakers,
    options.minConfidence,
  );
  console.log("[Speaker Service] Mapped results:", mapped.length);
  return mapped;
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

  const totalBatches = Math.ceil(segments.length / batchSize);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    // Check for cancellation
    if (signal?.aborted) {
      allIssues.push({
        level: "warn",
        message: "Classification cancelled by user",
        context: { processedBatches: batchIndex, totalBatches },
      });
      break;
    }

    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, segments.length);
    const batchSegments = segments.slice(start, end);

    try {
      const batchResults = await classifySpeakers(batchSegments, availableSpeakers, {
        ...classifyOptions,
        signal,
      });

      // Count unchanged (segments not in results)
      const classifiedIds = new Set(batchResults.map((r) => r.segmentId));
      for (const seg of batchSegments) {
        if (!classifiedIds.has(seg.id)) {
          unchanged++;
        }
      }

      allResults.push(...batchResults);
      onBatchComplete?.(batchResults);
    } catch (error) {
      failed += batchSegments.length;
      allIssues.push({
        level: "error",
        message: `Batch ${batchIndex + 1} failed: ${error instanceof Error ? error.message : String(error)}`,
        context: { batchIndex, segmentIds: batchSegments.map((s) => s.id) },
      });
    }

    onProgress?.(end, segments.length);
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

// ==================== Legacy API Adapter ====================

/**
 * Legacy suggestion format (matches store/types.ts AISpeakerSuggestion).
 */
export interface LegacySpeakerSuggestion {
  segmentId: string;
  currentSpeaker: string;
  suggestedSpeaker: string;
  status: "pending" | "accepted" | "rejected";
  confidence?: number;
  reason?: string;
  isNewSpeaker?: boolean;
}

/**
 * Options for runAnalysis (legacy API compatibility).
 */
export interface AnalysisOptions {
  segments: Array<{ id: string; speaker: string; text: string; confirmed?: boolean }>;
  speakers: string[];
  config: {
    batchSize: number;
    prompts: Array<{ id: string; systemPrompt: string; userPromptTemplate: string }>;
    activePromptId: string;
    selectedProviderId?: string;
    selectedModel?: string;
  };
  selectedSpeakers: string[];
  excludeConfirmed: boolean;
  signal: AbortSignal;
  onProgress?: (processed: number, total: number) => void;
  onBatchComplete?: (suggestions: LegacySpeakerSuggestion[]) => void;
  onError?: (error: Error) => void;
  onBatchInfo?: (info: {
    batchIndex: number;
    batchSize: number;
    rawItemCount: number;
    unchangedAssignments: number;
    suggestionCount: number;
    processedTotal: number;
    totalExpected: number;
    issues?: BatchIssue[];
    fatal?: boolean;
    rawResponsePreview?: string;
    ignoredCount?: number;
    batchDurationMs?: number;
    elapsedMs?: number;
  }) => void;
}

/**
 * Run speaker analysis with legacy API compatibility.
 * This wraps classifySpeakersBatch to provide the old interface.
 *
 * @param options - Analysis options
 * @returns Promise that resolves when analysis completes
 */
export async function runAnalysis(options: AnalysisOptions): Promise<void> {
  const {
    segments,
    speakers,
    config,
    selectedSpeakers,
    excludeConfirmed,
    signal,
    onProgress,
    onBatchComplete,
    onError,
    onBatchInfo,
  } = options;

  const overallStart = Date.now();

  // Get active prompt from config
  const activePrompt =
    config.prompts.find((p) => p.id === config.activePromptId) ?? config.prompts[0];

  try {
    // Filter segments based on selection criteria
    const filteredSegments = segments.filter((segment) => {
      if (excludeConfirmed && segment.confirmed) return false;
      if (selectedSpeakers.length > 0) {
        return selectedSpeakers.some((s) => s.toLowerCase() === segment.speaker.toLowerCase());
      }
      return true;
    });

    if (filteredSegments.length === 0) {
      return;
    }

    const batchSize = config.batchSize || 10;
    const total = filteredSegments.length;
    let processed = 0;
    let batchIndex = 0;

    // Process in batches
    for (let i = 0; i < total; i += batchSize) {
      if (signal.aborted) {
        return;
      }

      const batchStart = Date.now();
      const batchSegments = filteredSegments.slice(i, Math.min(i + batchSize, total));

      try {
        const results = await classifySpeakers(batchSegments, speakers, {
          signal,
          customPrompt: activePrompt
            ? {
                systemPrompt: activePrompt.systemPrompt,
                userPromptTemplate: activePrompt.userPromptTemplate,
              }
            : undefined,
          // Pass provider config
          providerId: config.selectedProviderId,
          model: config.selectedModel,
        });

        processed = Math.min(i + batchSize, total);
        const batchEnd = Date.now();

        // Convert results to legacy suggestion format
        const suggestions: LegacySpeakerSuggestion[] = results.map((r) => ({
          segmentId: r.segmentId,
          currentSpeaker: r.originalSpeaker ?? "",
          suggestedSpeaker: r.suggestedSpeaker,
          status: "pending" as const,
          confidence: r.confidence,
          reason: r.reason,
          isNewSpeaker: r.isNew,
        }));

        // Call callbacks
        if (suggestions.length > 0) {
          onBatchComplete?.(suggestions);
        }

        onProgress?.(processed, total);

        onBatchInfo?.({
          batchIndex,
          batchSize: batchSegments.length,
          rawItemCount: batchSegments.length,
          unchangedAssignments: batchSegments.length - results.length,
          suggestionCount: suggestions.length,
          processedTotal: processed,
          totalExpected: total,
          issues: [],
          fatal: false,
          ignoredCount: 0,
          batchDurationMs: batchEnd - batchStart,
          elapsedMs: batchEnd - overallStart,
        });
      } catch (batchError) {
        onBatchInfo?.({
          batchIndex,
          batchSize: batchSegments.length,
          rawItemCount: 0,
          unchangedAssignments: 0,
          suggestionCount: 0,
          processedTotal: processed,
          totalExpected: total,
          issues: [{ level: "error", message: String(batchError) }],
          fatal: true,
          ignoredCount: 0,
          batchDurationMs: Date.now() - batchStart,
          elapsedMs: Date.now() - overallStart,
        });
      }

      batchIndex++;
    }
  } catch (error) {
    if (!signal.aborted) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
