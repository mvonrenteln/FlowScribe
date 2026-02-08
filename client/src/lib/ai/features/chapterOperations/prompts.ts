/**
 * Built-in Chapter Metadata Prompts
 *
 * Default prompts for title, summary, and notes generation.
 *
 * @module ai/features/chapterOperations/prompts
 */

import type { ChapterPrompt } from './types';

/**
 * Built-in Title Suggestion Prompt
 */
export const BUILTIN_TITLE_SUGGESTION: Omit<ChapterPrompt, 'id'> = {
    name: 'Title Suggestion',
    type: 'chapter-detect',
    operation: 'metadata',
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
export const BUILTIN_SUMMARY_GENERATION: Omit<ChapterPrompt, 'id'> = {
    name: 'Summary Generation',
    type: 'chapter-detect',
    operation: 'metadata',
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
export const BUILTIN_SUMMARY_IMPROVEMENT: Omit<ChapterPrompt, 'id'> = {
    name: 'Summary Improvement',
    type: 'chapter-detect',
    operation: 'metadata',
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
export const BUILTIN_NOTES_GENERATION: Omit<ChapterPrompt, 'id'> = {
    name: 'Notes Generation',
    type: 'chapter-detect',
    operation: 'metadata',
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
 * All built-in metadata prompts
 */
export const BUILTIN_METADATA_PROMPTS = [
    BUILTIN_TITLE_SUGGESTION,
    BUILTIN_SUMMARY_GENERATION,
    BUILTIN_SUMMARY_IMPROVEMENT,
    BUILTIN_NOTES_GENERATION,
] as const;
