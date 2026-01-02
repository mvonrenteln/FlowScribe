/**
 * AI Features Module - Public Exports
 *
 * @module ai/features
 */

// ==================== Chapter Detection (Placeholder) ====================
export {
  CHAPTER_GRANULARITY,
  CHAPTER_SYSTEM_PROMPT,
  CHAPTER_USER_PROMPT_TEMPLATE,
  type Chapter,
  type ChapterDetectionInput,
  type ChapterDetectionOutput,
  chapterDetectionConfig,
  chapterResponseSchema,
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

// ==================== Segment Merge (Placeholder) ====================
export {
  MERGE_SYSTEM_PROMPT,
  MERGE_USER_PROMPT_TEMPLATE,
  type MergeSuggestion,
  mergeResponseSchema,
  type SegmentMergeInput,
  type SegmentMergeOutput,
  segmentMergeConfig,
} from "./segmentMerge";
// ==================== Speaker Classification ====================
// Re-export from new speaker/ module
export {
  SPEAKER_SYSTEM_PROMPT,
  SPEAKER_USER_PROMPT_TEMPLATE,
  type SpeakerClassificationInput,
  type SpeakerClassificationOutput,
  type SpeakerSuggestion,
  speakerClassificationConfig,
  speakerResponseSchema,
} from "./speaker";

// Also export utilities from speaker module
export {
  normalizeSpeakerTag,
  resolveSuggestedSpeaker,
  markNewSpeaker,
  formatSegmentsForPrompt,
  formatSpeakersForPrompt,
} from "./speaker";
// ==================== Text Revision ====================
export {
  BUILTIN_REVISION_PROMPTS,
  REVISION_CLARITY_SYSTEM_PROMPT,
  REVISION_CLEANUP_SYSTEM_PROMPT,
  REVISION_CLEANUP_USER_TEMPLATE,
  REVISION_FORMALIZE_SYSTEM_PROMPT,
  type TextRevisionInput,
  type TextRevisionOutput,
  textRevisionConfig,
} from "./textRevision";
