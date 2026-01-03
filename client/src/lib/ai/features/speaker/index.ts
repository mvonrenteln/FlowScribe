/**
 * Speaker Classification Feature
 *
 * Public API for the speaker classification feature.
 *
 * @module ai/features/speaker
 */

// Configuration
export {
  buildSpeakerPrompt,
  SPEAKER_SYSTEM_PROMPT,
  SPEAKER_USER_PROMPT_TEMPLATE,
  speakerClassificationConfig,
  speakerResponseSchema,
} from "./config";

// Service
export type {
  ClassifySpeakersBatchOptions,
  ClassifySpeakersBatchResult,
  ClassifySpeakersOptions,
} from "./service";

export {
  classifySpeakers,
  classifySpeakersBatch,
  parseRawResponse,
} from "./service";

// Types
export type {
  BatchIssue,
  BatchSegment,
  ParsedSuggestionsResult,
  RawSpeakerResponseItem,
  SpeakerClassificationConfig,
  SpeakerClassificationInput,
  SpeakerClassificationOutput,
  SpeakerClassificationResult,
  SpeakerSuggestion,
} from "./types";

// Utilities
export {
  buildCurrentSpeakersMap,
  estimateTokens,
  filterSegmentsForAnalysis,
  formatSegmentsForPrompt,
  formatSpeakersForPrompt,
  markNewSpeaker,
  normalizeSpeakerTag,
  prepareBatch,
  prepareBatchSegments,
  previewResponse,
  resolveSuggestedSpeaker,
  summarizeIssues,
  truncateForPrompt,
} from "./utils";
