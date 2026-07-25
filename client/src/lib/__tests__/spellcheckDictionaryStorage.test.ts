import { describe, expect, it, vi } from "vitest";
import {
  loadSpellcheckDictionaries,
  removeSpellcheckDictionary,
  saveSpellcheckDictionary,
} from "@/lib/spellcheckDictionaryStorage";
import type { SpellcheckCustomDictionary } from "@/lib/store";

describe("spellcheck dictionary storage", () => {
  it("no-ops safely when IndexedDB is unavailable", async () => {
    const originalIndexedDb = window.indexedDB;
    Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true });
    const dictionary: SpellcheckCustomDictionary = {
      id: "dict-1",
      name: "Names",
      language: "en-US",
      words: ["FlowScribe"],
      createdAt: 1,
      updatedAt: 2,
    };

    await expect(loadSpellcheckDictionaries()).resolves.toEqual([]);
    await expect(saveSpellcheckDictionary(dictionary)).resolves.toBeUndefined();
    await expect(removeSpellcheckDictionary(dictionary.id)).resolves.toBeUndefined();

    Object.defineProperty(window, "indexedDB", { value: originalIndexedDb, configurable: true });
    vi.unstubAllGlobals();
  });
});
