/**
 * AI Error Types
 *
 * Unified error types for the AI module.
 * Provides consistent error handling across all AI features.
 *
 * @module ai/core/errors
 */

import { getI18nInstance } from "@/i18n/config";
import {
  AIProviderAuthError,
  AIProviderConnectionError,
  AIProviderError,
  AIProviderRateLimitError,
} from "../providers/types";
import { summarizeMessages } from "./formatting";

// Re-export provider errors
export {
  AIProviderAuthError,
  AIProviderConnectionError,
  AIProviderError,
  AIProviderRateLimitError,
} from "../providers/types";

const t = getI18nInstance().t.bind(getI18nInstance());

// ==================== Base AI Error ====================

/**
 * Base class for AI-related errors.
 */
export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AIError";
  }

  /**
   * Create a user-friendly error message.
   */
  toUserMessage(): string {
    return this.message;
  }
}

// ==================== Specific Error Types ====================

/**
 * Error thrown when AI response parsing fails.
 */
export class AIParseError extends AIError {
  constructor(
    message: string,
    public readonly rawResponse?: string,
    details?: Record<string, unknown>,
  ) {
    super(message, "PARSE_ERROR", details);
    this.name = "AIParseError";
  }

  toUserMessage(): string {
    return t("aiErrors.parse");
  }
}

/**
 * Error thrown when AI response validation fails.
 */
export class AIValidationError extends AIError {
  constructor(
    message: string,
    public readonly validationErrors: string[],
    details?: Record<string, unknown>,
  ) {
    super(message, "VALIDATION_ERROR", {
      ...details,
      validationErrors,
    });
    this.name = "AIValidationError";
  }

  toUserMessage(): string {
    return t("aiErrors.validation");
  }
}

/**
 * Error thrown when an AI operation is cancelled.
 */
export class AICancellationError extends AIError {
  constructor(message = "Operation cancelled", details?: Record<string, unknown>) {
    super(message, "CANCELLED", details);
    this.name = "AICancellationError";
  }

  toUserMessage(): string {
    return t("aiErrors.cancelled");
  }
}

/**
 * Error thrown when no provider is configured.
 */
export class AIConfigurationError extends AIError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFIGURATION_ERROR", details);
    this.name = "AIConfigurationError";
  }

  toUserMessage(): string {
    return t("aiErrors.configuration");
  }
}

/**
 * Error thrown when a feature is not registered.
 */
export class AIFeatureNotFoundError extends AIError {
  constructor(featureId: string, details?: Record<string, unknown>) {
    super(`Feature "${featureId}" is not registered`, "FEATURE_NOT_FOUND", {
      ...details,
      featureId,
    });
    this.name = "AIFeatureNotFoundError";
  }

  toUserMessage(): string {
    return t("aiErrors.featureNotFound");
  }
}

/**
 * Error thrown when provider authentication fails.
 */
export class AIAuthError extends AIError {
  constructor(details?: Record<string, unknown>) {
    super(t("aiErrors.auth"), "AUTH_ERROR", details);
    this.name = "AIAuthError";
  }

  toUserMessage(): string {
    return t("aiErrors.auth");
  }
}

/**
 * Error thrown when provider rate limits requests.
 */
export class AIRateLimitError extends AIError {
  constructor(details?: Record<string, unknown>) {
    super(t("aiErrors.rateLimit"), "RATE_LIMIT", details);
    this.name = "AIRateLimitError";
  }

  toUserMessage(): string {
    return t("aiErrors.rateLimit");
  }
}

/**
 * Error thrown when a request is rejected by the provider.
 */
export class AIRequestError extends AIError {
  constructor(details?: Record<string, unknown>) {
    super(t("aiErrors.request"), "REQUEST_ERROR", details);
    this.name = "AIRequestError";
  }

  toUserMessage(): string {
    return t("aiErrors.request");
  }
}

/**
 * Error thrown when provider returns a server-side failure.
 */
