import type {
  LexiconEntry,
  PersistedGlobalState,
  SpellcheckLanguage,
  TranscriptStore,
} from "../types";

export interface GlobalStatePayload extends PersistedGlobalState {
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
}

export const buildGlobalStatePayload = (state: TranscriptStore): GlobalStatePayload => ({
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
});
