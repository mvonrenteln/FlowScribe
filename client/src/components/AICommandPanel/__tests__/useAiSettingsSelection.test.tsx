import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AIProviderConfig } from "@/lib/ai/providers/types";
import type { PersistedSettings } from "@/lib/settings/settingsStorage";
import { initializeSettings, SETTINGS_UPDATED_EVENT } from "@/lib/settings/settingsStorage";
import { useAiSettingsSelection } from "../hooks/useAiSettingsSelection";

vi.mock("@/lib/settings/settingsStorage", () => ({
  initializeSettings: vi.fn(),
  SETTINGS_UPDATED_EVENT: "flowscribe:settings-updated",
}));

const providerA = {
  id: "provider-a",
  type: "ollama",
  name: "Provider A",
  baseUrl: "http://localhost:11434",
  model: "model-a",
  availableModels: ["model-a"],
} satisfies AIProviderConfig;

const providerB = {
  id: "provider-b",
  type: "ollama",
  name: "Provider B",
  baseUrl: "http://localhost:11434",
  model: "model-b",
  availableModels: ["model-b"],
} satisfies AIProviderConfig;

const baseSettings: PersistedSettings = {
  version: 1,
  aiProviders: [providerA, providerB],
  defaultAIProviderId: "provider-a",
  aiBatchSize: 10,
};

describe("useAiSettingsSelection", () => {
  it("hydrates provider/model from settings defaults", async () => {
    vi.mocked(initializeSettings).mockReturnValue(baseSettings);

    const { result } = renderHook(() =>
      useAiSettingsSelection({ initialProviderId: "missing", initialModel: "" }),
    );

    await waitFor(() => {
      expect(result.current.settings).toBe(baseSettings);
      expect(result.current.selectedProviderId).toBe("provider-a");
      expect(result.current.selectedModel).toBe("model-a");
    });
  });

  it("refreshes selection when settings update event fires", async () => {
    vi.mocked(initializeSettings).mockReturnValue(baseSettings);

    const { result } = renderHook(() =>
      useAiSettingsSelection({ initialProviderId: "provider-a", initialModel: "model-a" }),
    );

    await waitFor(() => {
      expect(result.current.selectedProviderId).toBe("provider-a");
    });

    const updatedSettings: PersistedSettings = {
      ...baseSettings,
      aiProviders: [providerB],
      defaultAIProviderId: "provider-b",
    };

    vi.mocked(initializeSettings).mockReturnValue(updatedSettings);

    act(() => {
      window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
    });

    await waitFor(() => {
      expect(result.current.selectedProviderId).toBe("provider-b");
    });
  });

  it("resets model when selecting a new provider", async () => {
    vi.mocked(initializeSettings).mockReturnValue(baseSettings);

    const { result } = renderHook(() =>
      useAiSettingsSelection({ initialProviderId: "provider-a", initialModel: "model-a" }),
    );

    await waitFor(() => {
      expect(result.current.selectedModel).toBe("model-a");
    });

    act(() => {
      result.current.selectProvider("provider-b");
    });

    await waitFor(() => {
      expect(result.current.selectedProviderId).toBe("provider-b");
      expect(result.current.selectedModel).toBe("model-b");
    });
  });
});
