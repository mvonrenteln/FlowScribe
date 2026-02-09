/**
 * Built-in Metadata Prompts for Chapter Operations
 *
 * These prompts are registered in the aiChapterDetectionConfig
 * alongside the chapter detection prompt.
 */

import {
  BUILTIN_NOTES_GENERATION,
  BUILTIN_REWRITE_NARRATIVE,
  BUILTIN_REWRITE_PARAGRAPH_REFINE,
  BUILTIN_REWRITE_SUMMARIZE,
  BUILTIN_SUMMARY_GENERATION,
  BUILTIN_TITLE_SUGGESTION,
} from "@/lib/ai/features/chapterOperations/prompts";
import type { AIPrompt } from "../types";

export const BUILTIN_TITLE_SUGGESTION_ID = "builtin-chapter-title-suggestion";
export const BUILTIN_SUMMARY_GENERATION_ID = "builtin-chapter-summary-generation";
export const BUILTIN_NOTES_GENERATION_ID = "builtin-chapter-notes-generation";
export const BUILTIN_REWRITE_SUMMARIZE_ID = "builtin-chapter-rewrite-summarize";
export const BUILTIN_REWRITE_NARRATIVE_ID = "builtin-chapter-rewrite-narrative";
export const BUILTIN_REWRITE_PARAGRAPH_REFINE_ID = "builtin-chapter-rewrite-paragraph-refine";

/**
 * Built-in metadata prompts with stable IDs compatible with AIPrompt interface.
 * These extend ChapterPrompt with type: "chapter-detect" for compatibility.
 */
export const BUILTIN_METADATA_PROMPTS: AIPrompt[] = [
  {
    ...BUILTIN_TITLE_SUGGESTION,
    id: BUILTIN_TITLE_SUGGESTION_ID,
    type: "chapter-detect",
  } as AIPrompt,
  {
    ...BUILTIN_SUMMARY_GENERATION,
    id: BUILTIN_SUMMARY_GENERATION_ID,
    type: "chapter-detect",
  } as AIPrompt,
  {
    ...BUILTIN_NOTES_GENERATION,
    id: BUILTIN_NOTES_GENERATION_ID,
    type: "chapter-detect",
  } as AIPrompt,
  {
    ...BUILTIN_REWRITE_SUMMARIZE,
    id: BUILTIN_REWRITE_SUMMARIZE_ID,
    type: "chapter-detect",
  } as AIPrompt,
  {
    ...BUILTIN_REWRITE_NARRATIVE,
    id: BUILTIN_REWRITE_NARRATIVE_ID,
    type: "chapter-detect",
  } as AIPrompt,
  {
    ...BUILTIN_REWRITE_PARAGRAPH_REFINE,
    id: BUILTIN_REWRITE_PARAGRAPH_REFINE_ID,
    type: "chapter-detect",
  } as AIPrompt,
];

/**
 * Set of all built-in prompt IDs (detection + metadata).
 */
export const BUILTIN_PROMPT_IDS = new Set(BUILTIN_METADATA_PROMPTS.map((p) => p.id));
