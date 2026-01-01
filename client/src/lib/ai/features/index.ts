/**
 * AI Features Module - Public Exports
 *
 * @module ai/features
 */

// Speaker Classification
export {
  speakerClassificationConfig,
  SPEAKER_SYSTEM_PROMPT,
  SPEAKER_USER_PROMPT_TEMPLATE,
  speakerResponseSchema,
  type SpeakerSuggestion,
  type SpeakerClassificationInput,
  type SpeakerClassificationOutput,
} from "./speakerClassification";

// Text Revision
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

