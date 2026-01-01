/**
 * AI Features Module - Public Exports
 *
 * @module ai/features
 */

// ==================== Speaker Classification ====================
export {
  speakerClassificationConfig,
  SPEAKER_SYSTEM_PROMPT,
  SPEAKER_USER_PROMPT_TEMPLATE,
  speakerResponseSchema,
  type SpeakerSuggestion,
  type SpeakerClassificationInput,
  type SpeakerClassificationOutput,
} from "./speakerClassification";

// ==================== Text Revision ====================
export {
  textRevisionConfig,
  REVISION_CLEANUP_SYSTEM_PROMPT,
  REVISION_CLEANUP_USER_TEMPLATE,
  REVISION_CLARITY_SYSTEM_PROMPT,
  REVISION_FORMALIZE_SYSTEM_PROMPT,
  BUILTIN_REVISION_PROMPTS,
  type TextRevisionInput,
  type TextRevisionOutput,
} from "./textRevision";

// ==================== Segment Merge (Placeholder) ====================
export {
  segmentMergeConfig,
  MERGE_SYSTEM_PROMPT,
  MERGE_USER_PROMPT_TEMPLATE,
  mergeResponseSchema,
  type MergeSuggestion,
  type SegmentMergeInput,
  type SegmentMergeOutput,
} from "./segmentMerge";

// ==================== Chapter Detection (Placeholder) ====================
export {
  chapterDetectionConfig,
  CHAPTER_SYSTEM_PROMPT,
  CHAPTER_USER_PROMPT_TEMPLATE,
  chapterResponseSchema,
  CHAPTER_GRANULARITY,
  type Chapter,
  type ChapterDetectionInput,
  type ChapterDetectionOutput,
} from "./chapterDetection";

// ==================== Content Transformation (Placeholder) ====================
export {
  contentTransformationConfig,
  TRANSFORM_SUMMARY_SYSTEM_PROMPT,
  TRANSFORM_MEETING_NOTES_SYSTEM_PROMPT,
  TRANSFORM_USER_PROMPT_TEMPLATE,
  TRANSFORMATION_TYPES,
  type TransformationType,
  type ContentTransformationInput,
  type ContentTransformationOutput,
} from "./contentTransformation";

