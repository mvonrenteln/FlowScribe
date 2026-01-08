import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PersistedSettings } from "@/lib/settings/settingsStorage";
import { AIConfigurationSection } from "../AIConfigurationSection";

describe("AIConfigurationSection", () => {
  const settings: PersistedSettings = {
    version: 1,
    aiProviders: [
      {
        id: "provider-1",
        type: "ollama",
        name: "Provider One",
        baseUrl: "http://localhost:11434",
        model: "llama3",
        availableModels: ["llama3", "llama3.1"],
        isDefault: true,
      },
    ],
    defaultAIProviderId: "provider-1",
    aiBatchSize: 10,
  };

  it("renders provider, model, prompt, and batch size inputs", () => {
    render(
      <AIConfigurationSection
        id="test"
        settings={settings}
        selectedProviderId="provider-1"
        selectedModel=""
        isProcessing={false}
        promptLabel="Prompt Template"
        promptValue="prompt-1"
        promptOptions={[{ id: "prompt-1", name: "Default Prompt", isDefault: true }]}
        batchSize="10"
        onProviderChange={vi.fn()}
        onModelChange={vi.fn()}
        onPromptChange={vi.fn()}
        onBatchSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Provider")).toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("Prompt Template")).toBeInTheDocument();
    expect(screen.getByLabelText(/batch size/i)).toBeInTheDocument();
  });

  it("calls onBatchSizeChange for valid values", () => {
    const handleBatchSizeChange = vi.fn();

    render(
      <AIConfigurationSection
        id="test"
        settings={settings}
        selectedProviderId="provider-1"
        selectedModel=""
        isProcessing={false}
        promptLabel="Template"
        promptValue="prompt-1"
        promptOptions={[{ id: "prompt-1", name: "Default Prompt" }]}
        batchSize="10"
        onProviderChange={vi.fn()}
        onModelChange={vi.fn()}
        onPromptChange={vi.fn()}
        onBatchSizeChange={handleBatchSizeChange}
      />,
    );

    const input = screen.getByLabelText(/batch size/i);
    fireEvent.change(input, { target: { value: "25" } });

    expect(handleBatchSizeChange).toHaveBeenCalledWith("25");
  });
});
