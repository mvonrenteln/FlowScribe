/**
 * AI Module - Main Public API
 *
 * Unified AI service layer for FlowScribe.
 * Provides a consistent interface for all AI features.
 *
 * @module ai
 *
 * @example
 * ```ts
 * import { executeFeature, classifySpeakers, reviseText } from "@/lib/ai";
 *
 * // Execute any feature by ID
 * const result = await executeFeature("speaker-classification", {
 *   speakers: "Alice, Bob",
 *   segments: "[1] Hello there...",
 * });
 *
 * // Or use convenience wrappers
 * const suggestions = await classifySpeakers(segments, speakers);
 * const revised = await reviseText("Hello wrold");
 * ```
 */

// Core exports
export {
  // Types
  type AIFeatureType,
  type AIFeatureCategory,
  type AIFeatureConfig,
  type AIFeatureOptions,
  type AIFeatureResult,
  type AIFeatureState,
  type AIBatchResult,
  type BatchCallbacks,

  // Feature Registry
  registerFeature,
  getFeature,
  getFeatureOrThrow,
  hasFeature,
  getAllFeatures,
  getFeaturesByCategory,

  // Main Service
  executeFeature,
  executeBatch,
  classifySpeakers,
  reviseText,
} from "./core";

// Prompt exports
export {
  type PromptTemplate,
  type PromptVariables,
  type CompiledPrompt,
  BUILTIN_PROMPT_IDS,
  compileTemplate,
  compilePrompt,
  extractPlaceholders,
  validateVariables,
} from "./prompts";

// Parsing exports
export {
  type ParseResult,
  type ValidationResult,
  type SimpleSchema,
  ParseError,
  extractJSON,
  parseResponse,
  parseArrayResponse,
  validate,
} from "./parsing";

// Feature configurations
export {
  speakerClassificationConfig,
  textRevisionConfig,
  BUILTIN_REVISION_PROMPTS,
  type SpeakerSuggestion,
  type TextRevisionInput,
  type TextRevisionOutput,
} from "./features";

