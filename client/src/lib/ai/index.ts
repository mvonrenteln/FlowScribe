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
  type AIBatchResult,
  type AIFeatureCategory,
  type AIFeatureConfig,
  type AIFeatureOptions,
  type AIFeatureResult,
  type AIFeatureState,
  // Types
  type AIFeatureType,
  type BatchCallbacks,
  classifySpeakers,
  executeBatch,
  // Main Service
  executeFeature,
  getAllFeatures,
  getFeature,
  getFeatureOrThrow,
  getFeaturesByCategory,
  hasFeature,
  // Feature Registry
  registerFeature,
  reviseText,
} from "./core";
// Feature configurations
export {
  BUILTIN_REVISION_PROMPTS,
  type SpeakerSuggestion,
  speakerClassificationConfig,
  type TextRevisionInput,
  type TextRevisionOutput,
  textRevisionConfig,
} from "./features";

// Parsing exports
export {
  extractJSON,
  ParseError,
  type ParseResult,
  parseArrayResponse,
  parseResponse,
  type SimpleSchema,
  type ValidationResult,
  validate,
} from "./parsing";
// Prompt exports
export {
  BUILTIN_PROMPT_IDS,
  type CompiledPrompt,
  compilePrompt,
  compileTemplate,
  extractPlaceholders,
  type PromptTemplate,
  type PromptVariables,
  validateVariables,
} from "./prompts";
