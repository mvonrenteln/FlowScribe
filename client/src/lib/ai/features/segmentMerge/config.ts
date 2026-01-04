/**
 * Segment Merge Configuration
 *
 * Feature configuration, prompts, and schemas for AI segment merge suggestions.
 *
 * @module ai/features/segmentMerge/config
 */

import type { AIFeatureConfig } from "@/lib/ai";

// ==================== System Prompt ====================

export const MERGE_ANALYSIS_SYSTEM_PROMPT = `You analyze transcript segments to identify which ones should be merged together.

TASK
----
Analyze consecutive transcript segment pairs and suggest which ones should be merged.
When text smoothing is requested, also provide a grammatically corrected merged text.

MERGE CRITERIA (in order of importance):
1. **Same speaker** - Only suggest merging segments from the same speaker
2. **Incomplete sentence** - First segment's sentence continues in next segment
3. **Short time gap** - Small pause between segments (typically < 2 seconds)
4. **Semantic connection** - Content is clearly connected

COMMON TRANSCRIPTION ARTIFACTS TO DETECT:
- **Incorrect sentence breaks**: Whisper sometimes adds a period and capitalizes the next word mid-sentence
  Example: "So what we're trying to." + "Achieve here is better" → Should be merged and smoothed
- **Fragmented phrases**: Sentence split at awkward points
- **Continuation markers**: First segment ends with conjunction or incomplete thought

CONFIDENCE SCORING:
- 0.9-1.0: Obvious merge (incomplete sentence, very short gap)
- 0.7-0.89: Likely merge (related content, short gap, same speaker)
- 0.5-0.69: Possible merge (complete sentences but related)
- 0.3-0.49: Uncertain (consider context)
- Below 0.3: Probably should not merge

DO NOT SUGGEST MERGE WHEN:
- Different speakers
- Time gap exceeds threshold
- Both segments are complete, standalone sentences
- Topic clearly changes
- Intentional pause (speaker thinking, dramatic effect)

OUTPUT FORMAT
-------------
Return a JSON array of merge suggestions. Each suggestion must include:
- segmentIds: Array of segment IDs to merge (usually 2)
- confidence: Number between 0 and 1
- reason: Brief explanation for the merge suggestion

If smoothing is requested, also include:
- smoothedText: The grammatically corrected merged text
- smoothingChanges: Brief description of what was changed

Example output:
[
  {
    "segmentIds": ["seg-12", "seg-13"],
    "confidence": 0.95,
    "reason": "Incomplete sentence continues in next segment",
    "smoothedText": "So what we're trying to achieve here is better performance.",
    "smoothingChanges": "Removed incorrect period, fixed capitalization"
  }
]

If no merges are suggested, return an empty array: []`;

// ==================== User Prompt Template ====================

export const MERGE_ANALYSIS_USER_TEMPLATE = `Analyze these transcript segment pairs for potential merges.

PARAMETERS:
- Maximum time gap allowed: {{maxTimeGap}} seconds
- Text smoothing: {{#if enableSmoothing}}ENABLED - provide smoothed merged text{{else}}DISABLED{{/if}}

SEGMENT PAIRS TO ANALYZE:
{{segmentPairs}}

{{#if enableSmoothing}}
SMOOTHING INSTRUCTIONS:
When suggesting a merge, also provide a "smoothedText" that:
1. Removes incorrect sentence breaks (period + capital mid-sentence)
2. Fixes capitalization issues at merge points
3. Ensures grammatical flow
4. Preserves the speaker's voice and meaning
5. Makes minimal changes - only fix obvious transcription artifacts

Always include "smoothingChanges" explaining what was changed.
{{/if}}

Return your merge suggestions as a JSON array.`;

// ==================== User Prompt Template (Simple) ====================

export const MERGE_ANALYSIS_USER_TEMPLATE_SIMPLE = `Analyze these transcript segments for potential merges.

Maximum time gap: {{maxTimeGap}} seconds
{{#if enableSmoothing}}
Text smoothing: ENABLED
{{/if}}

SEGMENTS:
{{segments}}

Return merge suggestions as JSON array with segmentIds, confidence, reason{{#if enableSmoothing}}, smoothedText, smoothingChanges{{/if}}.`;

// ==================== Response Schema ====================

export const mergeResponseSchema = {
  type: "array" as const,
  items: {
    type: "object" as const,
    properties: {
      segmentIds: {
        type: "array" as const,
        items: { type: "string" as const },
      },
      confidence: {
        type: "number" as const,
        minimum: 0,
        maximum: 1,
      },
      reason: { type: "string" as const },
      smoothedText: { type: "string" as const, optional: true },
      smoothingChanges: { type: "string" as const, optional: true },
    },
    required: ["segmentIds"],
  },
};

// ==================== Feature Configuration ====================

export const segmentMergeConfig: AIFeatureConfig = {
  id: "segment-merge",
  name: "Segment Merge Suggestions",
  category: "structural",

  systemPrompt: MERGE_ANALYSIS_SYSTEM_PROMPT,
  userPromptTemplate: MERGE_ANALYSIS_USER_TEMPLATE,

  batchable: true,
  streamable: false,
  defaultBatchSize: 20,

  shortcut: "Alt+Shift+M",
  icon: "git-merge",
  requiresConfirmation: true,

  availablePlaceholders: ["segmentPairs", "segments", "maxTimeGap", "enableSmoothing"],

  responseSchema: mergeResponseSchema,
};

// ==================== Prompt Variants ====================

/**
 * Get system prompt for merge analysis.
 */
export function getMergeSystemPrompt(): string {
  return MERGE_ANALYSIS_SYSTEM_PROMPT;
}

/**
 * Get user prompt template based on segment count.
 * Uses simpler template for smaller batches.
 *
 * @param segmentCount - Number of segments being analyzed
 */
export function getMergeUserTemplate(segmentCount: number): string {
  return segmentCount > 10 ? MERGE_ANALYSIS_USER_TEMPLATE : MERGE_ANALYSIS_USER_TEMPLATE_SIMPLE;
}
