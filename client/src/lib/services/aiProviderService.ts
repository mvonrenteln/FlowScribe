/**
 * AI Provider Service Factory
 *
 * @deprecated This module has moved to `@/lib/ai/providers`.
 * Please update your imports to use the new location.
 *
 * This file remains for backward compatibility and re-exports
 * all functionality from the new location.
 *
 * @module services/aiProviderService
 */

// Re-export everything from the new location
export {
  // Types
  type AIProviderType,
  type AIProviderConfig,
  type AIProviderService,
  type ChatRole,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,

  // Errors
  AIProviderError,
  AIProviderConnectionError,
  AIProviderAuthError,
  AIProviderRateLimitError,

  // Providers
  OllamaProvider,
  OpenAIProvider,

  // Factory functions
  createProvider,
  createAIProvider, // deprecated alias
  createProviderConfig,
  generateProviderId,
  validateProviderConfig,
  DEFAULT_PROVIDER_CONFIGS,
} from "@/lib/ai/providers";

