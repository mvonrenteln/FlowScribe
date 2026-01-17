import type { FileReference } from "@/lib/fileReference";
import { PAUSED_TIME_PERSIST_STEP, PLAYING_TIME_PERSIST_STEP } from "@/lib/store/constants";
import type {
  AIRevisionConfig,
  AISpeakerConfig,
  LexiconEntry,
  Segment,
  SessionKind,
  Speaker,
  SpellcheckLanguage,
  Tag,
  TranscriptStore,
} from "@/lib/store/types";

export interface PersistenceSelection {
  sessionKey: string;
  audioRef: FileReference | null;
  transcriptRef: FileReference | null;
  segments: Segment[];
  speakers: Speaker[];
  tags: Tag[];
  selectedSegmentId: string | null;
  currentTime: number;
  currentTimeBucket: number;
  isPlaying: boolean;
  isWhisperXFormat: boolean;
  sessionKind: SessionKind;
  sessionLabel: string | null;
  baseSessionKey: string | null;
  lexiconEntries: LexiconEntry[];
  lexiconThreshold: number;
  lexiconHighlightUnderline: boolean;
  lexiconHighlightBackground: boolean;
  spellcheckEnabled: boolean;
  spellcheckLanguages: SpellcheckLanguage[];
  spellcheckIgnoreWords: string[];
  spellcheckCustomEnabled: boolean;
  aiSpeakerConfig: AISpeakerConfig;
  aiRevisionConfig: AIRevisionConfig;
}

/**
 * Derives a stable time bucket so persistence work only runs after a threshold
 * change rather than every playback tick.
 */
export const getPersistTimeBucket = (currentTime: number, isPlaying: boolean): number => {
  const step = isPlaying ? PLAYING_TIME_PERSIST_STEP : PAUSED_TIME_PERSIST_STEP;
  if (step <= 0) return 0;
  return Math.floor(currentTime / step);
};

/**
 * Selects only the store fields that can affect persistence, avoiding unnecessary
 * subscription churn on unrelated UI state.
 */
export const selectPersistenceState = (state: TranscriptStore): PersistenceSelection => ({
  sessionKey: state.sessionKey,
  audioRef: state.audioRef,
  transcriptRef: state.transcriptRef,
  segments: state.segments,
  speakers: state.speakers,
  tags: state.tags,
  selectedSegmentId: state.selectedSegmentId,
  currentTime: state.currentTime,
  currentTimeBucket: getPersistTimeBucket(state.currentTime, state.isPlaying),
  isPlaying: state.isPlaying,
  isWhisperXFormat: state.isWhisperXFormat,
  sessionKind: state.sessionKind,
  sessionLabel: state.sessionLabel,
  baseSessionKey: state.baseSessionKey,
  lexiconEntries: state.lexiconEntries,
  lexiconThreshold: state.lexiconThreshold,
  lexiconHighlightUnderline: state.lexiconHighlightUnderline,
  lexiconHighlightBackground: state.lexiconHighlightBackground,
  spellcheckEnabled: state.spellcheckEnabled,
  spellcheckLanguages: state.spellcheckLanguages,
  spellcheckIgnoreWords: state.spellcheckIgnoreWords,
  spellcheckCustomEnabled: state.spellcheckCustomEnabled,
  aiSpeakerConfig: state.aiSpeakerConfig,
  aiRevisionConfig: state.aiRevisionConfig,
});

export const arePersistenceSelectionsEqual = (
  left: PersistenceSelection,
  right: PersistenceSelection,
): boolean =>
  left.sessionKey === right.sessionKey &&
  left.audioRef === right.audioRef &&
  left.transcriptRef === right.transcriptRef &&
  left.segments === right.segments &&
  left.speakers === right.speakers &&
  left.tags === right.tags &&
  left.selectedSegmentId === right.selectedSegmentId &&
  left.currentTimeBucket === right.currentTimeBucket &&
  left.isPlaying === right.isPlaying &&
  left.isWhisperXFormat === right.isWhisperXFormat &&
  left.sessionKind === right.sessionKind &&
  left.sessionLabel === right.sessionLabel &&
  left.baseSessionKey === right.baseSessionKey &&
  left.lexiconEntries === right.lexiconEntries &&
  left.lexiconThreshold === right.lexiconThreshold &&
  left.lexiconHighlightUnderline === right.lexiconHighlightUnderline &&
  left.lexiconHighlightBackground === right.lexiconHighlightBackground &&
  left.spellcheckEnabled === right.spellcheckEnabled &&
  left.spellcheckLanguages === right.spellcheckLanguages &&
  left.spellcheckIgnoreWords === right.spellcheckIgnoreWords &&
  left.spellcheckCustomEnabled === right.spellcheckCustomEnabled &&
  left.aiSpeakerConfig === right.aiSpeakerConfig &&
  left.aiRevisionConfig === right.aiRevisionConfig;
