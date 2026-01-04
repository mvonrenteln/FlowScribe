/**
 * Segment Merge Types
 *
 * Type definitions for the AI segment merge suggestion feature.
 *
 * @module ai/features/segmentMerge/types
 */

// ==================== Confidence Levels ====================

/**
 * Confidence level for merge suggestions.
 */
export type MergeConfidenceLevel = "high" | "medium" | "low";

/**
 * Status of a merge suggestion.
 */
export type MergeSuggestionStatus = "pending" | "accepted" | "rejected";

// ==================== Core Types ====================

/**
 * Text smoothing information for a merge suggestion.
 */
export interface TextSmoothingInfo {
  /** Whether smoothing was applied */
  applied: boolean;

  /** Original concatenated text (before smoothing) */
  originalConcatenated: string;

  /** Smoothed text (after AI processing) */
  smoothedText: string;

  /** Description of changes made */
  changes: string;
}

/**
 * A segment prepared for merge analysis.
 */
export interface MergeAnalysisSegment {
  /** Segment ID */
  id: string;

  /** Segment text */
  text: string;

  /** Speaker name */
  speaker: string;

  /** Start time in seconds */
  start: number;

  /** End time in seconds */
  end: number;
}

/**
 * A single merge suggestion from the AI.
 */
export interface MergeSuggestion {
  /** Unique ID for this suggestion */
  id: string;

  /** IDs of segments to merge (in order) */
  segmentIds: string[];

  /** Confidence level */
  confidence: MergeConfidenceLevel;

  /** Confidence score (0-1) */
  confidenceScore: number;

  /** Reason for suggesting merge */
  reason: string;

  /** Current status */
  status: MergeSuggestionStatus;

  /** Merged text (without smoothing) */
  mergedText: string;

  /** Text smoothing information (if enabled) */
  smoothing?: TextSmoothingInfo;

  /** Time range of merged segment */
  timeRange: {
    start: number;
    end: number;
  };

  /** Speaker name */
  speaker: string;

  /** Time gap between segments in seconds */
  timeGap: number;
}

/**
 * Raw merge suggestion from AI response.
 */
export interface RawMergeSuggestion {
  /** Segment IDs to merge */
  segmentIds: string[];

  /** Confidence score (0-1) */
  confidence: number;

  /** Reason for merge */
  reason?: string;

  /** Smoothed merged text (if smoothing enabled) */
  smoothedText?: string;

  /** Description of smoothing changes */
  smoothingChanges?: string;
}

// ==================== Analysis Parameters ====================

/**
 * Scope for merge analysis.
 */
export type MergeAnalysisScope = "all" | "filtered" | "selected";

/**
 * Parameters for merge analysis.
 */
export interface MergeAnalysisParams {
  /** Segments to analyze */
  segments: MergeAnalysisSegment[];

  /** Maximum time gap between segments (seconds) */
  maxTimeGap: number;

  /** Minimum confidence level to include */
  minConfidence: MergeConfidenceLevel;

  /** Only suggest merges for same speaker */
  sameSpeakerOnly: boolean;

  /** Enable text smoothing suggestions */
  enableSmoothing: boolean;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Batch analysis parameters.
 */
export interface BatchMergeAnalysisParams extends MergeAnalysisParams {
  /** Batch size for processing */
  batchSize: number;

  /** Progress callback */
  onProgress?: (processed: number, total: number) => void;

  /** Called when suggestions are found */
  onSuggestions?: (suggestions: MergeSuggestion[]) => void;
}

// ==================== Analysis Results ====================

/**
 * Issue encountered during analysis.
 */
export interface MergeAnalysisIssue {
  level: "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Result of merge analysis.
 */
export interface MergeAnalysisResult {
  /** Found suggestions */
  suggestions: MergeSuggestion[];

  /** Summary statistics */
  summary: {
    /** Total segment pairs analyzed */
    analyzed: number;

    /** Number of suggestions found */
    found: number;

    /** Breakdown by confidence */
    byConfidence: {
      high: number;
      medium: number;
      low: number;
    };
  };

  /** Issues encountered */
  issues: MergeAnalysisIssue[];
}

// ==================== Configuration ====================

/**
 * Configuration for segment merge feature.
 */
export interface SegmentMergeConfig {
  /** Default maximum time gap (seconds) */
  defaultMaxTimeGap: number;

  /** Default minimum confidence level */
  defaultMinConfidence: MergeConfidenceLevel;

  /** Enable smoothing by default */
  defaultEnableSmoothing: boolean;

  /** Show inline hints after analysis */
  showInlineHints: boolean;

  /** Selected AI provider ID */
  selectedProviderId?: string;

  /** Selected model */
  selectedModel?: string;

  /** Batch size for analysis */
  batchSize: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_SEGMENT_MERGE_CONFIG: SegmentMergeConfig = {
  defaultMaxTimeGap: 2.0,
  defaultMinConfidence: "medium",
  defaultEnableSmoothing: true,
  showInlineHints: true,
  batchSize: 20,
};

// ==================== Store Types ====================

/**
 * Store state for segment merge feature.
 */
export interface SegmentMergeState {
  /** Current suggestions */
  suggestions: MergeSuggestion[];

  /** Whether analysis is in progress */
  isProcessing: boolean;

  /** Number of segment pairs processed */
  processedCount: number;

  /** Total segment pairs to process */
  totalToProcess: number;

  /** Current error (if any) */
  error: string | null;

  /** Configuration */
  config: SegmentMergeConfig;

  /** Abort controller for cancellation */
  abortController: AbortController | null;
}

/**
 * Initial state for segment merge feature.
 */
export const INITIAL_SEGMENT_MERGE_STATE: Omit<SegmentMergeState, "abortController"> = {
  suggestions: [],
  isProcessing: false,
  processedCount: 0,
  totalToProcess: 0,
  error: null,
  config: DEFAULT_SEGMENT_MERGE_CONFIG,
};
