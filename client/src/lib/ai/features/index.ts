/**
 * AI Features Module - Public Exports
 *
 * @module ai/features
 */

export type {
  ChapterDetectionConfig,
  ChapterDetectionIssue,
  ChapterDetectionResponse,
} from "./chapterDetection";
// ==================== Chapter Detection ====================
export {
  CHAPTER_DETECTION_SYSTEM_PROMPT,
  CHAPTER_DETECTION_USER_PROMPT_TEMPLATE,
  chapterDetectionConfig,
  chapterDetectionResponseSchema,
  detectChapters,
} from "./chapterDetection";

// ==================== Content Transformation (Placeholder) ====================
export {
  type ContentTransformationInput,
  type ContentTransformationOutput,
  contentTransformationConfig,
  TRANSFORM_MEETING_NOTES_SYSTEM_PROMPT,
  TRANSFORM_SUMMARY_SYSTEM_PROMPT,
  TRANSFORM_USER_PROMPT_TEMPLATE,
  TRANSFORMATION_TYPES,
  type TransformationType,
} from "./contentTransformation";
// ==================== Text Revision ====================
// Re-export from revision/ module
export type {
  BatchRevisionParams,
  BatchRevisionResult,
  RevisionPrompt,
  RevisionResult,
  SingleRevisionParams,
  TextRevisionInput,
  TextRevisionOutput,
} from "./revision";
export {
  BUILTIN_REVISION_PROMPTS,
  buildRevisionPrompt,
  findPrompt,
  getDefaultPrompt,
  hasChanges,
  REVISION_CLARITY_SYSTEM_PROMPT,
  REVISION_CLEANUP_SYSTEM_PROMPT,
  REVISION_CLEANUP_USER_TEMPLATE,
  reviseSegment,
  reviseSegmentsBatch,
  textRevisionConfig,
} from "./revision";
export type {
  MergeAnalysisIssue,
  MergeAnalysisParams,
  MergeAnalysisResult,
  MergeAnalysisSegment,
  MergeConfidenceLevel,
  MergeSuggestion,
  MergeSuggestionStatus,
  RawMergeSuggestion,
  SegmentMergeConfig,
  SegmentMergeState,
  TextSmoothingInfo,
} from "./segmentMerge";
// ==================== Segment Merge ====================
// Re-export from segmentMerge/ module
export {
  // Service
  analyzeMergeCandidates,
  // Utils
  applyBasicSmoothing,
  calculateTimeGap,
  concatenateTexts,
  countByConfidence,
  createSmoothingInfo,
  // Constants
  DEFAULT_SEGMENT_MERGE_CONFIG,
  detectIncorrectSentenceBreak,
  endsIncomplete,
  endsWithSentencePunctuation,
  filterByStatus,
  formatSegmentPairsForPrompt,
  formatSegmentsForPrompt as formatMergeSegmentsForPrompt,
  formatTime,
  formatTimeRange,
  generateSuggestionId,
  getMergeSystemPrompt,
  getMergeUserTemplate,
  groupByConfidence,
  INITIAL_SEGMENT_MERGE_STATE,
  isSameSpeaker,
  isTimeGapAcceptable,
  // Config
  MERGE_ANALYSIS_SYSTEM_PROMPT,
  MERGE_ANALYSIS_USER_TEMPLATE,
  MERGE_ANALYSIS_USER_TEMPLATE_SIMPLE,
  meetsConfidenceThreshold,
  mergeResponseSchema,
  processSuggestion,
  processSuggestions,
  scoreToConfidenceLevel,
  segmentMergeConfig,
  startsWithCapital,
  validateMergeCandidate,
} from "./segmentMerge";
// ==================== Speaker Classification ====================
// Re-export from speaker/ module
export {
  formatSegmentsForPrompt,
  formatSpeakersForPrompt,
  markNewSpeaker,
  normalizeSpeakerTag,
  resolveSuggestedSpeaker,
  SPEAKER_SYSTEM_PROMPT,
  SPEAKER_USER_PROMPT_TEMPLATE,
  type SpeakerClassificationInput,
  type SpeakerClassificationOutput,
  type SpeakerSuggestion,
  speakerClassificationConfig,
  speakerResponseSchema,
} from "./speaker";
