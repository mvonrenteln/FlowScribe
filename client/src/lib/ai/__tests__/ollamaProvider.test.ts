/**
 * Ollama Provider Tests
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { OllamaProvider } from "../providers/ollama";
import type { ChatMessage } from "../providers/types";
import { AIProviderConnectionError } from "../providers/types";

const baseConfig = {
  id: "test-ollama",
  type: "ollama" as const,
  name: "Test Ollama",
  baseUrl: "http://localhost:11434",
  model: "llama3.2",
};

const messages: ChatMessage[] = [
  { role: "system", content: "You are helpful." },
  { role: "user", content: "Hello" },
];

const createResponse = (params: {
  ok: boolean;
  status?: number;
  json?: Record<string, unknown>;
  text?: string;
}): Response =>
  ({
    ok: params.ok,
    status: params.status ?? 200,
    json: async () => params.json ?? {},
    text: async () => params.text ?? "",
  }) as Response;

describe("OllamaProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uses /api/chat and returns message content", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        ok: true,
        json: {
          message: { content: "Hi there!" },
          prompt_eval_count: 2,
          eval_count: 3,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OllamaProvider(baseConfig);
    const result = await provider.chat(messages, { temperature: 0.2, maxTokens: 128 });

    expect(result.content).toBe("Hi there!");
    expect(result.usage?.totalTokens).toBe(5);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages).toEqual(messages);
    expect(body.options.num_predict).toBe(128);
    expect(body.options.temperature).toBe(0.2);
  });

  it("falls back to /api/generate when /api/chat is unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createResponse({ ok: false, status: 404, text: "Not Found" }))
      .mockResolvedValueOnce(
        createResponse({
          ok: true,
          json: {
            response: "Legacy response",
            prompt_eval_count: 1,
            eval_count: 1,
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OllamaProvider(baseConfig);
    const result = await provider.chat(messages);

    expect(result.content).toBe("Legacy response");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [firstUrl] = fetchMock.mock.calls[0];
    const [secondUrl, secondInit] = fetchMock.mock.calls[1];

    expect(firstUrl).toBe("http://localhost:11434/api/chat");
    expect(secondUrl).toBe("http://localhost:11434/api/generate");

    const secondBody = JSON.parse((secondInit as RequestInit).body as string);
    expect(secondBody.prompt).toBe("Hello");
    expect(secondBody.system).toBe("You are helpful.");
  });

  it("wraps network errors as connection errors", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OllamaProvider(baseConfig);

    await expect(provider.chat(messages)).rejects.toBeInstanceOf(AIProviderConnectionError);
  });
});
