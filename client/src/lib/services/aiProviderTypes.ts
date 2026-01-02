/**
 * AI Provider Types
 *
 * @deprecated This module has moved to `@/lib/ai/providers/types`.
 * Please update your imports to use the new location.
 *
 * This file remains for backward compatibility and re-exports
 * all types from the new location.
 *
 * @module services/aiProviderTypes
 */

export {
  type AIProviderType,
  type AIProviderConfig,
  type AIProviderService,
  type ChatRole,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  AIProviderError,
  AIProviderConnectionError,
  AIProviderAuthError,
  AIProviderRateLimitError,
} from "@/lib/ai/providers/types";
