/**
 * Text Revision Configuration
 *
 * Feature configuration, prompts, and schemas for text revision.
 *
 * @module ai/features/revision/config
 */

import type { AIFeatureConfig } from "../../core/types";
import type { RevisionTemplate } from "./types";

// ==================== Default Prompts ====================

export const REVISION_CLEANUP_SYSTEM_PROMPT = `You are a professional transcript editor.

TASK
----
Clean up and improve the transcript text while preserving the speaker's voice and meaning.

CORRECTIONS TO MAKE:
- Fix spelling and grammar errors
- Remove filler words (um, uh, like, you know) unless they add meaning
- Fix punctuation
- Improve clarity without changing meaning

PRESERVE:
- Speaker's unique voice and style
- Technical terms and proper nouns
- Intentional informal language
- Regional expressions

OUTPUT FORMAT
-------------
Return ONLY the corrected text. No explanations, no markdown, no quotes.
If no changes are needed, return the original text exactly.`;

export const REVISION_CLEANUP_USER_TEMPLATE = `{{#if previousText}}
CONTEXT (previous segment): {{previousText}}
{{/if}}

TEXT TO REVISE:
{{text}}

{{#if nextText}}
CONTEXT (next segment): {{nextText}}
{{/if}}

Provide the corrected text:`;

export const REVISION_CLARITY_SYSTEM_PROMPT = `You are a professional editor focused on clarity.

TASK
----
Improve the clarity and readability of the text while preserving meaning.

IMPROVEMENTS TO MAKE:
- Simplify complex sentences
- Use clearer word choices
- Improve flow and readability
- Fix run-on sentences

PRESERVE:
- Speaker's voice
- Technical accuracy
- Key information

OUTPUT FORMAT
-------------
Return ONLY the improved text. No explanations.`;

export const REVISION_FORMALIZE_SYSTEM_PROMPT = `You are a professional editor for formal documents.

TASK
----
Convert informal speech to formal, professional language.

CHANGES TO MAKE:
- Replace informal expressions with formal alternatives
- Use proper grammar and sentence structure
- Remove contractions (don't -> do not)
- Maintain professional tone

PRESERVE:
- Technical terms
- Key information
- Speaker attribution

OUTPUT FORMAT
-------------
Return ONLY the formalized text. No explanations.`;

// ==================== Feature Configuration ====================

export const textRevisionConfig: AIFeatureConfig = {
  id: "text-revision",
  name: "Text Revision",
  category: "text",

  systemPrompt: REVISION_CLEANUP_SYSTEM_PROMPT,
  userPromptTemplate: REVISION_CLEANUP_USER_TEMPLATE,

  batchable: true,
  streamable: false,
  defaultBatchSize: 1, // Process one segment at a time for text revision

  shortcut: "Alt+R",
  icon: "sparkles",
  requiresConfirmation: true,

  availablePlaceholders: ["text", "previousText", "nextText", "speaker"],

  // No schema for text revision - output is plain text
  responseSchema: undefined,
};

// ==================== Built-in Prompt Templates ====================

export const BUILTIN_REVISION_TEMPLATES: RevisionTemplate[] = [
  {
    id: "builtin-text-cleanup",
    name: "Transcript Cleanup",
    systemPrompt: REVISION_CLEANUP_SYSTEM_PROMPT,
    userPromptTemplate: REVISION_CLEANUP_USER_TEMPLATE,
    isBuiltin: true,
  },
  {
    id: "builtin-clarity",
    name: "Improve Clarity",
    systemPrompt: REVISION_CLARITY_SYSTEM_PROMPT,
    userPromptTemplate: REVISION_CLEANUP_USER_TEMPLATE,
    isBuiltin: true,
  },
  {
    id: "builtin-formalize",
    name: "Formalize",
    systemPrompt: REVISION_FORMALIZE_SYSTEM_PROMPT,
    userPromptTemplate: REVISION_CLEANUP_USER_TEMPLATE,
    isBuiltin: true,
  },
];

/**
 * Get the default revision template.
 */
export function getDefaultTemplate(): RevisionTemplate {
  return BUILTIN_REVISION_TEMPLATES[0];
}

/**
 * Find a template by ID.
 */
export function findTemplate(
  id: string,
  customTemplates: RevisionTemplate[] = [],
): RevisionTemplate | undefined {
  return (
    BUILTIN_REVISION_TEMPLATES.find((t) => t.id === id) || customTemplates.find((t) => t.id === id)
  );
}
