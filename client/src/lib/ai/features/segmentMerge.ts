/**
 * Segment Merge Feature Configuration (Placeholder)
 *
 * Configuration for the AI segment merge suggestion feature.
 * This is a placeholder for Phase 3 implementation.
 *
 * @module ai/features/segmentMerge
 */

import type { AIFeatureConfig } from "../core/types";

// ==================== Default Prompts ====================

export const MERGE_SYSTEM_PROMPT = `You analyze transcript segments to identify merge candidates.

TASK
----
Analyze consecutive transcript segments and suggest which ones should be merged.

MERGE CRITERIA:
- Same speaker in consecutive segments
- Incomplete sentence spanning multiple segments
- Short time gap (< 2 seconds)
- Semantically connected content

DO NOT MERGE:
- Different speakers
- Complete sentences that stand alone
- Large time gaps
- Topic changes

OUTPUT FORMAT
-------------
Return JSON array of merge suggestions:
[
  {
    "segmentIds": ["id1", "id2"],
    "confidence": 0.9,
    "reason": "Incomplete sentence continues"
  }
]`;

export const MERGE_USER_PROMPT_TEMPLATE = `SEGMENTS TO ANALYZE
-------------------
{{#each segments}}
[{{this.id}}] [{{this.speaker}}] ({{this.start}} - {{this.end}}): "{{this.text}}"
{{/each}}

Analyze and return merge suggestions as JSON.`;

// ==================== Response Schema ====================

export const mergeResponseSchema = {
  type: "array" as const,
  items: {
    type: "object" as const,
    properties: {
      segmentIds: { type: "array" as const, items: { type: "string" as const } },
      confidence: { type: "number" as const, minimum: 0, maximum: 1 },
      reason: { type: "string" as const },
    },
    required: ["segmentIds"],
  },
};

// ==================== Feature Configuration ====================

export const segmentMergeConfig: AIFeatureConfig = {
  id: "segment-merge",
  name: "Segment Merge Suggestions",
  category: "structural",

  systemPrompt: MERGE_SYSTEM_PROMPT,
  userPromptTemplate: MERGE_USER_PROMPT_TEMPLATE,

  batchable: true,
  streamable: false,
  defaultBatchSize: 20,

  shortcut: "Alt+Shift+M",
  icon: "git-merge",
  requiresConfirmation: true,

  availablePlaceholders: ["segments"],

  responseSchema: mergeResponseSchema,
};

// ==================== Types ====================

/**
 * A single merge suggestion from the AI.
 */
export interface MergeSuggestion {
  segmentIds: string[];
  confidence: number;
  reason?: string;
}

/**
 * Input for segment merge analysis.
 */
export interface SegmentMergeInput {
  segments: Array<{
    id: string;
    speaker: string;
    text: string;
    start: number;
    end: number;
  }>;
}

/**
 * Output from segment merge analysis.
 */
export type SegmentMergeOutput = MergeSuggestion[];
