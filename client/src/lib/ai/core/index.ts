/**
 * AI Core Module - Public Exports
 *
 * @module ai/core
 */

// AI Feature Service
export {
  classifySpeakers,
  executeBatch,
  executeFeature,
  reviseText,
} from "./aiFeatureService";

// Batch Processing
export {
  buildMap,
  calculateBatches,
  filterItems,
  filterSegments,
  prepareBatch,
  sliceBatch,
  type FilterOptions,
} from "./batch";

// Errors
export {
  AICancellationError,
  AIConfigurationError,
  AIError,
  AIFeatureNotFoundError,
  AIParseError,
  AIValidationError,
  getErrorMessage,
  isCancellationError,
  summarizeAIError,
  summarizeAiSpeakerError,
  toAIError,
} from "./errors";

// Formatting
export {
  previewResponse,
  previewText,
  summarizeError,
  summarizeIssues,
  summarizeMessages,
  truncateText,
  type Summarizable,
} from "./formatting";

// Feature Registry
export {
  clearRegistry,
  getAllFeatures,
  getFeature,
  getFeatureOrThrow,
  getFeaturesByCategory,
  getRegistrySize,
  hasFeature,
  registerDefaultFeatures,
  registerFeature,
  unregisterFeature,
} from "./featureRegistry";

// Provider Resolver
export {
  type ProviderResolveOptions,
  type ResolvedProvider,
  resolveProvider,
  resolveProviderSync,
} from "./providerResolver";

// Types
export type {
  AIBatchResult,
  AIFeatureCategory,
  AIFeatureConfig,
  AIFeatureOptions,
  AIFeatureResult,
  AIFeatureState,
  AIFeatureType,
  BatchCallbacks,
  CompiledMessages,
  FeatureRegistryEntry,
  PropertySchema,
  ResponseSchema,
} from "./types";
