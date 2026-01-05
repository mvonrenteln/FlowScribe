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
Analyze consecutive transcript segment pairs and determine if they should be merged.
When text smoothing is requested, also provide a grammatically corrected merged text.

IMPORTANT: All segment pairs presented to you have already been pre-filtered:
- Only same-speaker pairs (if speaker filtering is enabled)
- Only pairs with acceptable time gaps (based on maxTimeGap parameter)

Your job is to evaluate the CONTENT and determine if merging makes sense:
- Does the first segment's sentence continue in the next segment?
- Are the segments part of the same thought/idea?
- Would merging improve readability?

MERGE CRITERIA (evaluate these):
1. **Incomplete sentence** - First segment's sentence clearly continues in next segment
2. **Semantic connection** - Content is part of the same thought or topic
3. **Natural flow** - Merging would improve readability and flow

COMMON TRANSCRIPTION ARTIFACTS TO DETECT:
- **Incorrect sentence breaks**: Whisper sometimes adds a period and capitalizes the next word mid-sentence
  Example: "So what we're trying to." + "Achieve here is better" → Should be merged and smoothed
- **Fragmented phrases**: Sentence split at awkward points
- **Continuation markers**: First segment ends with conjunction or incomplete thought

CONFIDENCE SCORING:
- 0.9-1.0: Obvious merge (incomplete sentence, clear continuation)
- 0.7-0.89: Likely merge (related content, natural continuation)
- 0.5-0.69: Possible merge (complete sentences but strongly related)
- Below 0.5: Probably should not merge

DO NOT SUGGEST MERGE WHEN:
- Both segments are complete, standalone sentences without strong connection
- Topic clearly changes between segments
- Intentional pause for emphasis or dramatic effect

OUTPUT FORMAT
-------------
Return a JSON array of merge suggestions. Each suggestion MUST have this EXACT format:

{
  "segmentIds": [number, number],  // Array with the two segment IDs from brackets, e.g. [1, 2]
  "confidence": number,             // Number between 0 and 1
  "reason": string                  // Brief explanation
}

If smoothing is requested, also include:
- smoothedText: The grammatically corrected merged text
- smoothingChanges: Brief description of what was changed

CRITICAL: Use ONLY the format shown below. Do NOT use any other format like:
- ❌ pairIndex
- ❌ mergeId
- ❌ segmentA/segmentB objects
- ❌ Any other fields or structures

Example output:
[
  {
    "segmentIds": [1, 2],
    "confidence": 0.95,
    "reason": "Incomplete sentence continues in next segment",
    "smoothedText": "So what we're trying to achieve here is better performance.",
    "smoothingChanges": "Removed incorrect period, fixed capitalization"
  },
  {
    "segmentIds": [3, 4],
    "confidence": 0.85,
    "reason": "Short pause between related phrases"
  }
]

If no merges are suggested, return an empty array: []`;

// ==================== User Prompt Template ====================

export const MERGE_ANALYSIS_USER_TEMPLATE = `Analyze these transcript segment pairs for potential merges.

CONTEXT:
- Maximum time gap allowed: {{maxTimeGap}} seconds
- Text smoothing: {{#if enableSmoothing}}ENABLED - provide smoothed merged text{{else}}DISABLED{{/if}}

NOTE: These pairs have been pre-filtered based on speaker and time gap criteria.
Your task is to evaluate the CONTENT and determine if merging makes semantic sense.

SEGMENT PAIRS TO ANALYZE:
{{segmentPairs}}

{{#if enableSmoothing}}
SMOOTHING INSTRUCTIONS:
When suggesting a merge, provide a "smoothedText" that:
1. Removes incorrect sentence breaks (period + capital mid-sentence)
2. Fixes capitalization issues at merge points
3. Ensures grammatical flow
4. Preserves the speaker's voice and meaning
5. Makes minimal changes - only fix obvious transcription artifacts

Include "smoothingChanges" explaining what was changed.
{{/if}}

Return your merge suggestions as a JSON array.`;

// ==================== User Prompt Template (Simple) ====================

export const MERGE_ANALYSIS_USER_TEMPLATE_SIMPLE = `Analyze these pre-filtered transcript segment pairs for potential merges.

CONTEXT:
- Maximum time gap allowed: {{maxTimeGap}} seconds
- Text smoothing: {{#if enableSmoothing}}ENABLED - provide smoothed merged text{{else}}DISABLED{{/if}}

IMPORTANT:
Only consider the segment pairs listed below. They already satisfy speaker and time-gap requirements.
Use the full segment list afterward only for additional context when crafting explanations.

SEGMENT PAIRS TO ANALYZE:
{{segmentPairs}}

SEGMENTS FOR CONTEXT:
{{segments}}

{{#if enableSmoothing}}
SMOOTHING INSTRUCTIONS:
1. Remove incorrect sentence breaks (period + capital mid-sentence)
2. Fix capitalization issues at merge points
3. Ensure grammatical flow
4. Preserve the speaker's voice and meaning
5. Make minimal changes—only fix obvious transcription artifacts

Include "smoothedText" and "smoothingChanges" for each accepted merge.
{{/if}}

Return merge suggestions as a JSON array with segmentIds, confidence, reason{{#if enableSmoothing}}, smoothedText, smoothingChanges{{/if}}.`;

// ==================== Response Schema ====================

export const mergeResponseSchema = {
  type: "array" as const,
  items: {
    type: "object" as const,
    properties: {
      segmentIds: {
        type: "array" as const,
        items: { type: "string" as const },
        // Relax validation: allow e.g. [1,2] or single values
        allowNumericToStringArray: true,
        allowSingleValueAsArray: true,
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
  defaultBatchSize: 10,

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
