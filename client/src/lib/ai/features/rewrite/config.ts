/**
 * Chapter Rewrite Configuration
 *
 * Feature configuration, prompts, and schemas for chapter rewrite.
 *
 * @module ai/features/rewrite/config
 */

import type { AIPrompt } from "@/lib/store/types";
import type { AIFeatureConfig } from "../../core/types";

// ==================== Feature Configuration ====================

export const CHAPTER_REFORMULATION_CONFIG: AIFeatureConfig = {
  id: "chapter-rewrite",
  name: "Chapter Rewrite",
  category: "text",

  systemPrompt: `You are an expert editor transforming transcript text.
Your task is to rewrite the provided chapter content according to the given instructions.

GUIDELINES:
- Maintain factual accuracy from the original
- Preserve key points and meaning
- Adapt style according to the prompt instructions
- Ensure smooth flow and coherence
- Output ONLY the rewritten text, no explanations

OUTPUT FORMAT:
Return only the rewritten text. No markdown, no quotes, no explanations.`,

  userPromptTemplate: `# Context

{{#if previousChapterSummaries}}
## Previous Chapters (for style consistency):
{{#each previousChapterSummaries}}
- Chapter {{@index}}: {{this}}
{{/each}}
{{/if}}

{{#if previousChapterText}}
## Previous Chapter Text (last {{contextWordLimit}} words):
{{previousChapterText}}
{{/if}}

# Current Chapter

Title: {{chapterTitle}}
{{#if chapterSummary}}
Summary: {{chapterSummary}}
{{/if}}
{{#if chapterNotes}}
Notes: {{chapterNotes}}
{{/if}}
{{#if chapterTags}}
Tags: {{chapterTags}}
{{/if}}

## Content:
{{chapterContent}}

# Task

{{promptInstructions}}

{{#if customInstructions}}
## Additional Instructions:
{{customInstructions}}
{{/if}}`,

  batchable: true,
  streamable: false,
  defaultBatchSize: 1, // Process one chapter at a time

  requiresConfirmation: true,

  availablePlaceholders: [
    "chapterTitle",
    "chapterSummary",
    "chapterNotes",
    "chapterTags",
    "chapterContent",
    "paragraphContent",
    "previousParagraphs",
    "paragraphContextCount",
    "previousChapterSummaries",
    "previousChapterText",
    "contextWordLimit",
    "promptInstructions",
    "customInstructions",
  ],

  // No schema for rewrite - output is plain text
  responseSchema: undefined,
};

// ==================== Built-in Prompts ====================

/**
 * Default system prompt for all rewrite operations.
 */
export const REWRITE_SYSTEM_PROMPT = `You are an expert editor transforming transcript text.
Your task is to rewrite the provided chapter content according to the given instructions.

GUIDELINES:
- Maintain factual accuracy from the original
- Preserve key points and meaning
- Adapt style according to the instructions
- Ensure smooth flow and coherence
- Output ONLY the rewritten text, no explanations

OUTPUT FORMAT:
Return only the rewritten text. No markdown, no quotes, no explanations.`;

export const BUILTIN_REFORMULATION_PROMPTS: AIPrompt[] = [
  {
    id: "builtin-summarize",
    name: "Summarize",
    type: "chapter-detect",
    operation: "rewrite",
    systemPrompt: REWRITE_SYSTEM_PROMPT,
    userPromptTemplate: `# Context

{{#if previousChapterSummaries}}
## Previous Chapters (for style consistency):
{{#each previousChapterSummaries}}AIPrompt {
  return BUILTIN_REFORMULATION_PROMPTS[0];
}

/**
 * Find a prompt by ID.
 */
export function findRewritePrompt(
  id: string,
  customPrompts: AIPrompt[] = [],
): AIChapter

Title: {{chapterTitle}}
{{#if chapterSummary}}
Summary: {{chapterSummary}}
{{/if}}
{{#if chapterNotes}}
Notes: {{chapterNotes}}
{{/if}}
{{#if chapterTags}}
Tags: {{chapterTags}}
{{/if}}

## Content:
{{chapterContent}}

# Task

Summarize the chapter content:
- Extract key points and main ideas
- Keep it concise (30-50% of original length)
- Maintain chronological flow
- Use clear, direct language

{{#if customInstructions}}
## Additional Instructions:
{{customInstructions}}
{{/if}}`,
    isBuiltIn: true,
    quickAccess: false,
  },
  {
    id: "builtin-narrative",
    name: "Narrative Style",
    type: "chapter-detect",
    operation: "rewrite",
    systemPrompt: REWRITE_SYSTEM_PROMPT,
    userPromptTemplate: `# Context

{{#if previousChapterSummaries}}
## Previous Chapters (for style consistency):
{{#each previousChapterSummaries}}
- Chapter {{@index}}: {{this}}
{{/each}}
{{/if}}

{{#if previousChapterText}}
## Previous Chapter Text (last {{contextWordLimit}} words):
{{previousChapterText}}
{{/if}}

# Current Chapter

Title: {{chapterTitle}}
{{#if chapterSummary}}
Summary: {{chapterSummary}}
{{/if}}
{{#if chapterNotes}}
Notes: {{chapterNotes}}
{{/if}}
{{#if chapterTags}}
Tags: {{chapterTags}}
{{/if}}

## Content:
{{chapterContent}}

# Task

Transform into narrative form:
- Use storytelling techniques
- Create engaging flow
- Maintain factual accuracy
- Add smooth transitions between ideas
- Use vivid, descriptive language where appropriate

{{#if customInstructions}}
## Additional Instructions:
{{customInstructions}}
{{/if}}`,
    isBuiltIn: true,
    quickAccess: false,
  },
];

/**
 * Get the default rewrite prompt.
 */
export function getDefaultRewritePrompt(): AIPrompt {
  return BUILTIN_REFORMULATION_PROMPTS[0];
}

/**
 * Find a prompt by ID.
 */
export function findRewritePrompt(
  id: string,
  customPrompts: AIPrompt[] = [],
): AIPrompt | undefined {
  return (
    BUILTIN_REFORMULATION_PROMPTS.find((p) => p.id === id) || customPrompts.find((p) => p.id === id)
  );
}
