import { describe, expect, it } from "vitest";
import type { PersistedSettings } from "@/lib/settings/settingsStorage";
import { resolveModelId, resolveProviderId } from "../utils/aiSettingsSelection";

const providerA = {
  id: "provider-a",
  type: "ollama",
  name: "Provider A",
  baseUrl: "http://localhost:11434",
  model: "model-a",
  availableModels: ["model-a", "model-b"],
  isDefault: true,
};

const providerB = {
  id: "provider-b",
  type: "ollama",
  name: "Provider B",
  baseUrl: "http://localhost:11434",
  model: "model-b",
  availableModels: ["model-b"],
};

const baseSettings: PersistedSettings = {
  version: 1,
  aiProviders: [providerA, providerB],
  defaultAIProviderId: "provider-b",
  aiBatchSize: 10,
};

describe("resolveProviderId", () => {
  it("keeps the selected provider when it exists", () => {
    expect(resolveProviderId(baseSettings, "provider-a")).toBe("provider-a");
  });

  it("falls back to the default provider when selection is missing", () => {
    expect(resolveProviderId(baseSettings, "missing")).toBe("provider-b");
  });

  it("falls back to the first provider when no default is set", () => {
    const settings: PersistedSettings = {
      ...baseSettings,
      defaultAIProviderId: undefined,
    };

    expect(resolveProviderId(settings, "missing")).toBe("provider-a");
  });

  it("returns empty when no providers and no default are available", () => {
    const settings: PersistedSettings = {
      ...baseSettings,
      aiProviders: [],
      defaultAIProviderId: undefined,
    };

    expect(resolveProviderId(settings, "missing")).toBe("");
  });
});

describe("resolveModelId", () => {
  it("keeps a selected model when it is available", () => {
    expect(resolveModelId(providerA, "model-b")).toBe("model-b");
  });

  it("defaults to the provider model when selection is empty", () => {
    expect(resolveModelId(providerA, "")).toBe("model-a");
  });

  it("falls back to the provider model when selection is invalid", () => {
    expect(resolveModelId(providerA, "unknown")).toBe("model-a");
  });

  it("returns the provider model even when availableModels is empty", () => {
    const provider = { ...providerA, availableModels: [] };
    expect(resolveModelId(provider, "unknown")).toBe("model-a");
  });

  it("keeps the selection when no provider is available", () => {
    expect(resolveModelId(undefined, "custom-model")).toBe("custom-model");
  });
});
