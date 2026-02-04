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
