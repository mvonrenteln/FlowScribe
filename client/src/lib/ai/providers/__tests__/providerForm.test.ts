import { describe, expect, it } from "vitest";
import {
  addManualProviderModel,
  applyProviderTypeChange,
  EMPTY_PROVIDER_FORM,
  removeProviderModel,
} from "@/lib/ai/providers/providerForm";

describe("provider form utilities", () => {
  it("applies provider type defaults without losing valid user input", () => {
    const customForm = {
      ...EMPTY_PROVIDER_FORM,
      type: "custom" as const,
      baseUrl: "https://custom.example.test/v1",
      apiKey: "secret",
    };

    expect(applyProviderTypeChange(customForm, "openai")).toMatchObject({
      type: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "secret",
    });
    expect(applyProviderTypeChange(customForm, "ollama")).toMatchObject({
      type: "ollama",
      baseUrl: "http://localhost:11434",
      apiKey: "",
    });
    expect(applyProviderTypeChange(customForm, "custom")).toMatchObject({
      type: "custom",
      baseUrl: "https://custom.example.test/v1",
      apiKey: "secret",
    });
  });

  it("adds a trimmed manual model and selects it only when no model is selected", () => {
    const emptySelection = { ...EMPTY_PROVIDER_FORM, availableModels: [] };
    expect(addManualProviderModel(emptySelection, " gpt-4o ")).toMatchObject({
      availableModels: ["gpt-4o"],
      model: "gpt-4o",
    });

    const existingSelection = {
      ...EMPTY_PROVIDER_FORM,
      availableModels: ["gpt-4o"],
      model: "gpt-4o",
    };
    expect(addManualProviderModel(existingSelection, "gpt-4.1")).toMatchObject({
      availableModels: ["gpt-4o", "gpt-4.1"],
      model: "gpt-4o",
    });
  });

  it("ignores blank and duplicate manual models", () => {
    const form = { ...EMPTY_PROVIDER_FORM, availableModels: ["gpt-4o"], model: "gpt-4o" };

    expect(addManualProviderModel(form, "   ")).toBe(form);
    expect(addManualProviderModel(form, "gpt-4o")).toBe(form);
  });

  it("keeps the selected model valid when removing models", () => {
    const form = {
      ...EMPTY_PROVIDER_FORM,
      availableModels: ["old", "next"],
      model: "old",
    };

    expect(removeProviderModel(form, "old")).toMatchObject({
      availableModels: ["next"],
      model: "next",
    });
    expect(
      removeProviderModel({ ...form, availableModels: ["old"], model: "old" }, "old"),
    ).toMatchObject({
      availableModels: [],
      model: "",
    });
    expect(removeProviderModel({ ...form, model: "next" }, "old")).toMatchObject({
      availableModels: ["next"],
      model: "next",
    });
  });
});
