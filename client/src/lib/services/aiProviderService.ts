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
  AIProviderAuthError,
  type AIProviderConfig,
  AIProviderConnectionError,
  // Errors
  AIProviderError,
  AIProviderRateLimitError,
  type AIProviderService,
  // Types
  type AIProviderType,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type ChatRole,
  createAIProvider, // deprecated alias
  // Factory functions
  createProvider,
  createProviderConfig,
  DEFAULT_PROVIDER_CONFIGS,
  generateProviderId,
  // Providers
  OllamaProvider,
  OpenAIProvider,
  validateProviderConfig,
} from "@/lib/ai/providers";
