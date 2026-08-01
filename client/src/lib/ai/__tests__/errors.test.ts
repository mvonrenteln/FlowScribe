/**
 * AI Error Tests
 *
 * Tests for the unified AI error system.
 */

import { describe, expect, it } from "vitest";
import {
  AIAuthError,
  AICancellationError,
  AIConfigurationError,
  AIConnectionError,
  AIError,
  AIFeatureNotFoundError,
  AIParseError,
  AIProviderUnavailableError,
  AIRateLimitError,
  AIRequestError,
  AIUnsupportedEnvironmentError,
  AIValidationError,
  getErrorMessage,
  isCancellationError,
  isHardAIErrorCode,
  isRetryableAIError,
  summarizeAIError,
  toAIError,
} from "../core/errors";
import {
  AIProviderAuthError,
  AIProviderConnectionError,
  AIProviderRateLimitError,
  AIProviderUnsupportedEnvironmentError,
} from "../providers/types";

describe("AIError", () => {
  it("should create error with message and code", () => {
    const error = new AIError("Something went wrong", "TEST_ERROR");
    expect(error.message).toBe("Something went wrong");
    expect(error.code).toBe("TEST_ERROR");
    expect(error.name).toBe("AIError");
  });

  it("should include details", () => {
    const error = new AIError("Error", "TEST", { key: "value" });
    expect(error.details).toEqual({ key: "value" });
  });

  it("should provide user message", () => {
    const error = new AIError("Technical message", "TEST");
    expect(error.toUserMessage()).toBe("Technical message");
  });
});

describe("AIParseError", () => {
  it("should create with raw response", () => {
    const error = new AIParseError("Parse failed", "raw response text");
    expect(error.code).toBe("PARSE_ERROR");
    expect(error.rawResponse).toBe("raw response text");
  });

  it("should provide user-friendly message", () => {
    const error = new AIParseError("Parse failed");
    expect(error.toUserMessage()).toContain("unexpected response");
  });
});

describe("AIValidationError", () => {
  it("should create with validation errors", () => {
    const error = new AIValidationError("Validation failed", ["Error 1", "Error 2"]);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.validationErrors).toEqual(["Error 1", "Error 2"]);
  });

  it("should include errors in details", () => {
    const error = new AIValidationError("Validation failed", ["Error 1"]);
    expect(error.details?.validationErrors).toEqual(["Error 1"]);
  });
});

describe("AICancellationError", () => {
  it("should have default message", () => {
    const error = new AICancellationError();
    expect(error.message).toBe("Operation cancelled");
    expect(error.code).toBe("CANCELLED");
  });

  it("should provide user-friendly message", () => {
    const error = new AICancellationError();
    expect(error.toUserMessage()).toContain("cancelled");
  });
});

describe("AIConfigurationError", () => {
  it("should create with message", () => {
    const error = new AIConfigurationError("No provider");
    expect(error.code).toBe("CONFIGURATION_ERROR");
  });

  it("should provide user-friendly message", () => {
    const error = new AIConfigurationError("No provider");
    expect(error.toUserMessage()).toContain("not configured");
  });
});

describe("AIFeatureNotFoundError", () => {
  it("should include feature ID in message", () => {
    const error = new AIFeatureNotFoundError("my-feature");
    expect(error.message).toContain("my-feature");
    expect(error.code).toBe("FEATURE_NOT_FOUND");
  });

  it("should include feature ID in details", () => {
    const error = new AIFeatureNotFoundError("my-feature");
    expect(error.details?.featureId).toBe("my-feature");
  });
});

describe("isCancellationError", () => {
  it("should return true for AICancellationError", () => {
    expect(isCancellationError(new AICancellationError())).toBe(true);
  });

  it("should return true for AbortError", () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    expect(isCancellationError(abortError)).toBe(true);
  });

  it("should return false for timeout AbortError", () => {
    const abortError = new Error("Request timed out");
    abortError.name = "AbortError";
    expect(isCancellationError(abortError)).toBe(false);
  });

  it("should return true for error with cancelled in message", () => {
    expect(isCancellationError(new Error("Operation cancelled"))).toBe(true);
  });

  it("should return false for other errors", () => {
    expect(isCancellationError(new Error("Some error"))).toBe(false);
    expect(isCancellationError(new AIError("error", "CODE"))).toBe(false);
  });

  it("should return false for non-errors", () => {
    expect(isCancellationError("string")).toBe(false);
    expect(isCancellationError(null)).toBe(false);
    expect(isCancellationError(undefined)).toBe(false);
  });
});

