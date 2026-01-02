/**
 * Provider Resolver
 *
 * Resolves which AI provider to use based on configuration and settings.
 * This centralizes provider resolution logic that was previously
 * duplicated across aiSpeakerService and aiRevisionService.
 *
 * @module ai/core/providerResolver
 */

import { initializeSettings } from "@/lib/settings/settingsStorage";
import { createProvider } from "../providers/factory";
import type { AIProviderConfig, AIProviderService } from "../providers/types";

// ==================== Types ====================

/**
 * Options for resolving a provider.
 */
export interface ProviderResolveOptions {
  /** Specific provider ID to use */
  providerId?: string;

  /** Specific model to use (overrides provider default) */
  model?: string;

  /** Pre-configured provider (skips resolution) */
  provider?: AIProviderConfig;
}

/**
 * Result of provider resolution.
 */
export interface ResolvedProvider {
  /** The resolved provider configuration */
  config: AIProviderConfig;

  /** The provider service instance */
  service: AIProviderService;

  /** How the provider was resolved */
  source: "explicit" | "option-id" | "default" | "first";
}

// ==================== Main Function ====================

/**
 * Resolve which AI provider to use.
 *
 * Resolution priority:
 * 1. Explicit provider config in options
 * 2. Provider ID specified in options
 * 3. Default provider from settings
 * 4. First available provider
 *
 * @param options - Resolution options
 * @returns Resolved provider config and service
 * @throws Error if no provider is available
 *
 * @example
 * ```ts
 * // Use default provider
 * const { service } = await resolveProvider();
 *
 * // Use specific provider
 * const { service } = await resolveProvider({ providerId: "my-ollama" });
 *
 * // Override model
 * const { service } = await resolveProvider({ model: "gpt-4o" });
 * ```
 */
export async function resolveProvider(
  options: ProviderResolveOptions = {},
): Promise<ResolvedProvider> {
  let config: AIProviderConfig | null = null;
  let source: ResolvedProvider["source"] = "first";

  // 1. Use explicit provider if provided
  if (options.provider) {
    config = options.provider;
    source = "explicit";
  }

  // 2. Otherwise, resolve from settings
  if (!config) {
    const settings = await initializeSettings();
    const providers = settings.aiProviders ?? [];

    if (providers.length === 0) {
      throw new Error("No AI provider configured. Please add a provider in Settings.");
    }

    // 2a. Try specific provider ID
    if (options.providerId) {
      config = providers.find((p) => p.id === options.providerId) ?? null;
      if (config) {
        source = "option-id";
      }
    }

    // 2b. Try default provider
    if (!config && settings.defaultAIProviderId) {
      config = providers.find((p) => p.id === settings.defaultAIProviderId) ?? null;
      if (config) {
        source = "default";
      }
    }

    // 2c. Try any provider marked as default
    if (!config) {
      config = providers.find((p) => p.isDefault) ?? null;
      if (config) {
        source = "default";
      }
    }

    // 2d. Fall back to first provider
    if (!config) {
      config = providers[0];
      source = "first";
    }
  }

  if (!config) {
    throw new Error("No AI provider configured. Please add a provider in Settings.");
  }

  // Apply model override if specified
  if (options.model) {
    config = { ...config, model: options.model };
  }

  // Create provider service
  const service = createProvider(config);

  return {
    config,
    service,
    source,
  };
}

/**
 * Synchronous version for backward compatibility.
 * Uses synchronous settings access.
 *
 * @deprecated Use `resolveProvider` instead.
 */
export function resolveProviderSync(options: ProviderResolveOptions = {}): ResolvedProvider {
  let config: AIProviderConfig | null = null;
  let source: ResolvedProvider["source"] = "first";

  // 1. Use explicit provider if provided
  if (options.provider) {
    config = options.provider;
    source = "explicit";
  }

  // 2. Otherwise, resolve from settings
  if (!config) {
    // Import synchronously for backward compatibility
    const { initializeSettings: initSettingsSync } = require("@/lib/settings/settingsStorage");
    const settings = initSettingsSync();
    const providers = settings.aiProviders ?? [];

    if (providers.length === 0) {
      throw new Error("No AI provider configured. Please add a provider in Settings.");
    }

    // Resolution logic same as async version
    if (options.providerId) {
      config = providers.find((p: AIProviderConfig) => p.id === options.providerId) ?? null;
      if (config) source = "option-id";
    }

    if (!config && settings.defaultAIProviderId) {
      config =
        providers.find((p: AIProviderConfig) => p.id === settings.defaultAIProviderId) ?? null;
      if (config) source = "default";
    }

    if (!config) {
      config = providers.find((p: AIProviderConfig) => p.isDefault) ?? null;
      if (config) source = "default";
    }

    if (!config) {
      config = providers[0];
      source = "first";
    }
  }

  if (!config) {
    throw new Error("No AI provider configured. Please add a provider in Settings.");
  }

  // Apply model override
  if (options.model) {
    config = { ...config, model: options.model };
  }

  const service = createProvider(config);

  return { config, service, source };
}
