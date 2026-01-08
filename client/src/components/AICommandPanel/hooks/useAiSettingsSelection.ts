import { useCallback, useEffect, useMemo, useState } from "react";
import {
  initializeSettings,
  type PersistedSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/lib/settings/settingsStorage";
import { resolveModelId, resolveProviderId } from "../utils/aiSettingsSelection";

interface UseAiSettingsSelectionOptions {
  initialProviderId?: string;
  initialModel?: string;
}

interface UseAiSettingsSelectionResult {
  settings: PersistedSettings | null;
  selectedProviderId: string;
  selectedModel: string;
  selectProvider: (providerId: string) => void;
  setSelectedModel: (modelId: string) => void;
}

export function useAiSettingsSelection({
  initialProviderId = "",
  initialModel = "",
}: UseAiSettingsSelectionOptions = {}): UseAiSettingsSelectionResult {
  const [settings, setSettings] = useState<PersistedSettings | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState(initialProviderId);
  const [selectedModel, setSelectedModel] = useState(initialModel);

  const refreshSettings = useCallback(() => {
    const loadedSettings = initializeSettings();
    setSettings(loadedSettings);

    const resolvedProviderId = resolveProviderId(loadedSettings, selectedProviderId);
    if (resolvedProviderId !== selectedProviderId) {
      setSelectedProviderId(resolvedProviderId);
    }
  }, [selectedProviderId]);

  useEffect(() => {
    refreshSettings();

    window.addEventListener(SETTINGS_UPDATED_EVENT, refreshSettings);
    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, refreshSettings);
    };
  }, [refreshSettings]);

  const selectedProvider = useMemo(
    () => settings?.aiProviders.find((provider) => provider.id === selectedProviderId),
    [settings, selectedProviderId],
  );

  const resolvedModel = useMemo(
    () => resolveModelId(selectedProvider, selectedModel),
    [selectedProvider, selectedModel],
  );

  useEffect(() => {
    if (!selectedProvider) return;
    if (resolvedModel !== selectedModel) {
      setSelectedModel(resolvedModel);
    }
  }, [resolvedModel, selectedModel, selectedProvider]);

  const selectProvider = useCallback((providerId: string) => {
    setSelectedProviderId(providerId);
    setSelectedModel("");
  }, []);

  return {
    settings,
    selectedProviderId,
    selectedModel,
    selectProvider,
    setSelectedModel,
  };
}
