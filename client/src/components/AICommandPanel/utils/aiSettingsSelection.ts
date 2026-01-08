import type { PersistedSettings } from "@/lib/settings/settingsStorage";

export type AIProvider = PersistedSettings["aiProviders"][number];

export function resolveProviderId(settings: PersistedSettings, selectedProviderId: string): string {
  const providerExists = settings.aiProviders.some(
    (provider) => provider.id === selectedProviderId,
  );
  if (providerExists) return selectedProviderId;

  if (settings.defaultAIProviderId) return settings.defaultAIProviderId;
  return settings.aiProviders[0]?.id ?? "";
}

export function resolveModelId(provider: AIProvider | undefined, selectedModel: string): string {
  if (!provider) return selectedModel;

  const availableModels = provider.availableModels ?? [];
  if (!selectedModel || !availableModels.includes(selectedModel)) {
    return provider.model || availableModels[0] || "";
  }

  return selectedModel;
}
