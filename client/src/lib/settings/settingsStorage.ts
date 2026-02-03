/**
 * Settings Storage
 *
 * Dedicated storage layer for application settings.
 * Handles persistence and validation of settings.
 */

import type { AIProviderConfig } from "@/lib/ai/providers/types";

const SETTINGS_STORAGE_KEY = "flowscribe:settings";
const SETTINGS_VERSION = 1;
export const SETTINGS_UPDATED_EVENT = "flowscribe:settings-updated";

// ==================== Persisted Settings Types ====================

export interface PersistedSettings {
  version: typeof SETTINGS_VERSION;

  // AI Providers
  aiProviders: AIProviderConfig[];
  defaultAIProviderId?: string;

  /** Number of retries when AI response cannot be parsed (default: 3) */
  parseRetryCount?: number;
}

// ==================== Default Settings ====================

export const DEFAULT_SETTINGS: PersistedSettings = {
  version: SETTINGS_VERSION,
  aiProviders: [
    {
      id: "default-ollama",
      type: "ollama",
      name: "Local Ollama",
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
      isDefault: true,
    },
  ],
  defaultAIProviderId: "default-ollama",
  parseRetryCount: 3,
};

// ==================== Storage Functions ====================

/**
 * Check if localStorage is available.
 */
export function canUseSettingsStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
}

/**
 * Read settings from localStorage.
 * Returns null if not found or invalid.
 */
export function readSettings(): PersistedSettings | null {
  if (!canUseSettingsStorage()) return null;

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    // Version check
    if (parsed.version !== SETTINGS_VERSION) {
      console.info("[Settings] Version mismatch, using defaults", {
        stored: parsed.version,
        expected: SETTINGS_VERSION,
      });
      return null;
    }

    return parsed as PersistedSettings;
  } catch (error) {
    console.warn("[Settings] Failed to parse stored settings", error);
    return null;
  }
}

/**
 * Write settings to localStorage.
 */
export function writeSettings(settings: PersistedSettings): boolean {
  if (!canUseSettingsStorage()) return false;

  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: settings }));
    }
    return true;
  } catch (error) {
    console.error("[Settings] Failed to write settings", error);
    return false;
  }
}

/**
 * Clear all stored settings.
 */
export function clearSettings(): boolean {
  if (!canUseSettingsStorage()) return false;

  try {
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: null }));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize settings.
 * Returns existing settings or defaults.
 */
export function initializeSettings(): PersistedSettings {
  // Try to read existing settings
  const existing = readSettings();
  if (existing) {
    return existing;
  }

  // Use defaults
  const defaults = { ...DEFAULT_SETTINGS };
  writeSettings(defaults);
  return defaults;
}

// ==================== Provider Helpers ====================

/**
 * Get the default provider from settings.
 */
export function getDefaultProvider(settings: PersistedSettings): AIProviderConfig | null {
  if (settings.defaultAIProviderId) {
    const provider = settings.aiProviders.find((p) => p.id === settings.defaultAIProviderId);
    if (provider) return provider;
  }

  // Fallback to first provider marked as default
  const defaultProvider = settings.aiProviders.find((p) => p.isDefault);
  if (defaultProvider) return defaultProvider;

  // Fallback to first provider
  return settings.aiProviders[0] ?? null;
}

/**
 * Update a provider in settings.
 */
export function updateProviderInSettings(
  settings: PersistedSettings,
  id: string,
  updates: Partial<AIProviderConfig>,
): PersistedSettings {
  return {
    ...settings,
    aiProviders: settings.aiProviders.map((p) => (p.id === id ? { ...p, ...updates } : p)),
  };
}

/**
 * Add a provider to settings.
 */
export function addProviderToSettings(
  settings: PersistedSettings,
  provider: AIProviderConfig,
): PersistedSettings {
  // If this is the first provider or marked as default, update other providers
  const providers = provider.isDefault
    ? settings.aiProviders.map((p) => ({ ...p, isDefault: false }))
    : settings.aiProviders;

  return {
    ...settings,
    aiProviders: [...providers, provider],
    defaultAIProviderId: provider.isDefault ? provider.id : settings.defaultAIProviderId,
  };
}

/**
 * Remove a provider from settings.
 */
export function removeProviderFromSettings(
  settings: PersistedSettings,
  id: string,
): PersistedSettings {
  const filtered = settings.aiProviders.filter((p) => p.id !== id);

  // If we removed the default, set a new default
  let defaultId = settings.defaultAIProviderId;
  if (defaultId === id) {
    defaultId = filtered[0]?.id;
  }

  return {
    ...settings,
    aiProviders: filtered,
    defaultAIProviderId: defaultId,
  };
}

/**
 * Update the default provider in settings and persist.
 */
export function updateSettingsDefaultProvider(providerId: string): PersistedSettings {
  const settings = initializeSettings();
  const updated: PersistedSettings = {
    ...settings,
    defaultAIProviderId: providerId,
    aiProviders: settings.aiProviders.map((p) => ({
      ...p,
      isDefault: p.id === providerId,
    })),
  };
  writeSettings(updated);
  return updated;
}

/**
 * Update a provider's model and persist.
 */
export function updateProviderModel(providerId: string, model: string): PersistedSettings {
  const settings = initializeSettings();
  const updated: PersistedSettings = {
    ...settings,
    aiProviders: settings.aiProviders.map((p) => (p.id === providerId ? { ...p, model } : p)),
  };
  writeSettings(updated);
  return updated;
}
