/**
 * AI Providers Module - Public Exports
 *
 * This module provides the provider abstraction layer for communicating
 * with different AI backends (Ollama, OpenAI, custom endpoints).
 *
 * @module ai/providers
 */

// Types
export type {
  AIProviderType,
  AIProviderConfig,
  AIProviderService,
  ChatRole,
  ChatMessage,
  ChatOptions,
  ChatResponse,
} from "./types";

// Error classes
export {
  AIProviderError,
  AIProviderConnectionError,
  AIProviderAuthError,
  AIProviderRateLimitError,
} from "./types";

// Provider implementations
export { OllamaProvider } from "./ollama";
export { OpenAIProvider } from "./openai";

// Factory
export {
  createProvider,
  createAIProvider, // deprecated alias
  createProviderConfig,
  generateProviderId,
  validateProviderConfig,
  DEFAULT_PROVIDER_CONFIGS,
} from "./factory";

