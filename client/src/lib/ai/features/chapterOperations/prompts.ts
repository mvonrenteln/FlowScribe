/**
 * Built-in Chapter Metadata Prompts
 *
 * Default prompts for title, summary, and notes generation.
 *
 * @module ai/features/chapterOperations/prompts
 */

import { REWRITE_SYSTEM_PROMPT } from "../rewrite/config";
import type { ChapterPrompt } from "./types";

/**
 * Built-in Title Suggestion Prompt
 */
export const BUILTIN_TITLE_SUGGESTION: Omit<ChapterPrompt, "id"> = {
  name: "Title Suggestion",
  type: "chapter-detect",
  operation: "metadata",
  metadataType: "title",
  systemPrompt: `You are an expert at creating concise, engaging chapter titles.

Rules:
- Generate 2-3 alternative titles
- Each title must be maximum 7 words
- Titles should be clear and descriptive
- Avoid clickbait or overly creative titles
- Focus on the main topic or theme of the chapter`,

  userPromptTemplate: `Based on the following chapter content, suggest 2-3 concise titles (max 7 words each):

{{#if chapterTitle}}
Current title: {{chapterTitle}}
{{/if}}

Chapter content:
{{chapterSegments}}

Return your response as JSON:
{
  "operation": "title",
  "titleOptions": ["Title Option 1", "Title Option 2", "Title Option 3"]
}`,

  isBuiltIn: true,
  quickAccess: false,
};

/**
 * Built-in Summary Generation Prompt
 */
export const BUILTIN_SUMMARY_GENERATION: Omit<ChapterPrompt, "id"> = {
  name: "Summary Generation",
  type: "chapter-detect",
  operation: "metadata",
  metadataType: "summary",
  systemPrompt: `You are an expert at creating concise chapter summaries.

Rules:
- Generate a single-sentence summary
- Be clear and specific about what the chapter covers
- Avoid vague or generic statements
- Focus on key topics and outcomes`,

  userPromptTemplate: `Based on the following chapter content, generate a one-sentence summary:

{{#if chapterTitle}}
Chapter title: {{chapterTitle}}
{{/if}}

Chapter content:
{{chapterSegments}}

Return your response as JSON:
{
  "operation": "summary",
  "summary": "Your one-sentence summary here"
}`,

  isBuiltIn: true,
  quickAccess: false,
};

/**
 * Built-in Summary Improvement Prompt
 */
export const BUILTIN_SUMMARY_IMPROVEMENT: Omit<ChapterPrompt, "id"> = {
  name: "Summary Improvement",
  type: "chapter-detect",
  operation: "metadata",
  metadataType: "summary",
  systemPrompt: `You are an expert at refining chapter summaries.

Rules:
- Improve the existing summary to be more concise and clear
- Keep it to one sentence
- Preserve the core meaning
- Make it more specific and informative`,

  userPromptTemplate: `Improve the following chapter summary based on the chapter content:

{{#if chapterTitle}}
Chapter title: {{chapterTitle}}
{{/if}}

Current summary: {{currentSummary}}

Chapter content:
{{chapterSegments}}

Return your response as JSON:
{
  "operation": "summary",
  "summary": "Your improved one-sentence summary here"
}`,

  isBuiltIn: true,
  quickAccess: false,
};

/**
 * Built-in Notes Generation Prompt
 */
export const BUILTIN_NOTES_GENERATION: Omit<ChapterPrompt, "id"> = {
  name: "Notes Generation",
  type: "chapter-detect",
  operation: "metadata",
  metadataType: "notes",
  systemPrompt: `You are an expert editor creating editorial notes for chapters.

Rules:
- Generate brief editorial notes (2-4 sentences)
- Focus on observations, themes, or areas for improvement
- Be constructive and specific
- Consider context and coherence`,

  userPromptTemplate: `Based on the following chapter, generate editorial notes:

{{#if chapterTitle}}
Chapter title: {{chapterTitle}}
{{/if}}

{{#if summary}}
Summary: {{summary}}
{{/if}}

Chapter content:
{{chapterSegments}}

Return your response as JSON:
{
  "operation": "notes",
  "notes": "Your editorial notes here (2-4 sentences)"
}`,

  isBuiltIn: true,
  quickAccess: false,
};

/**
 * Built-in Summarize Prompt
 */
export const BUILTIN_REWRITE_SUMMARIZE: Omit<ChapterPrompt, "id"> = {
  name: "Summarize",
  type: "chapter-detect",
  operation: "rewrite",
  rewriteScope: "chapter",
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
};

/**
 * Built-in Narrative Style Prompt
 */
export const BUILTIN_REWRITE_NARRATIVE: Omit<ChapterPrompt, "id"> = {
  name: "Narrative Style",
  type: "chapter-detect",
  operation: "rewrite",
  rewriteScope: "chapter",
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
};

/**
 * Built-in Paragraph Refine Prompt
 */
export const BUILTIN_REWRITE_PARAGRAPH_REFINE: Omit<ChapterPrompt, "id"> = {
  name: "Refine Paragraph",
  type: "chapter-detect",
  operation: "rewrite",
  rewriteScope: "paragraph",
  systemPrompt: REWRITE_SYSTEM_PROMPT,
  userPromptTemplate: `# Context

{{#if previousParagraphs}}
## Previous Paragraphs (for continuity):
{{#each previousParagraphs}}
- {{this}}
{{/each}}
{{/if}}

# Paragraph

{{paragraphContent}}

# Task

Rewrite the paragraph with improved clarity and flow:
- Preserve the original meaning and facts
- Keep it to a single paragraph
- Maintain the surrounding context and style

{{#if customInstructions}}
## Additional Instructions:
{{customInstructions}}
{{/if}}`,
  isBuiltIn: true,
  quickAccess: false,
};

/**
 * All built-in rewrite prompts
 */
export const BUILTIN_REWRITE_PROMPTS = [
  BUILTIN_REWRITE_SUMMARIZE,
  BUILTIN_REWRITE_NARRATIVE,
  BUILTIN_REWRITE_PARAGRAPH_REFINE,
] as const;

/**
 * All built-in metadata prompts
 */
export const BUILTIN_METADATA_PROMPTS = [
  BUILTIN_TITLE_SUGGESTION,
  BUILTIN_SUMMARY_GENERATION,
  BUILTIN_NOTES_GENERATION,
] as const;
