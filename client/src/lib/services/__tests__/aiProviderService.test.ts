/**
 * AI Provider Service Tests
 */

import { describe, expect, it } from "vitest";
import {
  createAIProvider,
  createProviderConfig,
  generateProviderId,
  validateProviderConfig,
} from "../aiProviderService";
import type { AIProviderConfig } from "../aiProviderTypes";

describe("aiProviderService", () => {
  describe("generateProviderId", () => {
    it("generates unique IDs", () => {
      const id1 = generateProviderId();
      const id2 = generateProviderId();
      expect(id1).not.toBe(id2);
    });

    it("generates IDs with correct prefix", () => {
      const id = generateProviderId();
      expect(id).toMatch(/^provider-\d+-[a-z0-9]+$/);
    });
  });

  describe("createProviderConfig", () => {
    it("creates config with generated ID", () => {
      const config = createProviderConfig({
        type: "ollama",
        name: "Test Provider",
        baseUrl: "http://localhost:11434",
        model: "llama3.2",
      });

      expect(config.id).toBeDefined();
      expect(config.id).toMatch(/^provider-/);
      expect(config.name).toBe("Test Provider");
      expect(config.type).toBe("ollama");
    });
  });

  describe("validateProviderConfig", () => {
    it("returns no errors for valid ollama config", () => {
      const errors = validateProviderConfig({
        type: "ollama",
        name: "Local Ollama",
        baseUrl: "http://localhost:11434",
        model: "llama3.2",
      });
      expect(errors).toHaveLength(0);
    });

    it("returns no errors for valid openai config", () => {
      const errors = validateProviderConfig({
        type: "openai",
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o",
        apiKey: "sk-test-key",
      });
      expect(errors).toHaveLength(0);
    });

    it("returns error for missing name", () => {
      const errors = validateProviderConfig({
        type: "ollama",
        name: "",
        baseUrl: "http://localhost:11434",
        model: "llama3.2",
      });
      expect(errors).toContain("Provider name is required");
    });

    it("returns error for missing baseUrl", () => {
      const errors = validateProviderConfig({
        type: "ollama",
        name: "Test",
        baseUrl: "",
        model: "llama3.2",
      });
      expect(errors).toContain("Base URL is required");
    });

    it("returns error for invalid baseUrl", () => {
      const errors = validateProviderConfig({
        type: "ollama",
        name: "Test",
        baseUrl: "not-a-url",
        model: "llama3.2",
      });
      expect(errors).toContain("Base URL must be a valid URL");
    });

    it("returns error for missing model", () => {
      const errors = validateProviderConfig({
        type: "ollama",
        name: "Test",
        baseUrl: "http://localhost:11434",
        model: "",
      });
      expect(errors).toContain("Model name is required");
    });

    it("returns error for openai without API key", () => {
      const errors = validateProviderConfig({
        type: "openai",
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o",
        apiKey: "",
      });
      expect(errors).toContain("API key is required for OpenAI/Custom providers");
    });

    it("returns error for custom provider without API key", () => {
      const errors = validateProviderConfig({
        type: "custom",
        name: "Custom API",
        baseUrl: "https://custom.api.com/v1",
        model: "custom-model",
      });
      expect(errors).toContain("API key is required for OpenAI/Custom providers");
    });
  });

  describe("createAIProvider", () => {
    it("creates OllamaProvider for ollama type", () => {
      const config: AIProviderConfig = {
        id: "test-1",
        type: "ollama",
        name: "Test",
        baseUrl: "http://localhost:11434",
        model: "llama3.2",
      };
      const provider = createAIProvider(config);
      expect(provider.config).toBe(config);
    });

    it("creates OpenAIProvider for openai type", () => {
      const config: AIProviderConfig = {
        id: "test-2",
        type: "openai",
        name: "Test",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o",
        apiKey: "sk-test",
      };
      const provider = createAIProvider(config);
      expect(provider.config).toBe(config);
    });

    it("creates OpenAIProvider for custom type", () => {
      const config: AIProviderConfig = {
        id: "test-3",
        type: "custom",
        name: "Test",
        baseUrl: "https://custom.api.com/v1",
        model: "custom",
        apiKey: "key-123",
      };
      const provider = createAIProvider(config);
      expect(provider.config).toBe(config);
    });
  });
});
