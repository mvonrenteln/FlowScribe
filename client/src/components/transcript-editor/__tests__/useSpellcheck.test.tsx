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

  it("preserves variant matches in cache-reuse path when word is also a false positive", async () => {
    // Regression: filterMatchesForSegment must not remove variant matches
    // via ignoredWordsSet when the cache-reuse path (canReuseForIgnoreChange)
    // is taken. This is consistent with useLexiconMatches.ts where explicit
    // variants always win over false-positive entries.
    const segment = {
      id: "segment-1",
      speaker: "SPEAKER_00",
      tags: [],
      start: 0,
      end: 1,
      text: "gar ist klar",
      words: [
        { word: "gar", start: 0, end: 0.3 },
        { word: "ist", start: 0.3, end: 0.6 },
        { word: "klar", start: 0.6, end: 1 },
      ],
    };
    const segments = [segment];

    loadSpellcheckersMock.mockResolvedValue([{}]);
    // The spellchecker is not consulted for variant words.
    getSpellcheckMatchMock.mockReturnValue(null);

    const spellcheckLanguages = Array.from(baseSpellcheckLanguages);
    const spellcheckCustomDictionaries = Array.from(baseSpellcheckCustomDictionaries);
    // Entry has "gar" as both variant AND false positive.
    const lexiconEntries = [
      {
        term: "Gor",
        variants: ["gar"],
        falsePositives: ["gar"],
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
        spellcheckIgnoreWords: [] as string[],
        lexiconEntries,
      },
    });

    // First run: variant match must be created
    await waitFor(
      () => {
        const segMatches = result.current.spellcheckMatchesBySegment.get("segment-1");
        expect(segMatches?.get(0)).toEqual({ suggestions: ["Gor"], isVariant: true });
      },
      { timeout: 1000 },
    );

    // Now ignore an unrelated word → triggers canReuseForIgnoreChange path
    getSpellcheckMatchMock.mockClear();
    rerender({
      spellcheckEnabled: true,
      spellcheckLanguages,
      spellcheckCustomEnabled: false,
      spellcheckCustomDictionaries,
      loadSpellcheckCustomDictionaries: loadSpellcheckCustomDictionariesMock,
      segments,
      spellcheckIgnoreWords: ["somethingelse"],
      lexiconEntries,
    });

    // The variant match for "gar" must survive the cache-reuse filter
    await waitFor(
      () => {
        const segMatches = result.current.spellcheckMatchesBySegment.get("segment-1");
        expect(segMatches?.get(0)).toEqual({ suggestions: ["Gor"], isVariant: true });
        // Spellchecker must not be called again (reuse path)
        expect(getSpellcheckMatchMock).not.toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
  });

  it("filters cached hyphen-part matches when ignored words expand", async () => {
    const segment = {
      id: "segment-1",
      speaker: "SPEAKER_00",
      tags: [],
      start: 0,
      end: 1,
      text: "Fahrtenlesen-Probe",
      words: [{ word: "Fahrtenlesen-Probe", start: 0, end: 1 }],
    };
    const segments = [segment];

    loadSpellcheckersMock.mockResolvedValue([{}]);
    getSpellcheckMatchMock.mockReturnValue({ suggestions: ["Proben"], partIndex: 1 });

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
          suggestions: ["Proben"],
          partIndex: 1,
        });
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
      segments,
      spellcheckIgnoreWords: ["probe"],
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

  it("invalidates cache when variant list changes for unchanged segments", async () => {
    // Regression: cacheKey must include variant information so that adding or
    // removing a variant forces recomputation even when segments are referentially
    // identical and term/falsePositives are unchanged.
    const segment = {
      id: "segment-1",
      speaker: "SPEAKER_00",
      tags: [],
      start: 0,
      end: 1,
      text: "Glimmer bleibt",
      words: [
        { word: "Glimmer", start: 0, end: 0.5 },
        { word: "bleibt", start: 0.5, end: 1 },
      ],
    };
    const segments = [segment];

    loadSpellcheckersMock.mockResolvedValue([{}]);
    getSpellcheckMatchMock.mockReturnValue(null);

    const spellcheckLanguages = Array.from(baseSpellcheckLanguages);
    const spellcheckCustomDictionaries = Array.from(baseSpellcheckCustomDictionaries);
    const spellcheckIgnoreWords = Array.from(baseSpellcheckIgnoreWords);

    // Initial: no variants → no matches
    const { result, rerender } = renderHook((props: UseSpellcheckOptions) => useSpellcheck(props), {
      initialProps: {
        spellcheckEnabled: true,
        spellcheckLanguages,
        spellcheckCustomEnabled: false,
        spellcheckCustomDictionaries,
        loadSpellcheckCustomDictionaries: loadSpellcheckCustomDictionariesMock,
        segments,
        spellcheckIgnoreWords,
        lexiconEntries: [{ term: "Glymbar", variants: [] as string[], falsePositives: [] }],
      },
    });

    await waitFor(
      () => {
        expect(result.current.spellcheckMatchesBySegment.size).toBe(0);
      },
      { timeout: 1000 },
    );

    // Now add "Glimmer" as variant — same segment reference, same term
    rerender({
      spellcheckEnabled: true,
      spellcheckLanguages,
      spellcheckCustomEnabled: false,
      spellcheckCustomDictionaries,
      loadSpellcheckCustomDictionaries: loadSpellcheckCustomDictionariesMock,
      segments,
      spellcheckIgnoreWords,
      lexiconEntries: [{ term: "Glymbar", variants: ["Glimmer"], falsePositives: [] }],
    });

    await waitFor(
      () => {
        const segMatches = result.current.spellcheckMatchesBySegment.get("segment-1");
        expect(segMatches?.get(0)).toEqual({ suggestions: ["Glymbar"], isVariant: true });
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
        expect(segMatches?.get(0)).toEqual({ suggestions: ["Glymbar"], isVariant: true });
        expect(segMatches?.get(1)).toEqual({ suggestions: ["Glymbar"], isVariant: true });
        expect(segMatches?.get(2)).toEqual({ suggestions: ["Glymbar"], isVariant: true });
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
        expect(segMatches?.get(0)).toEqual({ suggestions: ["Glymbar"], isVariant: true });
        expect(segMatches?.get(2)).toEqual({ suggestions: ["Glymbar"], isVariant: true });
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
        expect(segMatches?.get(0)).toEqual({
          suggestions: ["Zielbegriff"],
          isVariant: true,
          spanLength: 2,
        });
        // Index 1: second word of variant → suppressed (no independent match)
        expect(segMatches?.has(1)).toBe(false);
        // Index 2: normal word → spellchecker match
        expect(segMatches?.get(2)).toEqual({ suggestions: ["x"] });
      },
      { timeout: 1000 },
    );
  });

  it("enforces match limit for multi-word variant phrases", async () => {
    // Regression: the multi-word variant pre-pass must check SPELLCHECK_MATCH_LIMIT
    // and set spellcheckMatchLimitReached when the limit is exceeded, preventing
    // unbounded match maps from multi-word variants.

    // Create enough segments with multi-word variants to exceed the limit (1000)
    const SPELLCHECK_MATCH_LIMIT = 1000;
    const segmentCount = Math.floor(SPELLCHECK_MATCH_LIMIT / 2) + 10; // 510 segments
    const segments = Array.from({ length: segmentCount }, (_, i) => ({
      id: `segment-${i}`,
      speaker: "SPEAKER_00",
      tags: [],
      start: i,
      end: i + 1,
      text: "Neue Wortform andere Phrase",
      words: [
        { word: "Neue", start: i, end: i + 0.25 },
        { word: "Wortform", start: i + 0.25, end: i + 0.5 },
        { word: "andere", start: i + 0.5, end: i + 0.75 },
        { word: "Phrase", start: i + 0.75, end: i + 1 },
      ],
    }));

    loadSpellcheckersMock.mockResolvedValue([{}]);
    getSpellcheckMatchMock.mockReturnValue(null);

    const spellcheckLanguages = Array.from(baseSpellcheckLanguages);
    const spellcheckCustomDictionaries = Array.from(baseSpellcheckCustomDictionaries);
    const spellcheckIgnoreWords = Array.from(baseSpellcheckIgnoreWords);
    // Two multi-word variants per segment → 1020 total matches
    const lexiconEntries = [
      { term: "Term1", variants: ["Neue Wortform"], falsePositives: [] },
      { term: "Term2", variants: ["andere Phrase"], falsePositives: [] },
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
        // Limit must be enforced
        expect(result.current.spellcheckMatchLimitReached).toBe(true);
        expect(result.current.spellcheckMatchCount).toBe(SPELLCHECK_MATCH_LIMIT);
      },
      { timeout: 3000 },
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
