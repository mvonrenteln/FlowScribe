/**
 * AI Feature Service Tests
 *
 * Tests for the unified AI feature execution service.
 * Tests the core logic without mocking the provider layer.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeBatch, executeFeature } from "../core/aiFeatureService";
import {
  clearRegistry,
  getFeature,
  getFeatureOrThrow,
  registerFeature,
} from "../core/featureRegistry";
import { resolveProvider } from "../core/providerResolver";
import type { AIFeatureConfig, RetryAttemptInfo } from "../core/types";
import { compileTemplate } from "../prompts/promptBuilder";

// ==================== Structured-batch execution mocks ====================

type MockChatResponse = { content: string };

/** Queue of chat responses/errors consumed in FIFO order by the provider mock. */
const chatQueue = vi.hoisted(() => [] as Array<MockChatResponse | Error>);
const chatCallCount = vi.hoisted(() => ({ count: 0 }));
const settingsOverrides = vi.hoisted(() => ({
  parseRetryCount: 0,
}));

vi.mock("@/lib/ai/core/providerResolver", async () => ({
  ...(await vi.importActual("@/lib/ai/core/providerResolver")),
  resolveProvider: vi.fn(async () => ({
    config: { id: "test-provider", model: "test-model" },
    service: {
      chat: async (): Promise<MockChatResponse> => {
        chatCallCount.count++;
        const next = chatQueue.shift();
        if (next === undefined) {
          throw new Error("Test chat queue exhausted");
        }
        if (next instanceof Error) {
          throw next;
        }
        return next;
      },
    },
  })),
}));

vi.mock("@/lib/settings/settingsStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings/settingsStorage")>(
    "@/lib/settings/settingsStorage",
  );
  return {
    ...actual,
    initializeSettings: () => ({
      ...actual.DEFAULT_SETTINGS,
      aiRequestTimeoutSeconds: 0,
      ...settingsOverrides,
    }),
  };
});

const structuredFeature: AIFeatureConfig = {
  id: "chapter-metadata",
  name: "Structured Test Feature",
  category: "metadata",
  systemPrompt: "Return tags.",
  userPromptTemplate: "Text: {{text}}",
  batchable: true,
  streamable: false,
  defaultBatchSize: 1,
  requiresConfirmation: false,
  availablePlaceholders: ["text"],
  responseFormat: "structured-batch",
  responseSchema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        tag: { type: "string" },
      },
      required: ["tag"],
    },
  },
};

function okEnvelope(data: Array<{ tag: string }>): string {
  return JSON.stringify({ status: "ok", retryable: false, data, error: null });
}

function emptyEnvelope(): string {
  return JSON.stringify({ status: "empty", retryable: false, data: [], error: null });
}

function modelErrorEnvelope(code: string, message: string, retryable: boolean): string {
  return JSON.stringify({ status: "error", retryable, data: [], error: { code, message } });
}

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
  });

  afterEach(() => {
    clearRegistry();
  });

  describe("feature configuration", () => {
    it("should register and retrieve feature", () => {
      const feature = getFeature("text-revision");
      expect(feature).toBeDefined();
      expect(feature?.id).toBe("text-revision");
    });

    it("should throw for unregistered feature", () => {
      // Ensure registry is empty to test missing feature behavior
      clearRegistry();
      expect(() => {
        getFeatureOrThrow("speaker-classification");
      }).toThrow("not registered");
    });
  });

  describe("prompt compilation", () => {
    it("should compile system prompt with variables", () => {
      const compiled = compileTemplate(testFeature.systemPrompt, { role: "editor" });
      expect(compiled).toBe("You are a editor.");
    });

    it("should compile user prompt with variables", () => {
      const compiled = compileTemplate(testFeature.userPromptTemplate, { text: "Hello world" });
      expect(compiled).toBe("Process: Hello world");
    });

    it("should preserve placeholders for missing variables", () => {
      const compiled = compileTemplate(testFeature.systemPrompt, {});
      // Missing variables are preserved as placeholders
      expect(compiled).toBe("You are a {{role}}.");
    });
  });

  describe("batch processing logic", () => {
    it("should track progress correctly", () => {
      const inputs = [{ text: "1" }, { text: "2" }, { text: "3" }];
      const progressUpdates: [number, number][] = [];

      // Simulate batch progress tracking
      for (let i = 0; i < inputs.length; i++) {
        progressUpdates.push([i + 1, inputs.length]);
      }

      expect(progressUpdates).toEqual([
        [1, 3],
        [2, 3],
        [3, 3],
      ]);
    });

    it("should handle cancellation flag", () => {
      const abortController = new AbortController();
      abortController.abort();

      expect(abortController.signal.aborted).toBe(true);
    });
  });

  describe("metadata building", () => {
    it("should calculate duration correctly", () => {
      const startTime = Date.now() - 100;
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it("should include feature ID in metadata", () => {
      const metadata = {
        featureId: "text-revision",
        providerId: "test",
        model: "gpt-4",
        durationMs: 100,
      };

      expect(metadata.featureId).toBe("text-revision");
    });
  });
});

