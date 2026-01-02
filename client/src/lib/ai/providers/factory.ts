/**
 * AI Provider Factory
 *
 * Central module for creating and managing AI provider instances.
 * Provides a unified interface to work with different AI backends.
 *
 * @module ai/providers/factory
 */

import type { AIProviderConfig, AIProviderService } from "./types";
import { OllamaProvider } from "./ollama";
import { OpenAIProvider } from "./openai";

/**
 * Creates an AI provider instance based on the configuration type.
 *
 * @param config - Provider configuration
 * @returns AIProviderService instance
 * @throws Error if provider type is unknown
 *
 * @example
 * ```ts
 * const provider = createProvider({
 *   id: "local-ollama",
 *   type: "ollama",
 *   name: "Local Ollama",
 *   baseUrl: "http://localhost:11434",
 *   model: "llama3.2",
 * });
 *
 * const response = await provider.chat([
 *   { role: "user", content: "Hello!" }
 * ]);
 * ```
 */
export function createProvider(config: AIProviderConfig): AIProviderService {
  switch (config.type) {
    case "ollama":
      return new OllamaProvider(config);
    case "openai":
    case "custom":
      // Custom providers use the OpenAI-compatible interface
      return new OpenAIProvider(config);
    default: {
      const exhaustiveCheck: never = config.type;
      throw new Error(`Unknown provider type: ${exhaustiveCheck}`);
    }
  }
}

/**
 * @deprecated Use `createProvider` instead.
 */
export const createAIProvider = createProvider;

/**
 * Default provider configurations for quick setup.
 */
export const DEFAULT_PROVIDER_CONFIGS: Omit<AIProviderConfig, "id">[] = [
  {
    type: "ollama",
    name: "Local Ollama",
    baseUrl: "http://localhost:11434",
    model: "llama3.2",
    isDefault: true,
  },
];

/**
 * Generates a unique ID for a new provider configuration.
 */
export function generateProviderId(): string {
  return `provider-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates a new provider configuration with a generated ID.
 */
export function createProviderConfig(config: Omit<AIProviderConfig, "id">): AIProviderConfig {
  return {
    ...config,
    id: generateProviderId(),
  };
}

/**
 * Validates a provider configuration.
 * Returns an array of validation error messages, or empty array if valid.
 */
export function validateProviderConfig(config: Partial<AIProviderConfig>): string[] {
  const errors: string[] = [];

  if (!config.name?.trim()) {
    errors.push("Provider name is required");
  }

  if (!config.baseUrl?.trim()) {
    errors.push("Base URL is required");
  } else {
    try {
      new URL(config.baseUrl);
    } catch {
      errors.push("Base URL must be a valid URL");
    }
  }

  if (!config.model?.trim()) {
    errors.push("Model name is required");
  }

  if ((config.type === "openai" || config.type === "custom") && !config.apiKey?.trim()) {
    errors.push("API key is required for OpenAI/Custom providers");
  }

  return errors;
}

