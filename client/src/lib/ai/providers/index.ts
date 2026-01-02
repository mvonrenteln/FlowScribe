/**
 * AI Providers Module - Public Exports
 *
 * This module provides the provider abstraction layer for communicating
 * with different AI backends (Ollama, OpenAI, custom endpoints).
 *
 * @module ai/providers
 */

// Factory
export {
  createAIProvider, // deprecated alias
  createProvider,
  createProviderConfig,
  DEFAULT_PROVIDER_CONFIGS,
  generateProviderId,
  validateProviderConfig,
} from "./factory";
// Provider implementations
export { OllamaProvider } from "./ollama";
export { OpenAIProvider } from "./openai";
// Types
export type {
  AIProviderConfig,
  AIProviderService,
  AIProviderType,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ChatRole,
} from "./types";
// Error classes
export {
  AIProviderAuthError,
  AIProviderConnectionError,
  AIProviderError,
  AIProviderRateLimitError,
} from "./types";
