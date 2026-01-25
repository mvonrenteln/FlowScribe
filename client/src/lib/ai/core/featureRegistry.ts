/**
 * Feature Registry
 *
 * Central registry for AI feature configurations.
 * Features register their configuration here and can be
 * looked up by ID when executing.
 *
 * @module ai/core/featureRegistry
 */

import { chapterDetectionConfig } from "../features/chapterDetection/config";
import { textRevisionConfig } from "../features/revision/config";
import { segmentMergeConfig } from "../features/segmentMerge/config";
// Import feature configs synchronously to ensure they're available immediately
import { speakerClassificationConfig } from "../features/speaker/config";
import type { AIFeatureConfig, AIFeatureType, FeatureRegistryEntry } from "./types";

// ==================== Registry State ====================

const registry = new Map<AIFeatureType, FeatureRegistryEntry>();

// ==================== Registry Operations ====================

/**
 * Register an AI feature configuration.
 *
 * @param config - Feature configuration to register
 * @throws Error if feature is already registered
 *
 * @example
 * ```ts
 * registerFeature({
 *   id: "text-revision",
 *   name: "Text Revision",
 *   category: "text",
 *   // ... other config
 * });
 * ```
 */
export function registerFeature(config: AIFeatureConfig): void {
  if (registry.has(config.id)) {
    throw new Error(`Feature "${config.id}" is already registered`);
  }

  registry.set(config.id, {
    config,
    registeredAt: new Date(),
  });
}

/**
 * Get a registered feature configuration.
 *
 * @param id - Feature ID to look up
 * @returns Feature configuration or undefined if not found
 */
export function getFeature(id: AIFeatureType): AIFeatureConfig | undefined {
  return registry.get(id)?.config;
}

/**
 * Get a registered feature configuration, throwing if not found.
 *
 * @param id - Feature ID to look up
 * @returns Feature configuration
 * @throws Error if feature is not registered
 */
export function getFeatureOrThrow(id: AIFeatureType): AIFeatureConfig {
  const config = getFeature(id);
  if (!config) {
    throw new Error(`Feature "${id}" is not registered`);
  }
  return config;
}

/**
 * Check if a feature is registered.
 *
 * @param id - Feature ID to check
 * @returns True if feature is registered
 */
export function hasFeature(id: AIFeatureType): boolean {
  return registry.has(id);
}

/**
 * Get all registered features.
 *
 * @returns Array of all registered feature configurations
 */
export function getAllFeatures(): AIFeatureConfig[] {
  return Array.from(registry.values()).map((entry) => entry.config);
}

/**
 * Get features by category.
 *
 * @param category - Category to filter by
 * @returns Array of matching feature configurations
 */
export function getFeaturesByCategory(category: AIFeatureConfig["category"]): AIFeatureConfig[] {
  return getAllFeatures().filter((f) => f.category === category);
}

/**
 * Unregister a feature (mainly for testing).
 *
 * @param id - Feature ID to unregister
 * @returns True if feature was removed, false if not found
 */
export function unregisterFeature(id: AIFeatureType): boolean {
  return registry.delete(id);
}

/**
 * Clear all registered features (mainly for testing).
 */
export function clearRegistry(): void {
  registry.clear();
}

/**
 * Get the number of registered features.
 */
export function getRegistrySize(): number {
  return registry.size;
}

// ==================== Default Features Registration ====================

/**
 * Register default built-in features.
 * Called automatically when module is imported.
 */
export function registerDefaultFeatures(): void {
  // Register speaker classification
  if (!hasFeature("speaker-classification")) {
    registerFeature(speakerClassificationConfig);
  }

  // Register text revision
  if (!hasFeature("text-revision")) {
    registerFeature(textRevisionConfig);
  }

  // Register segment merge
  if (!hasFeature("segment-merge")) {
    registerFeature(segmentMergeConfig);
  }

  // Register chapter detection
  if (!hasFeature("chapter-detection")) {
    registerFeature(chapterDetectionConfig);
  }
}

// Auto-register on module load
registerDefaultFeatures();
