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
import { getMergeSystemPrompt, getMergeUserTemplate, mergeResponseSchema } from "./config";
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
  collectSegmentPairs,
  collectSegmentPairsWithSimpleIds,
  createSimpleIdContext,
  formatSegmentPairs,
  formatSegmentPairsForPrompt,
  formatSegmentPairsWithSimpleIds,
  formatSegmentsForPrompt,
  formatSegmentsWithSimpleIds,
  normalizeRawSuggestion,
  processSuggestions,
} from "./utils";
import { createBatchPairMapping } from "@/lib/ai/core";
import type { RawAIItem, BatchPairMapping } from "@/lib/ai/core/batchIdMapping";

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

  // Create simple-id context per batch (simple IDs start at 1 for each batch)
  const simpleIdContext = createSimpleIdContext(segments);
  const idMapping = simpleIdContext.mapping;

  // Build prompt variables using simple IDs
  const pairsWithSimpleIds = collectSegmentPairsWithSimpleIds(
    segments,
    maxTimeGap,
    sameSpeakerOnly,
    idMapping,
    simpleIdContext.getSimpleId,
  );
  const segmentPairsText = formatSegmentPairsWithSimpleIds(pairsWithSimpleIds);
  const segmentsFormatted = formatSegmentsWithSimpleIds(segments, simpleIdContext.getSimpleId);

  if (!segmentPairsText.trim()) {
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

  // Build pair mapping JSON for response normalization - use REAL segment IDs
  // This is used to map pairIndex from AI response back to actual segment IDs
  const pairMappingJson = JSON.stringify(
    pairsWithSimpleIds.map((pair) => ({
      pairIndex: pair.pairIndex,
      segmentIds: [pair.segmentA.id, pair.segmentB.id], // Real segment IDs for normalization
      simpleIds: [pair.simpleIdA, pair.simpleIdB], // Simple IDs used in prompt (for reference)
    })),
  );

  const variables = {
    segmentPairs: segmentPairsText,
    segmentPairsJson: pairMappingJson,
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
    let parsedData: RawMergeSuggestion[] | undefined;

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
        console.warn(
          "[AISegmentMerge] Lenient parse failed or returned no data:",
          lenientParsed.error?.message,
        );

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

          const { recovered, skipped } = recoverPartialArray<RawMergeSuggestion>(
            rawText,
            isRawSuggestion,
          );
          if (recovered.length > 0) {
            console.warn("[AISegmentMerge] Recovered partial suggestions:", {
              recoveredCount: recovered.length,
              skipped,
            });
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
                    console.warn(
                      "[AISegmentMerge] Parsed JSON array candidate from raw text, using as recovered data",
                    );
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
                  console.warn(
                    "[AISegmentMerge] JSON.parse of candidate failed:",
                    jsonEx instanceof Error ? jsonEx.message : String(jsonEx),
                  );
                }
              }
            } catch (ex) {
              console.warn(
                "[AISegmentMerge] JSON array fallback extraction failed:",
                ex instanceof Error ? ex.message : String(ex),
              );
            }
          }
        } catch (ex) {
          console.warn(
            "[AISegmentMerge] recoverPartialArray failed:",
            ex instanceof Error ? ex.message : String(ex),
          );
        }
      }
    }

    if (!parsedData) {
      // No usable data found — record issue and exit
      issues.push({ level: "error", message: result.error || "Failed to analyze segments" });
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

    // Normalize raw suggestions using ID mapping (handles pairId, mergeId, simple IDs, segmentA/B)
    const normalizedData: RawMergeSuggestion[] = [];
    for (const raw of parsedData as any[]) {
      const normalized = normalizeRawSuggestion(raw, idMapping);
      if (normalized) {
        normalizedData.push(normalized);
      } else if
