/**
 * AI Core Module - Public Exports
 *
 * @module ai/core
 */

// Types
export type {
  AIFeatureType,
  AIFeatureCategory,
  AIFeatureConfig,
  AIFeatureOptions,
  AIFeatureResult,
  AIFeatureState,
  AIBatchResult,
  BatchCallbacks,
  ResponseSchema,
  PropertySchema,
  CompiledMessages,
  FeatureRegistryEntry,
} from "./types";

// Feature Registry
export {
  registerFeature,
  getFeature,
  getFeatureOrThrow,
  hasFeature,
  getAllFeatures,
  getFeaturesByCategory,
  unregisterFeature,
  clearRegistry,
  getRegistrySize,
  registerDefaultFeatures,
} from "./featureRegistry";

// AI Feature Service
export {
  executeFeature,
  executeBatch,
  classifySpeakers,
  reviseText,
} from "./aiFeatureService";

