/**
 * AI Feature Core Types
 *
 * Core type definitions for the unified AI feature service.
 * These types are shared across all AI features and provide
 * a consistent interface for feature execution.
 *
 * @module ai/core/types
 */

import type { AIProviderConfig, ChatMessage, ChatOptions } from "../providers/types";

// ==================== Feature Types ====================

/**
 * Enumeration of all AI feature types.
 * Each feature type has a corresponding configuration.
 */
export type AIFeatureType =
  | "speaker-classification"
  | "text-revision"
  | "segment-merge"
  | "chapter-detection"
  | "multi-track-merge"
  | "content-transformation";

/**
 * Category of AI feature based on output type.
 * Used for UI rendering and result handling.
 */
export type AIFeatureCategory =
  | "metadata" // Returns structured metadata (labels, tags)
  | "text" // Returns transformed text
  | "structural" // Returns operation suggestions
  | "export"; // Returns formatted documents

// ==================== Feature Configuration ====================

/**
 * Configuration for an AI feature.
 * Defines how the feature behaves and what prompts it uses.
 */
export interface AIFeatureConfig {
  /** Unique identifier for this feature */
  id: AIFeatureType;

  /** Human-readable name */
  name: string;

  /** Feature category for UI handling */
  category: AIFeatureCategory;

  /** Default system prompt */
  systemPrompt: string;

  /** Default user prompt template with placeholders */
  userPromptTemplate: string;

  /** Whether this feature supports batch processing */
  batchable: boolean;

  /** Whether this feature supports streaming responses */
  streamable: boolean;

  /** Default batch size for this feature */
  defaultBatchSize: number;

  /** Keyboard shortcut (optional) */
  shortcut?: string;

  /** Icon name for UI (optional) */
  icon?: string;

  /** Whether user confirmation is required before applying results */
  requiresConfirmation: boolean;

  /** Available placeholders for prompt templates */
  availablePlaceholders: string[];

  /** JSON schema for validating AI response (optional) */
  responseSchema?: ResponseSchema;
}

// ==================== Feature Execution ====================

/**
 * Information about a retry attempt for logging/UI purposes.
 */
export interface RetryAttemptInfo {
  /** Current attempt number (1-based) */
  attempt: number;
  /** Maximum number of attempts configured */
  maxAttempts: number;
  /** Error message that triggered the retry */
  errorMessage: string;
  /** Duration of the failed attempt in ms */
  attemptDurationMs: number;
}

/**
 * Options for executing an AI feature.
 */
export interface AIFeatureOptions {
  /** Provider configuration to use */
  provider?: AIProviderConfig;

  /** Provider ID to use (alternative to full provider config) */
  providerId?: string;

  /** Model to use (overrides provider default) */
  model?: string;

  /** Custom prompt to use instead of default */
  customPrompt?: {
    systemPrompt?: string;
    userPromptTemplate?: string;
  };

  /** Chat options (temperature, maxTokens, etc.) */
  chatOptions?: ChatOptions;

  /** Abort signal for cancellation */
  signal?: AbortSignal;

  /**
   * Callback invoked when a retry attempt is made due to parse failure.
   * Can be used to log retry attempts in batch logs.
   */
  onRetry?: (info: RetryAttemptInfo) => void;
}

/**
 * Result of executing an AI feature.
 */
export interface AIFeatureResult<T> {
  /** Whether execution was successful */
  success: boolean;

  /** The parsed result data (if successful) */
  data?: T;

  /** Error message (if failed) */
  error?: string;

  /** Raw response from AI (for debugging) */
  rawResponse?: string;

  /** Execution metadata */
  metadata: {
    /** Feature that was executed */
    featureId: AIFeatureType;

    /** Provider used */
    providerId: string;

    /** Model used */
    model: string;

    /** Execution time in milliseconds */
    durationMs: number;

    /** Token usage (if available) */
    tokenUsage?: {
      prompt: number;
      completion: number;
      total: number;
    };

    /** Number of retry attempts made before success (0 if first attempt succeeded) */
    retryAttempts?: number;
  };
}

/**
 * State of a feature execution operation.
 */
export interface AIFeatureState {
  /** Whether an operation is in progress */
  isProcessing: boolean;

  /** Progress for batch operations (0-100) */
  progress: number;

  /** Number of items processed */
  processedCount: number;

  /** Total items to process */
  totalCount: number;

  /** Current error (if any) */
  error: string | null;

  /** Abort controller for cancellation */
  abortController: AbortController | null;
}

// ==================== Batch Processing ====================

/**
 * Callbacks for batch processing.
 */
export interface BatchCallbacks<T> {
  /** Called when a single item is processed */
  onItemComplete?: (index: number, result: AIFeatureResult<T>) => void;

  /** Called when progress updates */
  onProgress?: (processed: number, total: number) => void;

  /** Called when an error occurs for a single item */
  onItemError?: (index: number, error: Error) => void;
}

/**
 * Result of a batch operation.
 */
export interface AIBatchResult<T> {
  /** All individual results */
  results: AIFeatureResult<T>[];

  /** Summary statistics */
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    durationMs: number;
  };
}

// ==================== Response Schema ====================

/**
 * Simple schema definition for response validation.
 * Supports basic type checking without external dependencies.
 */
export interface ResponseSchema {
  type: "object" | "array";
  properties?: Record<string, PropertySchema>;
  items?: PropertySchema;
  required?: string[];
}

export interface PropertySchema {
  type: "string" | "number" | "boolean" | "object" | "array";
  enum?: (string | number)[];
  properties?: Record<string, PropertySchema>;
  items?: PropertySchema;
  optional?: boolean;
  default?: unknown;
}

// ==================== Messages ====================

/**
 * Compiled messages ready to send to AI provider.
 */
export interface CompiledMessages {
  messages: ChatMessage[];
  metadata: {
    templateId?: string;
    variables: Record<string, unknown>;
  };
}

// ==================== Feature Registry Entry ====================

/**
 * Entry in the feature registry.
 */
export interface FeatureRegistryEntry {
  config: AIFeatureConfig;
  registeredAt: Date;
}
