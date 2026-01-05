/**
 * Segment Merge Prompt Builder
 *
 * Builds prompts for AI segment merge analysis.
 * Separates prompt construction logic from the main service.
 *
 * @module ai/features/segmentMerge/promptBuilder
 */

import type { PromptVariables } from "@/lib/ai";
import { getMergeSystemPrompt, getMergeUserTemplate } from "./config";
import type { MergeAnalysisSegment } from "./types";
import {
  collectSegmentPairsWithSimpleIds,
  formatSegmentPairsWithSimpleIds,
  formatSegmentsWithSimpleIds,
  type SimpleIdContext,
} from "./utils";

/**
 * Parameters for prompt building
 */
export interface PromptBuildParams {
  segments: MergeAnalysisSegment[];
  maxTimeGap: number;
  sameSpeakerOnly: boolean;
  enableSmoothing: string;
  idContext: SimpleIdContext;
}

/**
 * Built prompt data ready for AI execution
 */
export interface BuiltPrompt {
  /**
   * Template variables for substitution
   */
  variables: PromptVariables;

  /**
   * System prompt
   */
  systemPrompt: string;

  /**
   * User prompt template
   */
  userTemplate: string;

  /**
   * Number of segment pairs found
   */
  pairCount: number;
}

/**
 * Build prompt for segment merge analysis
 *
 * Creates all necessary data for AI execution including:
 * - Formatted segment pairs with simple IDs
 * - Pair mapping JSON for response normalization
 * - Segment list with simple IDs
 * - System and user prompts
 *
 * @param params - Parameters for prompt building
 * @returns Built prompt data
 *
 * @example
 * ```ts
 * const idContext = createSimpleIdContext(segments);
 * const prompt = buildMergePrompt({
 *   segments,
 *   maxTimeGap: 2.0,
 *   sameSpeakerOnly: true,
 *   enableSmoothing: "true",
 *   idContext,
 * });
 *
 * if (prompt.pairCount === 0) {
 *   // No pairs to analyze
 * }
 * ```
 */
export function buildMergePrompt(params: PromptBuildParams): BuiltPrompt {
  const { segments, maxTimeGap, sameSpeakerOnly, enableSmoothing, idContext } = params;

  // Collect segment pairs with simple IDs
  const pairsWithSimpleIds = collectSegmentPairsWithSimpleIds(
    segments,
    maxTimeGap,
    sameSpeakerOnly,
    idContext.mapping,
    idContext.getSimpleId,
  );

  // Format pairs for prompt
  const segmentPairsText = formatSegmentPairsWithSimpleIds(pairsWithSimpleIds);

  // Format segments for prompt
  const segmentsFormatted = formatSegmentsWithSimpleIds(segments, idContext.getSimpleId);

  // Build pair mapping JSON (uses REAL segment IDs for normalization)
  const pairMappingJson = buildPairMappingJson(pairsWithSimpleIds);

  // Build variables
  const variables: PromptVariables = {
    segmentPairs: segmentPairsText,
    segmentPairsJson: pairMappingJson,
    segments: segmentsFormatted,
    maxTimeGap: maxTimeGap.toString(),
    enableSmoothing,
  };

  // Get prompts
  const systemPrompt = getMergeSystemPrompt();
  const userTemplate = getMergeUserTemplate(segments.length);

  return {
    variables,
    systemPrompt,
    userTemplate,
    pairCount: pairsWithSimpleIds.length,
  };
}

/**
 * Build pair mapping JSON for response normalization
 *
 * Maps pairIndex to real segment IDs for converting AI responses
 * back to actual segment references.
 */
function buildPairMappingJson(pairs: ReturnType<typeof collectSegmentPairsWithSimpleIds>): string {
  return JSON.stringify(
    pairs.map((pair) => ({
      pairIndex: pair.pairIndex,
      segmentIds: [pair.segmentA.id, pair.segmentB.id], // Real IDs
      simpleIds: [pair.simpleIdA, pair.simpleIdB], // Simple IDs (for reference)
    })),
  );
}

/**
 * Check if prompt has eligible pairs
 */
export function hasEligiblePairs(prompt: BuiltPrompt): boolean {
  const segmentPairs = prompt.variables.segmentPairs as string;
  return prompt.pairCount > 0 && segmentPairs.trim().length > 0;
}
