/**
 * Ollama Provider
 *
 * Implementation of AIProviderService for local Ollama instances.
 * Communicates with Ollama's REST API for chat completions and model listing.
 *
 * @module ai/providers/ollama
 */

import type {
  AIProviderConfig,
  AIProviderService,
  ChatMessage,
  ChatOptions,
  ChatResponse,
} from "./types";
import { AIProviderConnectionError, AIProviderError } from "./types";

/**
 * AI Provider implementation for Ollama.
 *
 * @example
 * ```ts
 * const provider = new OllamaProvider({
 *   id: "local",
 *   type: "ollama",
 *   name: "Local Ollama",
 *   baseUrl: "http://localhost:11434",
 *   model: "llama3.2",
 * });
 *
 * const response = await provider.chat([
 *   { role: "system", content: "You are helpful." },
 *   { role: "user", content: "Hello!" },
 * ]);
 * ```
 */
export class OllamaProvider implements AIProviderService {
  readonly config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * Send a chat completion request to Ollama.
   */
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const baseUrl = this.config.baseUrl.replace(/\/$/, "");
    const chatUrl = `${baseUrl}/api/chat`;
    const generateUrl = `${baseUrl}/api/generate`;

    try {
      const response = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens ?? 2048,
          },
        }),
        signal: options?.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        if (response.status === 404 || response.status === 405) {
          return await this.chatViaGenerate(generateUrl, messages, options);
        }
        throw new AIProviderConnectionError(
          `Ollama API error (${response.status}): ${errorText}`,
          "ollama",
          response.status,
          { body: errorText },
        );
      }

      const data = await response.json();
      return {
        content: data.message?.content ?? data.response ?? "",
        usage:
          data.prompt_eval_count || data.eval_count
            ? {
                promptTokens: data.prompt_eval_count,
                completionTokens: data.eval_count,
                totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
              }
            : undefined,
      };
    } catch (error) {
      if (options?.signal?.aborted) {
        throw error;
      }
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderConnectionError(
        "Failed to communicate with Ollama API",
        "ollama",
        undefined,
        { causeMessage: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  private async chatViaGenerate(
    apiUrl: string,
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const systemMessage = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");
    const prompt = userMessages.map((m) => m.content).join("\n\n");

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        system: systemMessage?.content ?? "",
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 2048,
        },
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new AIProviderConnectionError(
        `Ollama API error (${response.status}): ${errorText}`,
        "ollama",
        response.status,
        { body: errorText },
      );
    }

    const data = await response.json();
    return {
      content: data.response ?? "",
      usage:
        data.prompt_eval_count || data.eval_count
          ? {
              promptTokens: data.prompt_eval_count,
              completionTokens: data.eval_count,
              totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
            }
          : undefined,
    };
  }

  /**
   * List available models from Ollama.
   */
  async listModels(): Promise<string[]> {
    const apiUrl = `${this.config.baseUrl.replace(/\/$/, "")}/api/tags`;

    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new AIProviderConnectionError(
          `Failed to list Ollama models (${response.status})`,
          "ollama",
          response.status,
        );
      }

      const data = await response.json();
      const models = data.models ?? [];
      return models.map((m: { name: string }) => m.name);
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderConnectionError("Failed to connect to Ollama", "ollama", undefined, {
        causeMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Test connection to Ollama by listing models.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }
}
