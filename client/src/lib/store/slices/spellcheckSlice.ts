import type { StoreApi } from "zustand";
import { createLogger } from "@/lib/logging";
import {
  loadSpellcheckDictionaries,
  removeSpellcheckDictionary,
  saveSpellcheckDictionary,
} from "@/lib/spellcheckDictionaryStorage";
import type { SpellcheckSlice, TranscriptStore } from "../types";
import { generateId } from "../utils/id";
import {
  normalizeSpellcheckIgnoreWords,
  normalizeSpellcheckLanguages,
  resolveSpellcheckSelection,
} from "../utils/spellcheck";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

const logger = createLogger({ feature: "SpellcheckSlice", namespace: "Store" });

export const createSpellcheckSlice = (set: StoreSetter, get: StoreGetter): SpellcheckSlice => ({
  setSpellcheckEnabled: (enabled) => set({ spellcheckEnabled: enabled }),
  setSpellcheckLanguages: (languages) => {
    const normalized = normalizeSpellcheckLanguages(languages);
    const resolved = resolveSpellcheckSelection(normalized, false);
    set({
      spellcheckLanguages: resolved.languages,
      spellcheckCustomEnabled: resolved.customEnabled,
    });
  },
  setSpellcheckIgnoreWords: (words) =>
    set({ spellcheckIgnoreWords: normalizeSpellcheckIgnoreWords(words) }),
  addSpellcheckIgnoreWord: (value) => {
    const cleaned = normalizeSpellcheckIgnoreWords([value])[0];
    if (!cleaned) return;
    const { spellcheckIgnoreWords } = get();
    if (spellcheckIgnoreWords.includes(cleaned)) return;
    set({ spellcheckIgnoreWords: [...spellcheckIgnoreWords, cleaned] });
  },
  removeSpellcheckIgnoreWord: (value) => {
    const cleaned = normalizeSpellcheckIgnoreWords([value])[0];
    if (!cleaned) return;
    const { spellcheckIgnoreWords } = get();
    set({
      spellcheckIgnoreWords: spellcheckIgnoreWords.filter((word) => word !== cleaned),
    });
  },
  clearSpellcheckIgnoreWords: () => set({ spellcheckIgnoreWords: [] }),
  setSpellcheckCustomEnabled: (enabled) => {
    const normalized = normalizeSpellcheckLanguages(get().spellcheckLanguages);
    const resolved = resolveSpellcheckSelection(normalized, enabled);
    set({
      spellcheckLanguages: resolved.languages,
      spellcheckCustomEnabled: resolved.customEnabled,
    });
  },
  loadSpellcheckCustomDictionaries: async () => {
    const { spellcheckCustomDictionariesLoaded } = get();
    if (spellcheckCustomDictionariesLoaded) return;
    try {
      const dictionaries = await loadSpellcheckDictionaries();
      set({
        spellcheckCustomDictionaries: dictionaries,
        spellcheckCustomDictionariesLoaded: true,
      });
    } catch (err) {
      logger.error("Failed to load spellcheck dictionaries.", { error: err });
      set({ spellcheckCustomDictionariesLoaded: true });
    }
  },
  addSpellcheckCustomDictionary: async (dictionary) => {
    const entry = { ...dictionary, id: generateId() };
    try {
      await saveSpellcheckDictionary(entry);
    } catch (err) {
      logger.error("Failed to save spellcheck dictionary.", { error: err });
    }
    const { spellcheckCustomDictionaries } = get();
    set({
      spellcheckCustomDictionaries: [...spellcheckCustomDictionaries, entry],
    });
  },
  removeSpellcheckCustomDictionary: async (id) => {
    try {
      await removeSpellcheckDictionary(id);
    } catch (err) {
      logger.error("Failed to remove spellcheck dictionary.", { error: err });
    }
    const { spellcheckCustomDictionaries } = get();
    set({
      spellcheckCustomDictionaries: spellcheckCustomDictionaries.filter(
        (dictionary) => dictionary.id !== id,
      ),
    });
  },
});
