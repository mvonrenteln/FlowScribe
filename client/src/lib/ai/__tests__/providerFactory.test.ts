/**
 * Provider Factory Tests
 *
 * Tests for the AI provider factory and configuration utilities.
 */

import { describe, expect, it } from "vitest";
import {
  createProvider,
  createProviderConfig,
  DEFAULT_PROVIDER_CONFIGS,
  generateProviderId,
  validateProviderConfig,
} from "../providers/factory";
import { OllamaProvider } from "../providers/ollama";
import { OpenAIProvider } from "../providers/openai";
import type { AIProviderConfig } from "../providers/types";

describe("createProvider", () => {
  const ollamaConfig: AIProviderConfig = {
    id: "test-ollama",
    type: "ollama",
    name: "Test Ollama",
    baseUrl: "http://localhost:11434",
    model: "llama3.2",
  };

  const openaiConfig: AIProviderConfig = {
    id: "test-openai",
    type: "openai",
    name: "Test OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-test",
    model: "gpt-4",
  };

  const customConfig: AIProviderConfig = {
    id: "test-custom",
    type: "custom",
    name: "Test Custom",
    baseUrl: "https://custom.api.com/v1",
    apiKey: "custom-key",
    model: "custom-model",
  };

  it("should create OllamaProvider for ollama type", () => {
    const provider = createProvider(ollamaConfig);
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.config).toEqual(ollamaConfig);
  });

  it("should create OpenAIProvider for openai type", () => {
    const provider = createProvider(openaiConfig);
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.config).toEqual(openaiConfig);
  });

  it("should create OpenAIProvider for custom type", () => {
    const provider = createProvider(customConfig);
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.config).toEqual(customConfig);
  });

  it("should throw for unknown provider type", () => {
    const invalidConfig = { ...ollamaConfig, type: "invalid" as any };
    expect(() => createProvider(invalidConfig)).toThrow("Unknown provider type");
  });
});

describe("generateProviderId", () => {
  it("should generate unique IDs", () => {
    const id1 = generateProviderId();
    const id2 = generateProviderId();
    expect(id1).not.toBe(id2);
  });

  it("should start with 'provider-'", () => {
    const id = generateProviderId();
    expect(id).toMatch(/^provider-/);
  });

  it("should contain timestamp-like number", () => {
    const id = generateProviderId();
    expect(id).toMatch(/^provider-\d+-/);
  });
});

describe("createProviderConfig", () => {
  it("should add generated ID to config", () => {
    const config = createProviderConfig({
      type: "ollama",
      name: "Test",
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
    });

    expect(config.id).toBeDefined();
    expect(config.id).toMatch(/^provider-/);
    expect(config.name).toBe("Test");
  });

  it("should preserve all other properties", () => {
    const config = createProviderConfig({
      type: "openai",
      name: "Test OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-4",
      isDefault: true,
    });

    expect(config.type).toBe("openai");
    expect(config.apiKey).toBe("sk-test");
    expect(config.isDefault).toBe(true);
  });
});

describe("validateProviderConfig", () => {
  it("should return empty array for valid ollama config", () => {
    const errors = validateProviderConfig({
      type: "ollama",
      name: "Test",
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
    });

    expect(errors).toEqual([]);
  });

  it("should return empty array for valid openai config", () => {
    const errors = validateProviderConfig({
      type: "openai",
      name: "Test",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-4",
    });

    expect(errors).toEqual([]);
  });

  it("should require name", () => {
    const errors = validateProviderConfig({
      type: "ollama",
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
    });

    expect(errors).toContain("Provider name is required");
  });

  it("should require base URL", () => {
    const errors = validateProviderConfig({
      type: "ollama",
      name: "Test",
      model: "llama3.2",
    });

    expect(errors).toContain("Base URL is required");
  });

  it("should validate base URL format", () => {
    const errors = validateProviderConfig({
      type: "ollama",
      name: "Test",
      baseUrl: "not-a-url",
      model: "llama3.2",
    });

    expect(errors).toContain("Base URL must be a valid URL");
  });

  it("should require model", () => {
    const errors = validateProviderConfig({
      type: "ollama",
      name: "Test",
      baseUrl: "http://localhost:11434",
    });

    expect(errors).toContain("Model name is required");
  });

  it("should require API key for openai", () => {
    const errors = validateProviderConfig({
      type: "openai",
      name: "Test",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4",
    });

    expect(errors).toContain("API key is required for OpenAI/Custom providers");
  });

  it("should require API key for custom", () => {
    const errors = validateProviderConfig({
      type: "custom",
      name: "Test",
      baseUrl: "https://custom.api.com/v1",
      model: "model",
    });

    expect(errors).toContain("API key is required for OpenAI/Custom providers");
  });

  it("should not require API key for ollama", () => {
    const errors = validateProviderConfig({
      type: "ollama",
      name: "Test",
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
    });

    expect(errors).not.toContain("API key is required for OpenAI/Custom providers");
  });
});

describe("DEFAULT_PROVIDER_CONFIGS", () => {
  it("should have at least one config", () => {
    expect(DEFAULT_PROVIDER_CONFIGS.length).toBeGreaterThan(0);
  });

  it("should have valid configs (no ID required)", () => {
    for (const config of DEFAULT_PROVIDER_CONFIGS) {
      expect(config.type).toBeDefined();
      expect(config.name).toBeDefined();
      expect(config.baseUrl).toBeDefined();
      expect(config.model).toBeDefined();
    }
  });

  it("should have a default ollama config", () => {
    const ollamaConfig = DEFAULT_PROVIDER_CONFIGS.find((c) => c.type === "ollama");
    expect(ollamaConfig).toBeDefined();
    expect(ollamaConfig?.baseUrl).toBe("http://localhost:11434");
  });
});
