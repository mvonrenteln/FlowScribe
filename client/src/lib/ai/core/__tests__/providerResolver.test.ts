import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIProviderConfig, AIProviderService } from "@/lib/ai/providers/types";

const mockSettings = vi.hoisted(() => ({
  aiProviders: [] as AIProviderConfig[],
  defaultAIProviderId: undefined as string | undefined,
}));

const mockCreateProvider = vi.hoisted(() => vi.fn());

vi.mock("@/lib/settings/settingsStorage", () => ({
  initializeSettings: () => Promise.resolve(mockSettings),
}));

vi.mock("@/lib/ai/providers/factory", () => ({
  createProvider: mockCreateProvider,
}));

const makeProvider = (id: string, isDefault = false): AIProviderConfig => ({
  id,
  type: "openai",
  name: id,
  baseUrl: "https://api.example.test",
  apiKey: "key",
  model: `${id}-model`,
  isDefault,
});

describe("resolveProvider", () => {
  beforeEach(() => {
    mockSettings.aiProviders = [];
    mockSettings.defaultAIProviderId = undefined;
    mockCreateProvider.mockReset();
    mockCreateProvider.mockImplementation(
      (config: AIProviderConfig): AIProviderService => ({
        config,
        chat: vi.fn(),
        listModels: vi.fn(),
        testConnection: vi.fn(),
      }),
    );
  });

  it("uses an explicit provider without reading configured providers", async () => {
    const { resolveProvider } = await import("@/lib/ai/core/providerResolver");
    const provider = makeProvider("explicit");

    const resolved = await resolveProvider({ provider });

    expect(resolved.config).toEqual(provider);
    expect(resolved.source).toBe("explicit");
    expect(mockCreateProvider).toHaveBeenCalledWith(provider);
  });

  it("prefers option provider id, then configured default, then first provider", async () => {
    const { resolveProvider } = await import("@/lib/ai/core/providerResolver");
    const first = makeProvider("first");
    const selected = makeProvider("selected");
    const defaultProvider = makeProvider("default");
    mockSettings.aiProviders = [first, selected, defaultProvider];
    mockSettings.defaultAIProviderId = "default";

    await expect(resolveProvider({ providerId: "selected" })).resolves.toMatchObject({
      config: selected,
      source: "option-id",
    });
    await expect(resolveProvider()).resolves.toMatchObject({
      config: defaultProvider,
      source: "default",
    });

    mockSettings.defaultAIProviderId = "missing";
    mockSettings.aiProviders = [first, makeProvider("flagged", true)];
    await expect(resolveProvider()).resolves.toMatchObject({ source: "default" });

    mockSettings.aiProviders = [first, selected];
    await expect(resolveProvider()).resolves.toMatchObject({ config: first, source: "first" });
  });

  it("overrides the resolved model without mutating the stored provider", async () => {
    const { resolveProvider } = await import("@/lib/ai/core/providerResolver");
    const provider = makeProvider("default");
    mockSettings.aiProviders = [provider];

    const resolved = await resolveProvider({ model: "override-model" });

    expect(resolved.config.model).toBe("override-model");
    expect(provider.model).toBe("default-model");
  });

  it("fails clearly when no provider is configured", async () => {
    const { resolveProvider } = await import("@/lib/ai/core/providerResolver");

    await expect(resolveProvider()).rejects.toThrow("No AI provider configured");
  });
});
