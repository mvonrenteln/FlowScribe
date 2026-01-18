import { beforeEach, describe, expect, it } from "vitest";
import { useTranscriptStore } from "@/lib/store";
import { resetStore } from "./storeTestUtils";

describe("Spellcheck slice", () => {
  beforeEach(() => {
    resetStore();
  });

  it("normalizes and deduplicates spellcheck ignore words", () => {
    const {
      setSpellcheckIgnoreWords,
      addSpellcheckIgnoreWord,
      removeSpellcheckIgnoreWord,
      clearSpellcheckIgnoreWords,
    } = useTranscriptStore.getState();

    setSpellcheckIgnoreWords(["  Test  ", "test", "  ", "123"]);
    expect(useTranscriptStore.getState().spellcheckIgnoreWords).toEqual(["test", "123"]);

    addSpellcheckIgnoreWord("  Test ");
    addSpellcheckIgnoreWord("");
    expect(useTranscriptStore.getState().spellcheckIgnoreWords).toEqual(["test", "123"]);

    removeSpellcheckIgnoreWord("");
    removeSpellcheckIgnoreWord("test");
    expect(useTranscriptStore.getState().spellcheckIgnoreWords).toEqual(["123"]);

    clearSpellcheckIgnoreWords();
    expect(useTranscriptStore.getState().spellcheckIgnoreWords).toEqual([]);
  });

  it("keeps built-in languages exclusive", () => {
    const { setSpellcheckLanguages } = useTranscriptStore.getState();

    setSpellcheckLanguages(["de", "en"]);

    const { spellcheckLanguages, spellcheckCustomEnabled } = useTranscriptStore.getState();
    expect(spellcheckLanguages).toEqual(["en"]);
    expect(spellcheckCustomEnabled).toBe(false);
  });

  it("toggles custom spellcheck mode consistently", () => {
    const { setSpellcheckCustomEnabled, setSpellcheckLanguages } = useTranscriptStore.getState();

    setSpellcheckCustomEnabled(true);

    let state = useTranscriptStore.getState();
    expect(state.spellcheckCustomEnabled).toBe(true);
    expect(state.spellcheckLanguages).toEqual([]);

    setSpellcheckCustomEnabled(false);
    state = useTranscriptStore.getState();
    expect(state.spellcheckCustomEnabled).toBe(false);
    expect(state.spellcheckLanguages).toEqual(["de"]);

    setSpellcheckCustomEnabled(true);
    setSpellcheckLanguages(["en"]);
    state = useTranscriptStore.getState();
    expect(state.spellcheckCustomEnabled).toBe(false);
    expect(state.spellcheckLanguages).toEqual(["en"]);
  });
});
