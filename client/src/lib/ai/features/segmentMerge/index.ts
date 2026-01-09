/**
 * Segment Merge Feature
 *
 * Public API for the segment merge suggestion feature.
 *
 * @module ai/features/segmentMerge
 */

// Configuration
export {
  getMergeSystemPrompt,
  getMergeUserTemplate,
  MERGE_ANALYSIS_SYSTEM_PROMPT,
  MERGE_ANALYSIS_USER_TEMPLATE,
  MERGE_ANALYSIS_USER_TEMPLATE_SIMPLE,
  mergeResponseSchema,
  segmentMergeConfig,
} from "./config";

// Service
export { analyzeMergeCandidates } from "./service";

// Types
export type {
  MergeAnalysisIssue,
  MergeAnalysisParams,
  MergeAnalysisResult,
  MergeAnalysisSegment,
  MergeBatchLogEntry,
  MergeConfidenceLevel,
  MergeSuggestion,
  MergeSuggestionStatus,
  RawMergeSuggestion,
  SegmentMergeConfig,
  SegmentMergeState,
  TextSmoothingInfo,
} from "./types";

export { DEFAULT_SEGMENT_MERGE_CONFIG, INITIAL_SEGMENT_MERGE_STATE } from "./types";

// Utilities (pure functions)
export {
  applyBasicSmoothing,
  calculateTimeGap,
  concatenateTexts,
  countByConfidence,
  createSmoothingInfo,
  detectIncorrectSentenceBreak,
  endsIncomplete,
  endsWithSentencePunctuation,
  filterByStatus,
  formatSegmentPairsForPrompt,
  formatSegmentsForPrompt,
  formatTime,
  formatTimeRange,
  generateSuggestionId,
  groupByConfidence,
  isSameSpeaker,
  isTimeGapAcceptable,
  meetsConfidenceThreshold,
  processSuggestion,
  processSuggestions,
  scoreToConfidenceLevel,
  startsWithCapital,
  validateMergeCandidate,
} from "./utils";
