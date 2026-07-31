/**
 * OpenAI Provider Helpers Tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../types";

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}));

vi.mock("openai", () => {
  class MockAPIError extends Error {}

  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: createMock,
        },
      };
      models = {
        list: vi.fn(),
      };
    },
    APIError: MockAPIError,
  };
});

const { isGpt5Model, normalizeOpenAITemperature, OpenAIProvider } = await import("../openai");

const SUCCESSFUL_COMPLETION = {
  choices: [{ message: { content: "ok" } }],
  usage: undefined,
};

describe("OpenAI provider helpers", () => {
  describe("isGpt5Model", () => {
    it("detects GPT-5 model variants", () => {
      expect(isGpt5Model("gpt-5")).toBe(true);
      expect(isGpt5Model("gpt-5-mini")).toBe(true);
      expect(isGpt5Model("gpt-5-codex")).toBe(true);
      expect(isGpt5Model("gpt-5.1")).toBe(true);
      expect(isGpt5Model("GPT-5-CODEX")).toBe(true);
    });

    it("returns false for non-GPT-5 models", () => {
      expect(isGpt5Model("gpt-4o")).toBe(false);
      expect(isGpt5Model("o1")).toBe(false);
      expect(isGpt5Model("llama3.2")).toBe(false);
    });
  });

  describe("normalizeOpenAITemperature", () => {
    it("forces temperature to 1 for GPT-5 models", () => {
      expect(normalizeOpenAITemperature("gpt-5-mini", 0.2)).toBe(1);
      expect(normalizeOpenAITemperature("gpt-5", 2)).toBe(1);
    });

    it("clamps temperature for non-GPT-5 models", () => {
      expect(normalizeOpenAITemperature("gpt-4o", -1)).toBe(0);
      expect(normalizeOpenAITemperature("gpt-4o", 3)).toBe(2);
      expect(normalizeOpenAITemperature("gpt-4o", 0.55)).toBe(0.55);
    });
  });
});

describe("OpenAIProvider prompt cache controls", () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue(SUCCESSFUL_COMPLETION);
  });

  function makeProvider(type: "openai" | "custom", model = "gpt-4o") {
    return new OpenAIProvider({
      id: "provider-1",
      type,
      name: "Test Provider",
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test-key",
      model,
    });
  }

  async function captureBody(
    provider: OpenAIProvider,
    messages: ChatMessage[],
  ): Promise<Record<string, unknown>> {
    await provider.chat(messages);
    const call = createMock.mock.calls.at(-1);
    if (!call) {
      throw new Error("chat.completions.create was not called");
    }
    return call[0] as Record<string, unknown>;
  }

  it("1. sends model, mapped messages, max_tokens, temperature plus cache fields for a built-in OpenAI provider", async () => {
    const provider = makeProvider("openai");
    const messages: ChatMessage[] = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello" },
    ];

    const body = await captureBody(provider, messages);

    expect(body.model).toBe("gpt-4o");
    expect(body.messages).toEqual(messages);
    expect(body.max_tokens).toBe(2048);
    expect(body.temperature).toBe(0.7);
    expect(body.prompt_cache_retention).toBe("in-memory");
    expect(body.prompt_cache_key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("2. attaches both cache fields even for a direct user-only call with no system message", async () => {
    const provider = makeProvider("openai");
    const body = await captureBody(provider, [{ role: "user", content: "Hello" }]);

    expect(body.prompt_cache_retention).toBe("in-memory");
    expect(body.prompt_cache_key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("3. yields the same key for the same model/system with different user transcript content", async () => {
    const provider = makeProvider("openai");
    const system: ChatMessage = { role: "system", content: "Immutable system prompt" };

    const firstBody = await captureBody(provider, [
      system,
      { role: "user", content: "transcript A" },
    ]);
    const secondBody = await captureBody(provider, [
      system,
      { role: "user", content: "transcript B" },
    ]);

    expect(secondBody.prompt_cache_key).toBe(firstBody.prompt_cache_key);
  });

  it("4. yields the same key for the same model/system with different assistant or repair messages", async () => {
    const provider = makeProvider("openai");
    const system: ChatMessage = { role: "system", content: "Immutable system prompt" };
    const user: ChatMessage = { role: "user", content: "Immutable compiled batch input" };

    const firstBody = await captureBody(provider, [system, user]);
    const secondBody = await captureBody(provider, [
      system,
      user,
      { role: "assistant", content: "invalid response" },
      { role: "user", content: "return a complete replacement" },
    ]);

    expect(secondBody.prompt_cache_key).toBe(firstBody.prompt_cache_key);
  });

  it("5. yields a different key for a byte-different system prompt", async () => {
    const provider = makeProvider("openai");
    const user: ChatMessage = { role: "user", content: "Immutable compiled batch input" };

    const firstBody = await captureBody(provider, [
      { role: "system", content: "Immutable system prompt" },
      user,
    ]);
    const secondBody = await captureBody(provider, [
      { role: "system", content: "Immutable system prompt." },
      user,
    ]);

    expect(secondBody.prompt_cache_key).not.toBe(firstBody.prompt_cache_key);
  });

  it("6. yields a different key for a different model with the same system prompt", async () => {
    const providerA = makeProvider("openai", "gpt-4o");
    const providerB = makeProvider("openai", "gpt-4o-mini");
    const messages: ChatMessage[] = [
      { role: "system", content: "Immutable system prompt" },
      { role: "user", content: "Immutable compiled batch input" },
    ];

    const firstBody = await captureBody(providerA, messages);
    const secondBody = await captureBody(providerB, messages);

    expect(secondBody.prompt_cache_key).not.toBe(firstBody.prompt_cache_key);
  });

  it("7. yields a distinct key for a distinct custom system prompt", async () => {
    const provider = makeProvider("openai");
    const user: ChatMessage = { role: "user", content: "Immutable compiled batch input" };

    const firstBody = await captureBody(provider, [
      { role: "system", content: "Custom system prompt one" },
      user,
    ]);
    const secondBody = await captureBody(provider, [
      { role: "system", content: "Custom system prompt two" },
      user,
    ]);

    expect(secondBody.prompt_cache_key).not.toBe(firstBody.prompt_cache_key);
  });

  it("8. produces a 64-character key with none of the sensitive raw values embedded", async () => {
    const model = "gpt-4o";
    const systemPrompt = "Immutable system prompt";
    const transcriptSentinel = "TRANSCRIPT_SENTINEL_VALUE";
    const repairResponse = "REPAIR_RESPONSE_SENTINEL";
    const apiKey = "sk-super-secret-api-key";
    const baseUrl = "https://api.example.com/v1";
    const providerId = "provider-sensitive-id";

    const provider = new OpenAIProvider({
      id: providerId,
      type: "openai",
      name: "Test Provider",
      baseUrl,
      apiKey,
      model,
    });

    const body = await captureBody(provider, [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcriptSentinel },
      { role: "assistant", content: repairResponse },
    ]);

    const key = body.prompt_cache_key as string;
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain(model);
    expect(key).not.toContain(systemPrompt);
    expect(key).not.toContain(transcriptSentinel);
    expect(key).not.toContain(repairResponse);
    expect(key).not.toContain(apiKey);
    expect(key).not.toContain(baseUrl);
    expect(key).not.toContain(providerId);
  });

  it("9. keeps the immutable prefix stable and reuses the cache key across corrective retries", async () => {
    const basePrefix = [
      { role: "system", content: "Immutable system prompt" },
      { role: "user", content: "Immutable compiled batch input" },
    ] satisfies ChatMessage[];

    const correctiveRetry = [
      ...basePrefix,
      { role: "assistant", content: "invalid response" },
      { role: "user", content: "return a complete replacement" },
    ] satisfies ChatMessage[];

    const provider = makeProvider("openai");
    const firstBody = await captureBody(provider, basePrefix);
    const secondBody = await captureBody(provider, correctiveRetry);

    expect(firstBody.messages).toEqual(basePrefix);
    expect((secondBody.messages as ChatMessage[]).slice(0, 2)).toEqual(basePrefix);
    expect(basePrefix).toEqual([
      { role: "system", content: "Immutable system prompt" },
      { role: "user", content: "Immutable compiled batch input" },
    ]);
    expect(secondBody.prompt_cache_key).toBe(firstBody.prompt_cache_key);
  });

  it("10. sends the pre-change body for a custom provider with neither cache field", async () => {
    const provider = makeProvider("custom");
    const messages: ChatMessage[] = [
      { role: "system", content: "Immutable system prompt" },
      { role: "user", content: "Immutable compiled batch input" },
    ];

    const body = await captureBody(provider, messages);

    expect(body).toEqual({
      model: "gpt-4o",
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    });
    expect(body).not.toHaveProperty("prompt_cache_key");
    expect(body).not.toHaveProperty("prompt_cache_retention");
  });
});
