/**
 * Content Transformation Feature Configuration (Placeholder)
 *
 * Configuration for the AI content transformation feature.
 * This is a placeholder for Phase 6B implementation.
 *
 * @module ai/features/contentTransformation
 */

import type { AIFeatureConfig } from "../core/types";

// ==================== Transformation Types ====================

export type TransformationType =
  | "summary-brief"
  | "summary-detailed"
  | "key-points"
  | "meeting-notes"
  | "article"
  | "qa-format"
  | "action-items";

// ==================== Default Prompts ====================

export const TRANSFORM_SUMMARY_SYSTEM_PROMPT = `You summarize transcripts concisely.

TASK
----
Create a summary of the transcript content.

GUIDELINES:
- Capture the main points and key takeaways
- Preserve important quotes or statements
- Maintain factual accuracy
- Use clear, professional language

OUTPUT FORMAT
-------------
Return the summary as plain text. No JSON, no markdown formatting.`;

export const TRANSFORM_MEETING_NOTES_SYSTEM_PROMPT = `You create professional meeting notes from transcripts.

TASK
----
Transform the transcript into structured meeting notes.

INCLUDE:
- Meeting overview (topic, participants)
- Key decisions made
- Action items with owners
- Important discussion points
- Next steps

OUTPUT FORMAT
-------------
Return formatted meeting notes in Markdown.`;

export const TRANSFORM_USER_PROMPT_TEMPLATE = `TRANSCRIPT
----------
{{transcriptText}}

{{#if options}}
OPTIONS: {{options}}
{{/if}}

Transform the transcript as requested.`;

// ==================== Feature Configuration ====================

export const contentTransformationConfig: AIFeatureConfig = {
  id: "content-transformation",
  name: "Content Transformation",
  category: "export",

  systemPrompt: TRANSFORM_SUMMARY_SYSTEM_PROMPT,
  userPromptTemplate: TRANSFORM_USER_PROMPT_TEMPLATE,

  batchable: false,
  streamable: true, // Stream for long outputs
  defaultBatchSize: 1,

  shortcut: "Alt+E",
  icon: "file-text",
  requiresConfirmation: false, // Output is separate, doesn't modify transcript

  availablePlaceholders: ["transcriptText", "options"],

  // No schema - output is formatted text
  responseSchema: undefined,
};

// ==================== Types ====================

/**
 * Input for content transformation.
 */
export interface ContentTransformationInput {
  transcriptText: string;
  transformationType: TransformationType;
  options?: {
    length?: "short" | "medium" | "long";
    style?: "formal" | "casual" | "technical";
    includeQuotes?: boolean;
    includeTimestamps?: boolean;
  };
}

/**
 * Output from content transformation.
 */
export interface ContentTransformationOutput {
  content: string;
  format: "text" | "markdown" | "html";
  wordCount: number;
}

// ==================== Transformation Configs ====================

export const TRANSFORMATION_TYPES: Record<
  TransformationType,
  { name: string; description: string; systemPrompt: string }
> = {
  "summary-brief": {
    name: "Brief Summary",
    description: "1-2 paragraph overview",
    systemPrompt: TRANSFORM_SUMMARY_SYSTEM_PROMPT,
  },
  "summary-detailed": {
    name: "Detailed Summary",
    description: "Comprehensive summary (500+ words)",
    systemPrompt: TRANSFORM_SUMMARY_SYSTEM_PROMPT,
  },
  "key-points": {
    name: "Key Points",
    description: "Bullet list of main points",
    systemPrompt: TRANSFORM_SUMMARY_SYSTEM_PROMPT,
  },
  "meeting-notes": {
    name: "Meeting Notes",
    description: "Structured meeting notes with action items",
    systemPrompt: TRANSFORM_MEETING_NOTES_SYSTEM_PROMPT,
  },
  article: {
    name: "Article",
    description: "Blog post or article format",
    systemPrompt: TRANSFORM_SUMMARY_SYSTEM_PROMPT,
  },
  "qa-format": {
    name: "Q&A Format",
    description: "Question and answer pairs",
    systemPrompt: TRANSFORM_SUMMARY_SYSTEM_PROMPT,
  },
  "action-items": {
    name: "Action Items",
    description: "Extract action items and tasks",
    systemPrompt: TRANSFORM_MEETING_NOTES_SYSTEM_PROMPT,
  },
};