describe("toAIError", () => {
  it("should return AIError as-is", () => {
    const error = new AIError("Test", "TEST");
    expect(toAIError(error)).toBe(error);
  });

  it("should convert AbortError to AICancellationError", () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    const result = toAIError(abortError);
    expect(result).toBeInstanceOf(AICancellationError);
  });

  it("should convert timeout AbortError to AIConnectionError", () => {
    const abortError = new Error("Operation timed out");
    abortError.name = "AbortError";
    const result = toAIError(abortError);
    expect(result).toBeInstanceOf(AIConnectionError);
  });

  it("should convert regular Error to AIError", () => {
    const error = new Error("Regular error");
    const result = toAIError(error);
    expect(result).toBeInstanceOf(AIError);
    expect(result.message).toBe("Regular error");
  });

  it("should map provider auth errors to AIAuthError", () => {
    const error = new AIProviderAuthError("Auth failed", "openai");
    const result = toAIError(error);
    expect(result).toBeInstanceOf(AIAuthError);
    expect(result.toUserMessage()).toContain("Authentication failed");
  });

  it("should map provider rate limit errors to AIRateLimitError", () => {
    const error = new AIProviderRateLimitError("Rate limit", "openai");
    const result = toAIError(error);
    expect(result).toBeInstanceOf(AIRateLimitError);
    expect(result.toUserMessage()).toContain("Rate limit");
  });

  it("should map 4xx connection errors to AIRequestError", () => {
    const error = new AIProviderConnectionError("Bad request", "openai", 400);
    const result = toAIError(error);
    expect(result).toBeInstanceOf(AIRequestError);
  });

  it("should map 5xx connection errors to AIProviderUnavailableError", () => {
    const error = new AIProviderConnectionError("Server error", "openai", 503);
    const result = toAIError(error);
    expect(result).toBeInstanceOf(AIProviderUnavailableError);
  });

  it("should map connection errors without status to AIConnectionError", () => {
    const error = new AIProviderConnectionError("Network down", "openai");
    const result = toAIError(error);
    expect(result).toBeInstanceOf(AIConnectionError);
  });

  it("should convert string to AIError", () => {
    const result = toAIError("error message");
    expect(result).toBeInstanceOf(AIError);
    expect(result.message).toBe("error message");
  });

  it("should map unsupported-environment provider errors to AIUnsupportedEnvironmentError", () => {
    const error = new AIProviderUnsupportedEnvironmentError("Web Crypto unavailable", "openai");
    const result = toAIError(error);
    expect(result).toBeInstanceOf(AIUnsupportedEnvironmentError);
    expect(result.code).toBe("UNSUPPORTED_ENVIRONMENT_ERROR");
  });
});

describe("isRetryableAIError", () => {
  it("treats a network interruption as retryable", () => {
    const error = toAIError(new AIProviderConnectionError("Network down", "openai"));
    expect(isRetryableAIError(error)).toBe(true);
  });

  it("treats a request timeout AbortError as retryable", () => {
    const abortError = new Error("Request timed out");
    abortError.name = "AbortError";
    const error = toAIError(abortError);
    expect(isRetryableAIError(error)).toBe(true);
  });

  it("treats HTTP 408 as retryable", () => {
    const error = toAIError(new AIProviderConnectionError("Timeout", "openai", 408));
    expect(isRetryableAIError(error)).toBe(true);
  });

  it("treats HTTP 429 as retryable", () => {
    const error = toAIError(new AIProviderConnectionError("Too many requests", "openai", 429));
    expect(isRetryableAIError(error)).toBe(true);
  });

  it("treats HTTP 500 as retryable", () => {
    const error = toAIError(new AIProviderConnectionError("Server error", "openai", 500));
    expect(isRetryableAIError(error)).toBe(true);
  });

  it("treats HTTP 503 as retryable", () => {
    const error = toAIError(new AIProviderConnectionError("Unavailable", "openai", 503));
    expect(isRetryableAIError(error)).toBe(true);
  });

  it("treats malformed or schema-invalid output as retryable", () => {
    expect(isRetryableAIError(new AIParseError("Parse failed"))).toBe(true);
    expect(isRetryableAIError(new AIValidationError("Validation failed", ["bad field"]))).toBe(
      true,
    );
  });

  it("treats HTTP 400 as non-retryable", () => {
    const error = toAIError(new AIProviderConnectionError("Bad request", "openai", 400));
    expect(isRetryableAIError(error)).toBe(false);
  });

  it("treats HTTP 401 as non-retryable", () => {
    const error = toAIError(new AIProviderConnectionError("Unauthorized", "openai", 401));
    expect(isRetryableAIError(error)).toBe(false);
  });

  it("treats HTTP 403 as non-retryable", () => {
    const error = toAIError(new AIProviderConnectionError("Forbidden", "openai", 403));
    expect(isRetryableAIError(error)).toBe(false);
  });

  it("treats HTTP 422 as non-retryable", () => {
    const error = toAIError(new AIProviderConnectionError("Unprocessable", "openai", 422));
    expect(isRetryableAIError(error)).toBe(false);
  });

  it("treats authentication failures as non-retryable", () => {
    const error = toAIError(new AIProviderAuthError("Auth failed", "openai"));
    expect(isRetryableAIError(error)).toBe(false);
  });

  it("treats missing local configuration as non-retryable", () => {
    expect(isRetryableAIError(new AIConfigurationError("No provider"))).toBe(false);
  });

  it("treats user cancellation as non-retryable", () => {
    expect(isRetryableAIError(new AICancellationError())).toBe(false);
  });

  it("treats unknown model or unsupported provider option as non-retryable", () => {
    expect(isRetryableAIError(new AIFeatureNotFoundError("unsupported-feature"))).toBe(false);
  });

  it("treats unknown/unclassified failures as non-retryable", () => {
    const error = toAIError(new Error("Something odd happened"));
    expect(isRetryableAIError(error)).toBe(false);
  });

  it("treats an unavailable Web Crypto environment as a permanent, non-retryable failure", () => {
    const error = toAIError(
      new AIProviderUnsupportedEnvironmentError("Web Crypto unavailable", "openai"),
    );
    expect(isRetryableAIError(error)).toBe(false);
  });
});

