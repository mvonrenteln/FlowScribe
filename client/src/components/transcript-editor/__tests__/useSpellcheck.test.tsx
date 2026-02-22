import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type UseSpellcheckOptions, useSpellcheck } from "../useSpellcheck";

const loadSpellcheckersMock = vi.fn().mockResolvedValue([]);
const getSpellcheckMatchMock = vi.fn();
const baseSpellcheckLanguages = ["en"] as const;
const baseSpellcheckCustomDictionaries = [] as const;
const baseSpellcheckIgnoreWords: string[] = [];
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

  it("skips confirmed segments when collecting matches", async () => {
    const segments = [
      {
        id: "segment-1",
        speaker: "SPEAKER_00",
        start: 0,
        end: 1,
        text: "Wrd",
        words: [{ word: "Wrd", start: 0, end: 1 }],
        confirmed: true,
      },
      {
        id: "segment-2",
        speaker: "SPEAKER_00",
        start: 1,
        end: 2,
        text: "Wrd",
        words: [{ word: "Wrd", start: 1, end: 2 }],
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
        expect(result.current.spellcheckMatchesBySegment.has("segment-1")).toBe(false);
        expect(result.current.spellcheckMatchesBySegment.get("segment-2")?.get(0)).toEqual({
          suggestions: ["Word"],
        });
      },
      { timeout: 1000 },
    );
  });

  it("reuses matches for unchanged segments", async () => {
    const segmentA = {
      id: "segment-1",
      speaker: "SPEAKER_00",
      tags: [],
      start: 0,
      end: 1,
      text: "Wrd",
      words: [{ word: "Wrd", start: 0, end: 1 }],
    };
    const segmentB = {
      id: "segment-2",
      speaker: "SPEAKER_00",
      tags: [],
      start: 1,
      end: 2,
      text: "Wrd",
      words: [{ word: "Wrd", start: 1, end: 2 }],
    };
    const segments = [segmentA, segmentB];

    loadSpellcheckersMock.mockResolvedValue([{}]);
    getSpellcheckMatchMock.mockReturnValue({ suggestions: ["Word"] });

    const spellcheckLanguages = Array.from(baseSpellcheckLanguages);
    const spellcheckCustomDictionaries = Array.from(baseSpellcheckCustomDictionaries);
    const spellcheckIgnoreWords = Array.from(baseSpellcheckIgnoreWords);
    const lexiconEntries = Array.from(baseLexiconEntries);

    const { result, rerender } = renderHook((props: UseSpellcheckOptions) => useSpellcheck(props), {
      initialProps: {
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

    await waitFor(
      () => {
        expect(result.current.spellcheckMatchesBySegment.size).toBe(2);
      },
      { timeout: 1000 },
    );

    getSpellcheckMatchMock.mockClear();
    rerender({
      spellcheckEnabled: true,
      spellcheckLanguages,
      spellcheckCustomEnabled: false,
      spellcheckCustomDictionaries,
      loadSpellcheckCustomDictionaries: loadSpellcheckCustomDictionariesMock,
      segments: [segmentA, segmentB],
      spellcheckIgnoreWords,
      lexiconEntries,
    });

    await waitFor(
      () => {
        expect(result.current.spellcheckMatchesBySegment.size).toBe(2);
        expect(getSpellcheckMatchMock).not.toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
  });

  it("filters cached matches when ignored words expand", async () => {
    const segment = {
      id: "segment-1",
      speaker: "SPEAKER_00",
      tags: [],
      start: 0,
      end: 1,
      text: "Wrd",
      words: [{ word: "Wrd", start: 0, end: 1 }],
    };
    const segments = [segment];

    loadSpellcheckersMock.mockResolvedValue([{}]);
    getSpellcheckMatchMock.mockReturnValue({ suggestions: ["Word"] });

    const spellcheckLanguages = Array.from(baseSpellcheckLanguages);
    const spellcheckCustomDictionaries = Array.from(baseSpellcheckCustomDictionaries);
    const lexiconEntries = Array.from(baseLexiconEntries);
    const initialIgnoreWords = Array.from(baseSpellcheckIgnoreWords);

    const { result, rerender } = renderHook((props: UseSpellcheckOptions) => useSpellcheck(props), {
      initialProps: {
        spellcheckEnabled: true,
        spellcheckLanguages,
        spellcheckCustomEnabled: false,
        spellcheckCustomDictionaries,
        loadSpellcheckCustomDictionaries: loadSpellcheckCustomDictionariesMock,
        segments,
        spellcheckIgnoreWords: initialIgnoreWords,
        lexiconEntries,
      },
    });

    await waitFor(
      () => {
        expect(result.current.spellcheckMatchesBySegment.get("segment-1")?.get(0)).toEqual({
          suggestions: ["Word"],
        });
      },
      { timeout: 1000 },
    );

    getSpellcheckMatchMock.mockClear();
    const updatedIgnoreWords = ["wrd"] as string[];
    rerender({
      spellcheckEnabled: true,
      spellcheckLanguages,
      spellcheckCustomEnabled: false,
      spellcheckCustomDictionaries,
      loadSpellcheckCustomDictionaries: loadSpellcheckCustomDictionariesMock,
      segments,
      spellcheckIgnoreWords: updatedIgnoreWords,
      lexiconEntries,
    });

    await waitFor(
      () => {
        expect(result.current.spellcheckMatchesBySegment.size).toBe(0);
        expect(getSpellcheckMatchMock).not.toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
  });

  it("flags single-word lexicon variants with the canonical term as suggestion", async () => {
    const segment = {
      id: "segment-1",
      speaker: "SPEAKER_00",
      tags: [],
      start: 0,
      end: 1,
      text: "Glimmer Klimper Dumba",
      words: [
        { word: "Glimmer", start: 0, end: 0.3 },
        { word: "Klimper", start: 0.3, end: 0.6 },
        { word: "Dumba", start: 0.6, end: 1 },
      ],
    };
    const segments = [segment];

    loadSpellcheckersMock.mockResolvedValue([{}]);
    // The spellchecker mock should NOT be consulted for variant words;
    // direct lookup must produce the suggestion independently.
    getSpellcheckMatchMock.mockReturnValue(null);

    const spellcheckLanguages = Array.from(baseSpellcheckLanguages);
    const spellcheckCustomDictionaries = Array.from(baseSpellcheckCustomDictionaries);
    const spellcheckIgnoreWords = Array.from(baseSpellcheckIgnoreWords);
    const lexiconEntries = [
      {
        term: "Glymbar",
        variants: ["Glimmer", "Klimper", "Dumba"],
        falsePositives: [],
      },
    ];

    const { result, rerender } = renderHook((props: UseSpellcheckOptions) => useSpellcheck(props), {
      initialProps: {
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

    // All three variant words should be flagged with the canonical term as suggestion
    await waitFor(
      () => {
        const segMatches = result.current.spellcheckMatchesBySegment.get("segment-1");
        expect(segMatches?.get(0)).toEqual({ suggestions: ["Glymbar"] });
        expect(segMatches?.get(1)).toEqual({ suggestions: ["Glymbar"] });
        expect(segMatches?.get(2)).toEqual({ suggestions: ["Glymbar"] });
      },
      { timeout: 1000 },
    );

    // Variants must be detected via direct lookup – spellchecker should not be
    // the source for these matches
    expect(getSpellcheckMatchMock).not.toHaveBeenCalled();

    getSpellcheckMatchMock.mockClear();
    rerender({
      spellcheckEnabled: true,
      spellcheckLanguages,
      spellcheckCustomEnabled: false,
      spellcheckCustomDictionaries,
      loadSpellcheckCustomDictionaries: loadSpellcheckCustomDictionariesMock,
      segments,
      spellcheckIgnoreWords,
      lexiconEntries,
    });

    // After rerender with same props, matches should be stable and spellchecker
    // should still not be called (cached).
    await waitFor(
      () => {
        const segMatches = result.current.spellcheckMatchesBySegment.get("segment-1");
        expect(segMatches?.get(0)).toEqual({ suggestions: ["Glymbar"] });
        expect(segMatches?.get(2)).toEqual({ suggestions: ["Glymbar"] });
        expect(getSpellcheckMatchMock).not.toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
  });

  it("flags two-word lexicon variants with the canonical term as suggestion", async () => {
    const segment = {
      id: "segment-1",
      speaker: "SPEAKER_00",
      tags: [],
      start: 0,
      end: 1,
      text: "Neue Wortform bleibt",
      words: [
        { word: "Neue", start: 0, end: 0.3 },
        { word: "Wortform", start: 0.3, end: 0.6 },
        { word: "bleibt", start: 0.6, end: 1 },
      ],
    };
    const segments = [segment];

    loadSpellcheckersMock.mockResolvedValue([{}]);
    // The spellchecker mock returns a match for "bleibt" (index 2) but
    // must NOT be consulted for the multi-word variant (indices 0+1).
    getSpellcheckMatchMock.mockReturnValue({ suggestions: ["x"] });

    const spellcheckLanguages = Array.from(baseSpellcheckLanguages);
    const spellcheckCustomDictionaries = Array.from(baseSpellcheckCustomDictionaries);
    const spellcheckIgnoreWords = Array.from(baseSpellcheckIgnoreWords);
    const lexiconEntries = [
      {
        term: "Zielbegriff",
        variants: ["Neue Wortform"],
        falsePositives: [],
      },
    ];

    const { result } = renderHook((props: UseSpellcheckOptions) => useSpellcheck(props), {
      initialProps: {
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

    await waitFor(
      () => {
        const segMatches = result.current.spellcheckMatchesBySegment.get("segment-1");
        // Index 0: first word of variant → carries suggestion for the full variant
        expect(segMatches?.get(0)).toEqual({ suggestions: ["Zielbegriff"] });
        // Index 1: second word of variant → suppressed (no independent match)
        expect(segMatches?.has(1)).toBe(false);
        // Index 2: normal word → spellchecker match
        expect(segMatches?.get(2)).toEqual({ suggestions: ["x"] });
      },
      { timeout: 1000 },
    );
  });
  it("recomputes matches if a previous run was interrupted", async () => {
    const originalRequestIdle = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (cb: () => void) => number;
      }
    ).requestIdleCallback;
    (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (cb: () => void) => number;
      }
    ).requestIdleCallback = (cb) => {
      cb({ timeRemaining: () => 50 } as IdleDeadline);
      return 0;
    };
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

    const { rerender } = renderHook((props: UseSpellcheckOptions) => useSpellcheck(props), {
      initialProps: {
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
      spellcheckEnabled: true,
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
        expect(getSpellcheckMatchMock).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );

    (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (cb: () => void) => number;
      }
    ).requestIdleCallback = originalRequestIdle;
  });
});
