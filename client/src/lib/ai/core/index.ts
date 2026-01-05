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
// Batch ID Mapping
export {
  addPair,
  type BatchIdMapping,
  type BatchPairMapping,
  createBatchIdMapping,
  createBatchPairMapping,
  deserializeBatchMapping,
  extractSegmentIdsGeneric,
  getPairIds,
  normalizeIds,
  parseIdReference,
  type RawAIItem,
  realToSimpleId,
  serializeBatchMapping,
  serializePairMapping,
  simpleToRealId,
} from "./batchIdMapping";

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
  type Summarizable,
  summarizeError,
  summarizeMessages,
  truncateText,
} from "./formatting";

// Provider Resolver
export {
  type ProviderResolveOptions,
  type ResolvedProvider,
  resolveProvider,
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
