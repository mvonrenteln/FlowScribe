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
  type BatchCoordinatorOptions,
  type BatchCoordinatorResult,
  buildMap,
  calculateBatches,
  type FilterOptions,
  filterItems,
  filterSegments,
  type OrderedConcurrencyOptions,
  prepareBatch,
  runBatchCoordinator,
  runConcurrentOrdered,
  sliceBatch,
  yieldToMainThread,
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
  AIAuthError,
  AICancellationError,
  AIConfigurationError,
  AIConnectionError,
  AIError,
  AIFeatureNotFoundError,
  AIParseError,
  AIProviderUnavailableError,
  AIRateLimitError,
  AIRequestError,
  AIValidationError,
  getErrorMessage,
  isCancellationError,
  isHardAIErrorCode,
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
// Response payload formatting helper
export { formatResponsePayload } from "./formatResponsePayload";
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
