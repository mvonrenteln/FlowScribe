/**
 * AI Prompts Module - Public Exports
 *
 * @module ai/prompts
 */

// Types
export type {
  PromptTemplate,
  PromptVariables,
  CompiledPrompt,
  RegisterPromptOptions,
  PromptOperationResult,
  BuiltinPromptId,
} from "./types";

export { BUILTIN_PROMPT_IDS } from "./types";

// Prompt Builder
export {
  compileTemplate,
  compilePrompt,
  extractPlaceholders,
  validateVariables,
} from "./promptBuilder";