describe("getErrorMessage", () => {
  it("should get user message from AIError", () => {
    const error = new AIParseError("Parse failed");
    expect(getErrorMessage(error)).toContain("unexpected response");
  });

  it("should convert and get message from regular error", () => {
    const error = new Error("Test error");
    expect(getErrorMessage(error)).toBe("Test error");
  });
});

describe("summarizeAIError", () => {
  it("should return message for error without details", () => {
    const error = new Error("Simple error");
    expect(summarizeAIError(error)).toBe("Simple error");
  });

  it("should extract string issues from details", () => {
    const error = new AIError("Failed", "TEST", {
      issues: ["issue one", "issue two"],
    });
    expect(summarizeAIError(error)).toBe("Failed: issue one; issue two");
  });

  it("should extract object issues with message property", () => {
    const error = new AIError("Failed", "TEST", {
      issues: [{ message: "obj issue" }, { message: "another" }],
    });
    const result = summarizeAIError(error);
    expect(result).toContain("obj issue");
    expect(result).toContain("another");
  });

  it("should handle mixed issue types", () => {
    const error = new AIError("Failed", "TEST", {
      issues: ["string issue", { msg: "msg prop" }, { error: "error prop" }],
    });
    const result = summarizeAIError(error);
    expect(result).toContain("string issue");
    expect(result).toContain("msg prop");
    expect(result).toContain("error prop");
  });

  it("should truncate beyond 3 issues", () => {
    const error = new AIError("Failed", "TEST", {
      issues: ["a", "b", "c", "d", "e"],
    });
    const result = summarizeAIError(error);
    expect(result).toBe("Failed: a; b; c (+2 more)");
  });

  it("should handle empty issues array", () => {
    const error = new AIError("Failed", "TEST", { issues: [] });
    expect(summarizeAIError(error)).toBe("Failed");
  });
});

describe("isHardAIErrorCode", () => {
  it("should flag hard error codes", () => {
    expect(isHardAIErrorCode("AUTH_ERROR")).toBe(true);
    expect(isHardAIErrorCode("RATE_LIMIT")).toBe(true);
    expect(isHardAIErrorCode("REQUEST_ERROR")).toBe(true);
    expect(isHardAIErrorCode("PROVIDER_ERROR")).toBe(true);
    expect(isHardAIErrorCode("CONNECTION_ERROR")).toBe(true);
    expect(isHardAIErrorCode("UNSUPPORTED_ENVIRONMENT_ERROR")).toBe(true);
  });

  it("should ignore non-hard error codes", () => {
    expect(isHardAIErrorCode("PARSE_ERROR")).toBe(false);
    expect(isHardAIErrorCode("UNKNOWN_ERROR")).toBe(false);
    expect(isHardAIErrorCode(undefined)).toBe(false);
  });
});
