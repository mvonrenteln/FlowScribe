/**
 * Speaker Classification Feature
 *
 * Public API for the speaker classification feature.
 *
 * @module ai/features/speaker
 */

// Configuration
export {
  speakerClassificationConfig,
  SPEAKER_SYSTEM_PROMPT,
  SPEAKER_USER_PROMPT_TEMPLATE,
  speakerResponseSchema,
  buildSpeakerPrompt,
} from "./config";

// Types
export type {
  SpeakerSuggestion,
  SpeakerClassificationInput,
  SpeakerClassificationOutput,
  SpeakerClassificationResult,
  SpeakerClassificationConfig,
  RawSpeakerResponseItem,
  BatchSegment,
  BatchIssue,
  ParsedSuggestionsResult,
} from "./types";

// Utilities
export {
  normalizeSpeakerTag,
  resolveSuggestedSpeaker,
  markNewSpeaker,
  formatSegmentsForPrompt,
  formatSpeakersForPrompt,
  prepareBatchSegments,
  truncateForPrompt,
  estimateTokens,
} from "./utils";

// Service will be added after migration is complete
// export { classifySpeakers, classifySpeakersBatch } from "./service";

