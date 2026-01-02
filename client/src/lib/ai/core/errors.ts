/**
 * AI Error Types
 *
 * Unified error types for the AI module.
 * Provides consistent error handling across all AI features.
 *
 * @module ai/core/errors
 */

// Re-export provider errors
export {
  AIProviderAuthError,
  AIProviderConnectionError,
  AIProviderError,
  AIProviderRateLimitError,
} from "../providers/types";

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
    return "The AI returned an unexpected response format. Please try again.";
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
    return "The AI response was invalid. Please try again with different input.";
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
    return "The operation was cancelled.";
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
    return "AI is not configured. Please add an AI provider in Settings.";
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
    return "The requested AI feature is not available.";
  }
}

// ==================== Error Utilities ====================

/**
 * Check if an error is a cancellation error.
 */
export function isCancellationError(error: unknown): boolean {
  if (error instanceof AICancellationError) {
    return true;
  }
  if (error instanceof Error) {
    return error.name === "AbortError" || error.message.includes("cancelled");
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

  if (error instanceof Error) {
    if (error.name === "AbortError") {
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
