import type { AIProviderType } from "./types";

export interface ProviderFormData {
  type: AIProviderType;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  availableModels: string[];
  isDefault: boolean;
}

export const EMPTY_PROVIDER_FORM: ProviderFormData = {
  type: "ollama",
  name: "",
  baseUrl: "http://localhost:11434",
  apiKey: "",
  model: "",
  availableModels: [],
  isDefault: false,
};

/**
 * Apply provider type defaults while preserving user-entered fields that remain valid.
 */
export function applyProviderTypeChange(
  form: ProviderFormData,
  type: AIProviderType,
): ProviderFormData {
  const baseUrl =
    type === "ollama"
      ? "http://localhost:11434"
      : type === "openai"
        ? "https://api.openai.com/v1"
        : form.baseUrl;

  return {
    ...form,
    type,
    baseUrl,
    apiKey: type === "ollama" ? "" : form.apiKey,
  };
}

/**
 * Add a manually entered model name and select it if no model was selected yet.
 */
export function addManualProviderModel(
  form: ProviderFormData,
  modelInput: string,
): ProviderFormData {
  const trimmed = modelInput.trim();
  if (!trimmed || form.availableModels.includes(trimmed)) return form;

  return {
    ...form,
    availableModels: [...form.availableModels, trimmed],
    model: form.model || trimmed,
  };
}

/**
 * Remove a provider model and keep the selected model valid.
 */
export function removeProviderModel(
  form: ProviderFormData,
  modelToRemove: string,
): ProviderFormData {
  const availableModels = form.availableModels.filter((model) => model !== modelToRemove);
  return {
    ...form,
    availableModels,
    model: form.model === modelToRemove ? (availableModels[0] ?? "") : form.model,
  };
}
