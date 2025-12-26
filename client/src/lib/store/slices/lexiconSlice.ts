import type { StoreApi } from "zustand";
import type { LexiconSlice, TranscriptStore } from "../types";
import { normalizeLexiconTerm, uniqueEntries } from "../utils/lexicon";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

export const createLexiconSlice = (set: StoreSetter, get: StoreGetter): LexiconSlice => ({
  setLexiconEntries: (entries) => {
    set({ lexiconEntries: uniqueEntries(entries) });
  },

  addLexiconEntry: (term, variants = [], falsePositives = []) => {
    const cleaned = term.trim();
    if (!cleaned) return;
    const entry = { term: cleaned, variants, falsePositives };
    const { lexiconEntries } = get();
    const next = uniqueEntries([...lexiconEntries, entry]);
    set({ lexiconEntries: next });
  },

  removeLexiconEntry: (term) => {
    const normalized = normalizeLexiconTerm(term);
    const { lexiconEntries } = get();
    const next = lexiconEntries.filter((item) => normalizeLexiconTerm(item.term) !== normalized);
    set({ lexiconEntries: next });
  },

  updateLexiconEntry: (previousTerm, term, variants = [], falsePositives = []) => {
    const normalizedPrevious = normalizeLexiconTerm(previousTerm);
    const cleaned = term.trim();
    if (!cleaned) return;
    const { lexiconEntries } = get();
    const remaining = lexiconEntries.filter(
      (entry) => normalizeLexiconTerm(entry.term) !== normalizedPrevious,
    );
    const next = uniqueEntries([...remaining, { term: cleaned, variants, falsePositives }]);
    set({ lexiconEntries: next });
  },
  addLexiconFalsePositive: (term, value) => {
    const cleaned = value.trim();
    if (!cleaned) return;
    const normalizedTerm = normalizeLexiconTerm(term);
    const { lexiconEntries } = get();
    const next = uniqueEntries(
      lexiconEntries.map((entry) => {
        if (normalizeLexiconTerm(entry.term) !== normalizedTerm) return entry;
        const falsePositives = [...(entry.falsePositives ?? []), cleaned];
        return { ...entry, falsePositives };
      }),
    );
    set({ lexiconEntries: next });
  },

  setLexiconThreshold: (value) => {
    const clamped = Math.max(0.5, Math.min(0.99, value));
    set({ lexiconThreshold: clamped });
  },

  setLexiconHighlightUnderline: (value) => set({ lexiconHighlightUnderline: value }),
  setLexiconHighlightBackground: (value) => set({ lexiconHighlightBackground: value }),
});
