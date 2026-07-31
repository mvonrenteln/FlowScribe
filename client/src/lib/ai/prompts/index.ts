/**
 * AI Prompts Module - Public Exports
 *
 * @module ai/prompts
 */

// Prompt Builder
export {
  compilePrompt,
  compileTemplate,
  extractPlaceholders,
  validateVariables,
} from "./promptBuilder";
// Types
export type {
  BuiltinPromptId,
  CompiledPrompt,
  PromptOperationResult,
  PromptTemplate,
  PromptVariables,
  RegisterPromptOptions,
} from "./types";
export { BUILTIN_PROMPT_IDS } from "./types";
