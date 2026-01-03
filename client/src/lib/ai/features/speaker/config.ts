/**
 * Speaker Classification Configuration
 *
 * Feature configuration, prompts, and schemas for speaker classification.
 *
 * @module ai/features/speaker/config
 */

import type { AIFeatureConfig } from "../../core/types";

// ==================== Default Prompts ====================

export const SPEAKER_SYSTEM_PROMPT = `You are a classifier for role-playing game transcripts.

TASK
-----
You receive a list of text sections ("sections") with unique IDs.
For EACH section, assign exactly ONE speaker tag from the available speakers list below.

OUTPUT FORMAT
-------------
Return ONLY valid JSON:

[
  {
    "tag": "<one of the available tags>",
    "confidence": <number between 0 and 1>,
    "reason": "<brief reasoning in one sentence>"
  },
  ...
]

IMPORTANT:
- Output order MUST match the order of the provided sections 1:1.
- Do not skip or add entries.
- Only JSON, NO additional text.
- "confidence": 0.9-1.0 = very confident, 0.6-0.89 = medium, below = uncertain.
- "reason" should be kept brief (one sentence max).
- If unsure, prefer lower confidence over guessing.

HEURISTICS FOR SPEAKER RECOGNITION
----------------------------------
Use these hints when available in the input context:

[SL] - Game master narration, world description, scene setting
[OOC] - Out of character: rule discussions, meta comments, dice rolls

For player characters: Look for speech patterns, themes, personality traits
that match known character descriptions from context.

IMPORTANT NOTE ON HUMOR
-----------------------
Humor is IN CHARACTER as long as it could be spoken or thought by the character.
Only use [OOC] if clearly player-level: meta comments, rules, off-topic.

DECISION STEPS FOR EACH SECTION
-------------------------------
1. Does it sound like in-game dialogue or action from a character?
   → use character tag

2. Does it describe world, environment, NPCs, or events generally?
   → use [SL]

3. Is it meta-level discussion, rules, or off-topic?
   → use [OOC]

4. Clearly identifiable NPC with name or function?
   → use the NPC name/function

5. Uncertain which character?
   → use [Unknown?] with low confidence`;

export const SPEAKER_USER_PROMPT_TEMPLATE = `AVAILABLE SPEAKERS
------------------
{{speakers}}

SECTIONS TO CLASSIFY
--------------------
{{segments}}

Respond with ONLY the JSON array as specified.`;

// ==================== Response Schema ====================

/**
 * JSON Schema for speaker classification response.
 */
export const speakerResponseSchema = {
  type: "array" as const,
  items: {
    type: "object" as const,
    properties: {
      tag: { type: "string" as const },
      confidence: { type: "number" as const, minimum: 0, maximum: 1 },
      reason: { type: "string" as const },
    },
    required: ["tag"],
  },
};

// ==================== Feature Configuration ====================

/**
 * Speaker classification feature configuration.
 */
export const speakerClassificationConfig: AIFeatureConfig = {
  id: "speaker-classification",
  name: "Speaker Classification",
  category: "metadata",

  systemPrompt: SPEAKER_SYSTEM_PROMPT,
  userPromptTemplate: SPEAKER_USER_PROMPT_TEMPLATE,

  batchable: true,
  streamable: false,
  defaultBatchSize: 15,

  shortcut: "Alt+S",
  icon: "users",
  requiresConfirmation: true,

  availablePlaceholders: ["speakers", "segments"],

  responseSchema: speakerResponseSchema,
};

// ==================== Prompt Helpers ====================

/**
 * Build custom user prompt with variables.
 *
 * @param template - Prompt template
 * @param speakers - Available speakers
 * @param segments - Segments to classify
 * @returns Compiled prompt
 */
export function buildSpeakerPrompt(template: string, speakers: string[], segments: string): string {
  return template.replace("{{speakers}}", speakers.join(", ")).replace("{{segments}}", segments);
}
