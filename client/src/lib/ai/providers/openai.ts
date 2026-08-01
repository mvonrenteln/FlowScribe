/**
 * OpenAI Provider
 *
 * Implementation of AIProviderService using the official OpenAI SDK.
 * Supports OpenAI API and compatible endpoints (like Azure, local proxies).
 *
 * @module ai/providers/openai
 */

import OpenAI, { APIError } from "openai";
import type {
  AIProviderConfig,
  AIProviderService,
  ChatMessage,
  ChatOptions,
  ChatResponse,
} from "./types";
import {
  AIProviderAuthError,
  AIProviderConnectionError,
  type AIProviderError,
  AIProviderRateLimitError,
  AIProviderUnsupportedEnvironmentError,
} from "./types";

const OPENAI_TEMPERATURE_LIMITS = {
  min: 0,
  max: 2,
};

/**
 * Check whether the model belongs to the GPT-5 family.
 */
export function isGpt5Model(model: string): boolean {
  return /^gpt-5([-.].+)?$/i.test(model.trim());
}

/**
 * Normalize temperature for OpenAI-compatible models.
 * GPT-5 models require temperature to be 1.
 */
export function normalizeOpenAITemperature(model: string, temperature: number): number {
  if (isGpt5Model(model)) {
    return 1;
  }

  return Math.min(
    OPENAI_TEMPERATURE_LIMITS.max,
    Math.max(OPENAI_TEMPERATURE_LIMITS.min, temperature),
  );
}

/**
 * Derive a stable, privacy-safe OpenAI prompt-cache key for a chat request.
 *
 * The key is a SHA-256 digest (lowercase hex) of the exact model string and the
 * ordered list of system-message contents, encoded unambiguously via
 * `JSON.stringify`. Only browser-standard Web Crypto is used; no dependency,
 * no local caching of the digest, and no fallback hashing.
 *
 * User/assistant messages (transcript content, corrective retry history, etc.)
 * are intentionally excluded so that appended retry messages do not change the
 * key, and so that no raw prompt, transcript, or response text leaks into the
 * cache key sent to the provider.
 *
 * Caching is mandatory for built-in OpenAI requests, so an unavailable Web
 * Crypto API (e.g. the app served over a non-secure/plain-HTTP origin) is
 * treated as a permanent, non-retryable environment failure rather than
 * silently sending an uncached request or surfacing a misleading transient
 * "connection error".
 */
async function buildPromptCacheKey(
  model: string,
  messages: readonly ChatMessage[],
): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new AIProviderUnsupportedEnvironmentError(
      "Web Crypto (crypto.subtle) is unavailable in this browser context. " +
        "OpenAI prompt caching requires a secure context (HTTPS or localhost).",
      "openai",
    );
  }

  const systemContents = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content);

  const identity = JSON.stringify([model, systemContents]);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identity),
  );

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * AI Provider implementation for OpenAI and compatible APIs.
 *
 * @example
 * ```ts
 * const provider = new OpenAIProvider({
 *   id: "openai-main",
 *   type: "openai",
 *   name: "OpenAI",
 *   baseUrl: "https://api.openai.com/v1",
 *   apiKey: "sk-...",
 *   model: "gpt-4",
 * });
 *
 * const response = await provider.chat([
 *   { role: "user", content: "Hello!" },
 * ]);
 * ```
 */
export class OpenAIProvider implements AIProviderService {
  readonly config: AIProviderConfig;
  private client: OpenAI;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey ?? "",
      baseURL: config.baseUrl,
      dangerouslyAllowBrowser: true, // Required for browser usage
    });
  }

  /**
   * Send a chat completion request to OpenAI.
   */
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    try {
      const fallbackTemperature = 0.7;
      const temperature = normalizeOpenAITemperature(
        this.config.model,
        options?.temperature ?? fallbackTemperature,
      );

      const promptCache =
        this.config.type === "openai"
          ? {
              prompt_cache_key: await buildPromptCacheKey(this.config.model, messages),
              prompt_cache_retention: "in-memory" as const,
            }
          : {};

      const completion = await this.client.chat.completions.create(
        {
          model: this.config.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: options?.maxTokens ?? 2048,
          temperature,
          ...promptCache,
        },
        {
          signal: options?.signal,
        },
      );

      return {
        content: completion.choices[0]?.message?.content ?? "",
        usage: completion.usage
          ? {
              promptTokens: completion.usage.prompt_tokens,
              completionTokens: completion.usage.completion_tokens,
              totalTokens: completion.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      if (options?.signal?.aborted) {
        throw error;
      }
      if (error instanceof AIProviderUnsupportedEnvironmentError) {
        throw error;
      }
      throw this.handleError(error);
    }
  }

  /**
   * List available models from OpenAI.
   */
  async listModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return models.data.map((m) => m.id).sort();
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Test connection to OpenAI by listing models.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert OpenAI SDK errors to unified error types.
   */
  private handleError(error: unknown): AIProviderError {
    if (error instanceof APIError) {
      const status = error.status;
      const message = error.message;

      // Authentication error
      if (status === 401 || status === 403) {
        return new AIProviderAuthError(`Authentication failed: ${message}`, "openai", {
          status,
          originalError: message,
        });
      }

      // Rate limit error
      if (status === 429) {
        const retryAfter = this.parseRetryAfter(error);
        return new AIProviderRateLimitError(
          `Rate limit exceeded: ${message}`,
          "openai",
          retryAfter,
          { status, originalError: message },
        );
      }

      // Connection/server error
      return new AIProviderConnectionError(`OpenAI API error: ${message}`, "openai", status, {
        originalError: message,
      });
    }

    // Network or unknown error
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new AIProviderConnectionError(
      `Failed to connect to OpenAI: ${errorMessage}`,
      "openai",
      undefined,
      { causeMessage: errorMessage },
    );
  }

  /**
   * Parse retry-after header from rate limit response.
   */
  private parseRetryAfter(error: APIError): number | undefined {
    const headers = error.headers;
    if (headers) {
      const retryAfter = headers.get("retry-after");
      if (retryAfter) {
        const parsed = Number.parseInt(retryAfter, 10);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }
    return undefined;
  }
}
