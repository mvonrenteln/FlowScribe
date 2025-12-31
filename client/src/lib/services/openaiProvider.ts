/**
 * OpenAI Provider Service
 *
 * Implementation of AIProviderService using the official OpenAI SDK.
 * Supports OpenAI API and compatible endpoints (like Azure, local proxies).
 */

import OpenAI, { APIError } from "openai";
import type {
  AIProviderConfig,
  AIProviderService,
  ChatMessage,
  ChatOptions,
  ChatResponse,
} from "./aiProviderTypes";
import {
  AIProviderAuthError,
  AIProviderConnectionError,
  type AIProviderError,
  AIProviderRateLimitError,
} from "./aiProviderTypes";

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

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    try {
      const completion = await this.client.chat.completions.create(
        {
          model: this.config.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: options?.maxTokens ?? 2048,
          temperature: options?.temperature ?? 0.7,
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
      throw this.handleError(error);
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return models.data.map((m) => m.id).sort();
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }

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

  private parseRetryAfter(error: APIError): number | undefined {
    // Try to extract retry-after from headers if available
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
