import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type UseSpellcheckOptions, useSpellcheck } from "../useSpellcheck";

const loadSpellcheckersMock = vi.fn().mockResolvedValue([]);
const getSpellcheckMatchMock = vi.fn();
const baseSpellcheckLanguages = ["en"] as const;
const baseSpellcheckCustomDictionaries = [] as const;
const baseSpellcheckIgnoreWords = [] as const;
const baseLexiconEntries = [] as const;
const loadSpellcheckCustomDictionariesMock = vi.fn();

vi.mock("@/lib/spellcheck", () => ({
  loadSpellcheckers: (...args: unknown[]) => loadSpellcheckersMock(...args),
  getSpellcheckMatch: (...args: unknown[]) => getSpellcheckMatchMock(...args),
  normalizeSpellcheckTerm: (value: string) => value.toLowerCase(),
}));

describe("useSpellcheck", () => {
  beforeEach(() => {
    loadSpellcheckersMock.mockClear();
    getSpellcheckMatchMock.mockReset();
  });

  it("loads spellcheckers and collects matches", async () => {
    const segments = [
      {
        id: "segment-1",
        speaker: "SPEAKER_00",
        tags: [],
        start: 0,
        end: 1,
        text: "Wrd",
        words: [{ word: "Wrd", start: 0, end: 1 }],
      },
    ];

    loadSpellcheckersMock.mockResolvedValue([{}]);
    getSpellcheckMatchMock.mockReturnValue({ suggestions: ["Word"] });

    const spellcheckLanguages = Array.from(baseSpellcheckLanguages);
    const spellcheckCustomDictionaries = Array.from(baseSpellcheckCustomDictionaries);
    const spellcheckIgnoreWords = Array.from(baseSpellcheckIgnoreWords);
    const lexiconEntries = Array.from(baseLexiconEntries);

    const { result } = renderHook(() =>
      useSpellcheck({
        audioUrl: null,
        isWaveReady: true,
        spellcheckEnabled: true,
        spellcheckLanguages,
        spellcheckCustomEnabled: false,
        spellcheckCustomDictionaries,
        loadSpellcheckCustomDictionaries: loadSpellcheckCustomDictionariesMock,
        segments,
        spellcheckIgnoreWords,
        lexiconEntries,
      }),
    );

    await waitFor(
      () => {
        expect(loadSpellcheckersMock).toHaveBeenCalledWith(["en"], []);
        expect(
          result.current.spellcheckMatchesBySegment.get("segment-1")?.get(0)?.suggestions,
        ).toEqual(["Word"]);
      },
      { timeout: 1000 },
    );
  });

  it("resets matches when spellcheck is disabled", async () => {
    const segments = [
      {
        id: "segment-1",
        speaker: "SPEAKER_00",
        tags: [],
        start: 0,
        end: 1,
        text: "Test",
        words: [{ word: "Test", start: 0, end: 1 }],
      },
    ];

    const spellcheckLanguages = Array.from(baseSpellcheckLanguages);
    const spellcheckCustomDictionaries = Array.from(baseSpellcheckCustomDictionaries);
    const spellcheckIgnoreWords = Array.from(baseSpellcheckIgnoreWords);
    const lexiconEntries = Array.from(baseLexiconEntries);

    const { result, rerender } = renderHook((props: UseSpellcheckOptions) => useSpellcheck(props), {
      initialProps: {
        audioUrl: null,
        isWaveReady: true,
        spellcheckEnabled: true,
        spellcheckLanguages,
        spellcheckCustomEnabled: false,
        spellcheckCustomDictionaries,
        loadSpellcheckCustomDictionaries: loadSpellcheckCustomDictionariesMock,
        segments,
        spellcheckIgnoreWords,
        lexiconEntries,
      },
    });

    rerender({
      audioUrl: null,
      isWaveReady: true,
      spellcheckEnabled: false,
      spellcheckLanguages,
      spellcheckCustomEnabled: false,
      spellcheckCustomDictionaries,
      loadSpellcheckCustomDictionaries: loadSpellcheckCustomDictionariesMock,
      segments,
      spellcheckIgnoreWords,
      lexiconEntries,
    });

    await waitFor(
      () => {
        expect(result.current.spellcheckMatchesBySegment.size).toBe(0);
      },
      { timeout: 1000 },
    );
  });
});
