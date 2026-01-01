/**
 * Prompt Types
 *
 * Type definitions for the prompt system.
 * Prompts are templates that get compiled with variables
 * before being sent to AI providers.
 *
 * @module ai/prompts/types
 */

import type { AIFeatureType } from "../core/types";

// ==================== Prompt Template ====================

/**
 * A prompt template that can be compiled with variables.
 */
export interface PromptTemplate {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Feature type this prompt is for */
  featureType: AIFeatureType;

  /** System prompt (sets AI behavior) */
  systemPrompt: string;

  /** User prompt template with placeholders */
  userPromptTemplate: string;

  /** Whether this is a built-in prompt (not deletable) */
  isBuiltIn: boolean;

  /** Whether this prompt shows in quick access menus */
  quickAccess: boolean;

  /** Whether this is the default prompt for its feature type */
  isDefault: boolean;

  /** Description of what this prompt does */
  description?: string;

  /** Available placeholders for this template */
  placeholders: string[];
}

// ==================== Prompt Variables ====================

/**
 * Variables that can be substituted into prompt templates.
 */
export interface PromptVariables {
  // Segment context
  text?: string;
  speaker?: string;
  previousText?: string;
  nextText?: string;
  confidence?: number;
  timestamp?: string;

  // Batch context
  segments?: string;
  speakers?: string;

  // Transcript metadata
  transcriptTitle?: string;
  transcriptDuration?: number;
  totalSegments?: number;

  // Feature-specific (extensible)
  [key: string]: unknown;
}

// ==================== Compiled Prompt ====================

/**
 * A prompt template compiled with specific variables.
 * Ready to be sent to an AI provider.
 */
export interface CompiledPrompt {
  /** Compiled system prompt */
  systemPrompt: string;

  /** Compiled user prompt */
  userPrompt: string;

  /** Original template ID (for tracking) */
  templateId: string;

  /** Variables used for compilation */
  variables: PromptVariables;

  /** Timestamp of compilation */
  compiledAt: Date;
}

// ==================== Prompt Registry Types ====================

/**
 * Options for registering a prompt.
 */
export interface RegisterPromptOptions {
  /** Override if prompt with same ID exists */
  overwrite?: boolean;
}

/**
 * Result of a prompt operation.
 */
export interface PromptOperationResult {
  success: boolean;
  prompt?: PromptTemplate;
  error?: string;
}

// ==================== Built-in Prompt IDs ====================

/**
 * Well-known IDs for built-in prompts.
 */
export const BUILTIN_PROMPT_IDS = {
  // Speaker Classification
  SPEAKER_DEFAULT: "speaker-default",
  SPEAKER_RPG: "speaker-rpg",

  // Text Revision
  REVISION_CLEANUP: "revision-cleanup",
  REVISION_CLARITY: "revision-clarity",
  REVISION_FORMALIZE: "revision-formalize",

  // Segment Merge (future)
  MERGE_SUGGEST: "merge-suggest",

  // Chapter Detection (future)
  CHAPTER_DETECT: "chapter-detect",
} as const;

export type BuiltinPromptId = (typeof BUILTIN_PROMPT_IDS)[keyof typeof BUILTIN_PROMPT_IDS];