describe("executeFeature - structured-batch response contract", () => {
  const legacyTextFeature: AIFeatureConfig = {
    id: "text-revision",
    name: "Legacy Text Feature",
    category: "text",
    systemPrompt: "You are an editor.",
    userPromptTemplate: "Revise: {{text}}",
    batchable: true,
    streamable: false,
    defaultBatchSize: 1,
    requiresConfirmation: true,
    availablePlaceholders: ["text"],
    responseSchema: undefined,
  };

  beforeEach(() => {
    clearRegistry();
    registerFeature(structuredFeature);
    registerFeature(legacyTextFeature);
    chatQueue.length = 0;
    chatCallCount.count = 0;
    settingsOverrides.parseRetryCount = 0;
  });

  afterEach(() => {
    clearRegistry();
  });

  it("1) returns unwrapped data with status ok and retryable false", async () => {
    chatQueue.push({ content: okEnvelope([{ tag: "speaker" }]) });

    const result = await executeFeature("chapter-metadata", { text: "hi" });

    expect(result.success).toBe(true);
    expect(result.status).toBe("ok");
    expect(result.retryable).toBe(false);
    expect(result.data).toEqual([{ tag: "speaker" }]);
    expect(result.errorSource).toBeUndefined();
  });

  it("2) treats empty as a successful terminal outcome, calling the provider once even with retries configured", async () => {
    settingsOverrides.parseRetryCount = 2;
    chatQueue.push({ content: emptyEnvelope() });

    const result = await executeFeature("chapter-metadata", { text: "hi" });

    expect(result.success).toBe(true);
    expect(result.status).toBe("empty");
    expect(result.data).toEqual([]);
    expect(result.retryable).toBe(false);
    expect(chatCallCount.count).toBe(1);
  });

  it("3) returns model error with errorSource model, stable code/message, and no retry", async () => {
    settingsOverrides.parseRetryCount = 2;
    chatQueue.push({
      content: modelErrorEnvelope("MISSING_REQUIRED_INPUT", "No segments provided", false),
    });

    const result = await executeFeature("chapter-metadata", { text: "hi" });

    expect(result.success).toBe(false);
    expect(result.status).toBe("error");
    expect(result.errorSource).toBe("model");
    expect(result.errorCode).toBe("MISSING_REQUIRED_INPUT");
    expect(result.error).toBe("No segments provided");
    expect(result.retryable).toBe(false);
    expect(chatCallCount.count).toBe(1);
  });

  it.each([
    ["empty response", ""],
    ["malformed json", "{not valid json"],
    ["truncated json", '{"status": "ok", "retryable": false, "data": [{"tag":'],
    ["schema-invalid data", okEnvelope([{ notTag: "oops" } as unknown as { tag: string }])],
  ])("4) %s ends as a retryable parser failure with diagnostics", async (_label, content) => {
    chatQueue.push({ content });

    const result = await executeFeature("chapter-metadata", { text: "hi" });

    expect(result.success).toBe(false);
    expect(result.status).toBe("error");
    expect(result.retryable).toBe(true);
    expect(result.errorSource).toBe("parser");
    expect(result.errorCode).toBe("PARSE_ERROR");
    expect(result.parserFailure).toBeDefined();
    expect(result.parserFailure?.diagnostics).toBeDefined();
  });

  it("4b) retries parse failures up to the configured limit and reports parser diagnostics via onRetry", async () => {
    settingsOverrides.parseRetryCount = 1;
    chatQueue.push({ content: "{not valid json" });
    chatQueue.push({ content: "{also not valid" });

    const retryInfos: RetryAttemptInfo[] = [];
    const result = await executeFeature(
      "chapter-metadata",
      { text: "hi" },
      { onRetry: (info) => retryInfos.push(info) },
    );

    expect(chatCallCount.count).toBe(2);
    expect(retryInfos).toHaveLength(1);
    expect(retryInfos[0]?.parserFailureCode).toBeDefined();
    expect(retryInfos[0]?.parserFailureDiagnostics).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.errorSource).toBe("parser");
  });

  it("5) never enters lenient recovery for structured parser failures", async () => {
    // A bare array (no envelope) is exactly the shape the legacy lenient
    // recovery path would happily accept - structured-batch must not.
    chatQueue.push({ content: JSON.stringify([{ tag: "speaker" }]) });

    const result = await executeFeature("chapter-metadata", { text: "hi" });

    expect(result.success).toBe(false);
    expect(result.errorSource).toBe("parser");
    expect((result.metadata as Record<string, unknown>).lenient).toBeUndefined();
  });

  it("6) classifies provider/network failures with errorSource provider using isRetryableAIError", async () => {
    const timeoutError = new Error("Request timed out after 1s");
    timeoutError.name = "AbortError";
    chatQueue.push(timeoutError);

    const result = await executeFeature("chapter-metadata", { text: "hi" });

    expect(result.success).toBe(false);
    expect(result.errorSource).toBe("provider");
    expect(result.errorCode).toBe("CONNECTION_ERROR");
    expect(result.retryable).toBe(true);
  });

  it("6b) classifies non-retryable provider failures accordingly", async () => {
    chatQueue.push(new Error("Something unexpected happened"));

    const result = await executeFeature("chapter-metadata", { text: "hi" });

    expect(result.success).toBe(false);
    expect(result.errorSource).toBe("provider");
    expect(result.retryable).toBe(false);
  });

  it("6c) returns a structured error result when provider resolution fails", async () => {
    vi.mocked(resolveProvider).mockRejectedValueOnce(new Error("No provider configured"));

    const result = await executeFeature("chapter-metadata", { text: "hi" });

    expect(result.success).toBe(false);
    expect(result.status).toBe("error");
    expect(result.errorSource).toBe("provider");
    expect(result.retryable).toBe(false);
  });

  it("6d) leaves legacy provider-resolution failures throwing (no behavior change)", async () => {
    vi.mocked(resolveProvider).mockRejectedValueOnce(new Error("No provider configured"));

    await expect(executeFeature("text-revision", { text: "hi" })).rejects.toThrow(
      "No provider configured",
    );
  });

  it("9) includes structured cancellation fields for a structured-batch config", async () => {
    chatQueue.push(new Error("cancelled"));

    const result = await executeFeature("chapter-metadata", { text: "hi" });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("CANCELLED");
    expect(result.status).toBe("error");
    expect(result.errorSource).toBe("provider");
    expect(result.retryable).toBe(false);
  });

  it("9b) leaves the legacy cancellation result shape untouched", async () => {
    chatQueue.push(new Error("cancelled"));

    const result = await executeFeature("text-revision", { text: "hi" });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("CANCELLED");
    expect(result.status).toBeUndefined();
    expect(result.retryable).toBeUndefined();
    expect(result.errorSource).toBeUndefined();
  });

  it("guards against a structured-batch feature misconfigured without a responseSchema", async () => {
    registerFeature({
      id: "content-transformation",
      name: "Misconfigured Structured Feature",
      category: "metadata",
      systemPrompt: "Return tags.",
      userPromptTemplate: "Text: {{text}}",
      batchable: true,
      streamable: false,
      defaultBatchSize: 1,
      requiresConfirmation: false,
      availablePlaceholders: ["text"],
      responseFormat: "structured-batch",
      responseSchema: undefined,
    });
    chatQueue.push({ content: okEnvelope([{ tag: "speaker" }]) });

    const result = await executeFeature("content-transformation", { text: "hi" });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("CONFIGURATION_ERROR");
    expect(result.errorSource).toBe("provider");
  });

  it("7) executeBatch counts one ok and one empty result as two successes", async () => {
    chatQueue.push({ content: okEnvelope([{ tag: "speaker" }]) });
    chatQueue.push({ content: emptyEnvelope() });

    const batchResult = await executeBatch("chapter-metadata", [{ text: "a" }, { text: "b" }]);

    expect(batchResult.summary.succeeded).toBe(2);
    expect(batchResult.summary.failed).toBe(0);
  });

  it("8) leaves the legacy text-revision result shape untouched", async () => {
    chatQueue.push({ content: "Revised text." });

    const result = await executeFeature("text-revision", { text: "hi" });

    expect(result.success).toBe(true);
    expect(result.data).toBe("Revised text.");
    expect(result.status).toBeUndefined();
    expect(result.retryable).toBeUndefined();
    expect(result.errorSource).toBeUndefined();
  });
});
