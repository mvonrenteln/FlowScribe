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
  AIProviderAuthError,
  type AIProviderConfig,
  AIProviderConnectionError,
  AIProviderError,
  AIProviderRateLimitError,
  type AIProviderService,
  type AIProviderType,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type ChatRole,
} from "@/lib/ai/providers/types";
