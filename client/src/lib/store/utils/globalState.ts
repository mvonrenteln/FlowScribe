import type { BackupConfig } from "@/lib/backup/types";
import type {
  AIChapterDetectionConfig,
  AIRevisionConfig,
  AISegmentMergeConfig,
  LexiconEntry,
  PersistedGlobalState,
  SpellcheckLanguage,
  TranscriptStore,
} from "../types";

export interface GlobalStatePayload extends PersistedGlobalState {
  backupConfig: BackupConfig;
  lexiconEntries: LexiconEntry[];
  lexiconTerms: string[];
  lexiconThreshold: number;
  lexiconHighlightUnderline: boolean;
  lexiconHighlightBackground: boolean;
  spellcheckEnabled: boolean;
  spellcheckLanguages: SpellcheckLanguage[];
  spellcheckIgnoreWords: string[];
  spellcheckCustomEnabled: boolean;
  aiSpeakerConfig: PersistedGlobalState["aiSpeakerConfig"];
  highlightLowConfidence: boolean;
  manualConfidenceThreshold: number | null;
  aiRevisionConfig: AIRevisionConfig;
  aiSegmentMergeConfig: AISegmentMergeConfig;
  aiChapterDetectionConfig: AIChapterDetectionConfig;
}

export const buildGlobalStatePayload = (state: TranscriptStore): GlobalStatePayload => ({
  backupConfig: state.backupConfig,
  lexiconEntries: state.lexiconEntries,
  lexiconTerms: state.lexiconEntries.map((entry) => entry.term),
  lexiconThreshold: state.lexiconThreshold,
  lexiconHighlightUnderline: state.lexiconHighlightUnderline,
  lexiconHighlightBackground: state.lexiconHighlightBackground,
  spellcheckEnabled: state.spellcheckEnabled,
  spellcheckLanguages: state.spellcheckLanguages,
  spellcheckIgnoreWords: state.spellcheckIgnoreWords,
  spellcheckCustomEnabled: state.spellcheckCustomEnabled,
  aiSpeakerConfig: state.aiSpeakerConfig,
  highlightLowConfidence: state.highlightLowConfidence,
  manualConfidenceThreshold: state.manualConfidenceThreshold,
  aiRevisionConfig: state.aiRevisionConfig,
  aiSegmentMergeConfig: state.aiSegmentMergeConfig,
  aiChapterDetectionConfig: state.aiChapterDetectionConfig,
});
