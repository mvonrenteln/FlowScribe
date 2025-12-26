import type {
  LexiconEntry,
  PersistedGlobalState,
  SpellcheckLanguage,
  TranscriptStore,
} from "../types";

export interface GlobalStateSnapshot extends PersistedGlobalState {
  lexiconEntries: LexiconEntry[];
  lexiconTerms: string[];
  lexiconThreshold: number;
  lexiconHighlightUnderline: boolean;
  lexiconHighlightBackground: boolean;
  spellcheckEnabled: boolean;
  spellcheckLanguages: SpellcheckLanguage[];
  spellcheckIgnoreWords: string[];
  spellcheckCustomEnabled: boolean;
}

export const buildGlobalStateSnapshot = (state: TranscriptStore): GlobalStateSnapshot => ({
  lexiconEntries: state.lexiconEntries,
  lexiconTerms: state.lexiconEntries.map((entry) => entry.term),
  lexiconThreshold: state.lexiconThreshold,
  lexiconHighlightUnderline: state.lexiconHighlightUnderline,
  lexiconHighlightBackground: state.lexiconHighlightBackground,
  spellcheckEnabled: state.spellcheckEnabled,
  spellcheckLanguages: state.spellcheckLanguages,
  spellcheckIgnoreWords: state.spellcheckIgnoreWords,
  spellcheckCustomEnabled: state.spellcheckCustomEnabled,
});
