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
  type FilterOptions,
  filterItems,
  filterSegments,
  prepareBatch,
  sliceBatch,
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
// Formatting
export {
  previewResponse,
  previewText,
  type Summarizable,
  summarizeError,
  summarizeIssues,
  summarizeMessages,
  truncateText,
} from "./formatting";

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
