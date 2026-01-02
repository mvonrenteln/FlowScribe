/**
 * Text Revision Feature Configuration
 *
 * Configuration for the AI text revision feature.
 * Provides automatic text cleanup, grammar correction, and style improvement.
 *
 * @module ai/features/textRevision
 */

import type { AIFeatureConfig } from "../core/types";

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
- Remove contractions (don't → do not)
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

// ==================== Built-in Prompt Configurations ====================

export const BUILTIN_REVISION_PROMPTS = [
  {
    id: "revision-cleanup",
    name: "Transcript Cleanup",
    systemPrompt: REVISION_CLEANUP_SYSTEM_PROMPT,
    userPromptTemplate: REVISION_CLEANUP_USER_TEMPLATE,
    description: "Fix spelling, remove filler words, improve grammar",
    isDefault: true,
  },
  {
    id: "revision-clarity",
    name: "Improve Clarity",
    systemPrompt: REVISION_CLARITY_SYSTEM_PROMPT,
    userPromptTemplate: REVISION_CLEANUP_USER_TEMPLATE,
    description: "Make text clearer and easier to read",
    isDefault: false,
  },
  {
    id: "revision-formalize",
    name: "Formalize",
    systemPrompt: REVISION_FORMALIZE_SYSTEM_PROMPT,
    userPromptTemplate: REVISION_CLEANUP_USER_TEMPLATE,
    description: "Convert informal speech to formal language",
    isDefault: false,
  },
];

// ==================== Types ====================

/**
 * Input for text revision.
 */
export interface TextRevisionInput {
  text: string;
  previousText?: string;
  nextText?: string;
  speaker?: string;
}

/**
 * Output from text revision.
 */
export interface TextRevisionOutput {
  revisedText: string;
  hasChanges: boolean;
}
