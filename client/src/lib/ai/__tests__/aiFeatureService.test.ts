/**
 * AI Feature Service Tests
 *
 * Tests for the unified AI feature execution service.
 * Uses mocked providers to test execution logic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRegistry,
  registerFeature,
} from "../core/featureRegistry";
import type { AIFeatureConfig } from "../core/types";

// Mock the provider service
vi.mock("@/lib/services/aiProviderService", () => ({
  createAIProvider: vi.fn(() => ({
    chat: vi.fn().mockResolvedValue({
      content: '{"result": "test"}',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    }),
    config: {
      id: "mock-provider",
      type: "openai",
      name: "Mock Provider",
      baseUrl: "http://localhost",
      model: "gpt-4",
    },
  })),
}));

// Mock settings
vi.mock("@/lib/settings/settingsStorage", () => ({
  initializeSettings: vi.fn(() =>
    Promise.resolve({
      aiProviders: [
        {
          id: "test-provider",
          type: "openai",
          name: "Test Provider",
          baseUrl: "http://test",
          model: "gpt-4",
          isDefault: true,
        },
      ],
      defaultAIProviderId: "test-provider",
    })
  ),
}));

// Import after mocks are set up
import { executeFeature, executeBatch } from "../core/aiFeatureService";
import { createAIProvider } from "@/lib/services/aiProviderService";

describe("AIFeatureService", () => {
  const testFeature: AIFeatureConfig = {
    id: "text-revision",
    name: "Test Feature",
    category: "text",
    systemPrompt: "You are a {{role}}.",
    userPromptTemplate: "Process: {{text}}",
    batchable: true,
    streamable: false,
    defaultBatchSize: 1,
    requiresConfirmation: true,
    availablePlaceholders: ["role", "text"],
    responseSchema: undefined,
  };

  beforeEach(() => {
    clearRegistry();
    registerFeature(testFeature);
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearRegistry();
  });

  describe("executeFeature", () => {
    it("should execute a registered feature", async () => {
      const result = await executeFeature<string>("text-revision", {
        role: "editor",
        text: "Hello world",
      });

      expect(result.success).toBe(true);
      expect(result.metadata.featureId).toBe("text-revision");
    });

    it("should pass compiled prompts to provider", async () => {
      await executeFeature<string>("text-revision", {
        role: "editor",
        text: "Hello world",
      });

      const mockProvider = createAIProvider as unknown as ReturnType<typeof vi.fn>;
      expect(mockProvider).toHaveBeenCalled();
    });

    it("should include metadata in result", async () => {
      const result = await executeFeature<string>("text-revision", {
        role: "editor",
        text: "Hello world",
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.model).toBeDefined();
    });

    it("should throw for unregistered feature", async () => {
      await expect(
        executeFeature<string>("nonexistent" as any, { text: "test" })
      ).rejects.toThrow("not registered");
    });

    it("should handle provider errors", async () => {
      const mockProvider = createAIProvider as unknown as ReturnType<typeof vi.fn>;
      mockProvider.mockReturnValueOnce({
        chat: vi.fn().mockRejectedValue(new Error("API Error")),
        config: { id: "mock", model: "test" },
      });

      const result = await executeFeature<string>("text-revision", {
        text: "test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("API Error");
    });

    it("should handle cancellation", async () => {
      const abortController = new AbortController();

      const mockProvider = createAIProvider as unknown as ReturnType<typeof vi.fn>;
      mockProvider.mockReturnValueOnce({
        chat: vi.fn().mockImplementation(() => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          return Promise.reject(error);
        }),
        config: { id: "mock", model: "test" },
      });

      abortController.abort();

      const result = await executeFeature<string>(
        "text-revision",
        { text: "test" },
        { signal: abortController.signal }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("cancelled");
    });
  });

  describe("executeBatch", () => {
    it("should process multiple inputs", async () => {
      const inputs = [
        { text: "Item 1" },
        { text: "Item 2" },
        { text: "Item 3" },
      ];

      const result = await executeBatch<string>("text-revision", inputs);

      expect(result.results).toHaveLength(3);
      expect(result.summary.total).toBe(3);
      expect(result.summary.succeeded).toBe(3);
      expect(result.summary.failed).toBe(0);
    });

    it("should call progress callback", async () => {
      const onProgress = vi.fn();
      const inputs = [{ text: "Item 1" }, { text: "Item 2" }];

      await executeBatch<string>("text-revision", inputs, {}, { onProgress });

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(1, 2);
      expect(onProgress).toHaveBeenCalledWith(2, 2);
    });

    it("should call item complete callback", async () => {
      const onItemComplete = vi.fn();
      const inputs = [{ text: "Item 1" }];

      await executeBatch<string>("text-revision", inputs, {}, { onItemComplete });

      expect(onItemComplete).toHaveBeenCalledWith(0, expect.objectContaining({
        success: true,
      }));
    });

    it("should handle partial failures", async () => {
      const mockProvider = createAIProvider as unknown as ReturnType<typeof vi.fn>;

      // First call succeeds, second fails, third succeeds
      mockProvider
        .mockReturnValueOnce({
          chat: vi.fn().mockResolvedValue({ content: '"result1"' }),
          config: { id: "mock", model: "test" },
        })
        .mockReturnValueOnce({
          chat: vi.fn().mockRejectedValue(new Error("Failed")),
          config: { id: "mock", model: "test" },
        })
        .mockReturnValueOnce({
          chat: vi.fn().mockResolvedValue({ content: '"result3"' }),
          config: { id: "mock", model: "test" },
        });

      const inputs = [{ text: "1" }, { text: "2" }, { text: "3" }];
      const result = await executeBatch<string>("text-revision", inputs);

      expect(result.summary.total).toBe(3);
      expect(result.summary.succeeded).toBe(2);
      expect(result.summary.failed).toBe(1);
    });

    it("should stop on cancellation", async () => {
      const abortController = new AbortController();
      const mockProvider = createAIProvider as unknown as ReturnType<typeof vi.fn>;

      mockProvider.mockImplementation(() => ({
        chat: vi.fn().mockImplementation(async () => {
          // Abort after first call
          abortController.abort();
          return { content: '"result"' };
        }),
        config: { id: "mock", model: "test" },
      }));

      const inputs = [{ text: "1" }, { text: "2" }, { text: "3" }];
      const result = await executeBatch<string>(
        "text-revision",
        inputs,
        { signal: abortController.signal }
      );

      // Should have processed first, then cancelled rest
      expect(result.summary.failed).toBeGreaterThan(0);
    });
  });
});