export class AIProviderUnavailableError extends AIError {
  constructor(details?: Record<string, unknown>) {
    super(t("aiErrors.providerUnavailable"), "PROVIDER_ERROR", details);
    this.name = "AIProviderUnavailableError";
  }

  toUserMessage(): string {
    return t("aiErrors.providerUnavailable");
  }
}

/**
 * Error thrown when provider cannot be reached.
 */
export class AIConnectionError extends AIError {
  constructor(details?: Record<string, unknown>) {
    super(t("aiErrors.connection"), "CONNECTION_ERROR", details);
    this.name = "AIConnectionError";
  }

  toUserMessage(): string {
    return t("aiErrors.connection");
  }
}

// ==================== Error Utilities ====================

/**
 * Check if an error is a cancellation error.
 */
function isTimeoutMessage(message: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("timeout") ||
    lowered.includes("timed out") ||
    lowered.includes("etimedout") ||
    lowered.includes("deadline") ||
    lowered.includes("time limit")
  );
}

export function isCancellationError(error: unknown): boolean {
  if (error instanceof AICancellationError) {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return !isTimeoutMessage(error.message);
    }
    return error.message.includes("cancelled");
  }
  return false;
}

/**
 * Convert any error to an AIError.
 */
export function toAIError(error: unknown): AIError {
  if (error instanceof AIError) {
    return error;
  }

  if (error instanceof AIProviderAuthError) {
    return new AIAuthError({
      providerType: error.providerType,
      ...error.details,
    });
  }

  if (error instanceof AIProviderRateLimitError) {
    return new AIRateLimitError({
      providerType: error.providerType,
      retryAfter: error.retryAfter,
      ...error.details,
    });
  }

  if (error instanceof AIProviderConnectionError) {
    const statusCode = error.statusCode;
    if (typeof statusCode === "number") {
      if (statusCode >= 400 && statusCode < 500) {
        return new AIRequestError({
          providerType: error.providerType,
          statusCode,
          ...error.details,
        });
      }
      if (statusCode >= 500) {
        return new AIProviderUnavailableError({
          providerType: error.providerType,
          statusCode,
          ...error.details,
        });
      }
    }

    return new AIConnectionError({
      providerType: error.providerType,
      statusCode,
      ...error.details,
    });
  }

  if (error instanceof AIProviderError) {
    return new AIProviderUnavailableError({
      providerType: error.providerType,
      ...error.details,
    });
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      if (isTimeoutMessage(error.message)) {
        return new AIConnectionError({
          reason: "timeout",
          originalError: error.message,
        });
      }
      return new AICancellationError();
    }
    return new AIError(error.message, "UNKNOWN_ERROR", {
      originalError: error.name,
    });
  }

  return new AIError(String(error), "UNKNOWN_ERROR");
}

/**
 * Create a user-friendly error message from any error.
 */
export function getErrorMessage(error: unknown): string {
  const aiError = toAIError(error);
  return aiError.toUserMessage();
}

// ==================== Error Summarization ====================

const HARD_ERROR_CODES = new Set<string>([
  "AUTH_ERROR",
  "RATE_LIMIT",
  "REQUEST_ERROR",
  "PROVIDER_ERROR",
  "CONNECTION_ERROR",
]);

/**
 * Check if an error code should trigger a toast.
 */
export function isHardAIErrorCode(code?: string | null): boolean {
  if (!code) return false;
  return HARD_ERROR_CODES.has(code);
}

/**
 * Summarize an AI error into a short, user-friendly message.
 */
export function summarizeAIError(error: Error): string {
  const aiError = toAIError(error);
  const baseMessage = aiError.toUserMessage();

  if ("details" in aiError && aiError.details && typeof aiError.details === "object") {
    const details = aiError.details as Record<string, unknown>;
    const issues = details.issues;

    if (Array.isArray(issues) && issues.length > 0) {
      const summary = summarizeMessages(issues);
      if (summary) {
        return `${baseMessage}: ${summary}`;
      }
    }
  }

  return baseMessage;
}
