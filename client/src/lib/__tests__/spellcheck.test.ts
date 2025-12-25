import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSpellcheckSuggestions, loadSpellcheckers, type LoadedSpellchecker } from "@/lib/spellcheck";
import type { SpellcheckCustomDictionary } from "@/lib/store";

const makeChecker = (
  language: LoadedSpellchecker["language"],
  correct: (word: string) => boolean,
  suggest: (word: string) => string[] = () => [],
): LoadedSpellchecker => ({
  language,
  checker: {
    correct,
    suggest,
  },
});

const baseAff = "SET UTF-8\n";
const baseDeDic = "1\nbasis\n";
const baseEnDic = "1\nsimple\n";

const makeCustomDictionary = (id: string, word: string): SpellcheckCustomDictionary => ({
  id,
  name: `Custom ${id}`,
  aff: baseAff,
  dic: `1\n${word}\n`,
});

const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input.toString();
  const isDe = url.includes("/dictionaries/de");
  const isAff = url.endsWith(".aff");
  const text = isAff ? baseAff : isDe ? baseDeDic : baseEnDic;
  return {
    ok: true,
    text: async () => text,
  };
});

describe("getSpellcheckSuggestions", () => {
  it("treats German lowercase words as correct when the capitalized form exists", () => {
    const checkers = [
      makeChecker("de", (word) => word === "Erkennen"),
    ];
    const result = getSpellcheckSuggestions("erkennen", checkers, "de|custom:off|", new Set());
    expect(result).toBeNull();
  });

  it("does not apply capitalization fallback for non-German dictionaries", () => {
    const checkers = [
      makeChecker("en", (word) => word === "March", () => ["marches"]),
    ];
    const result = getSpellcheckSuggestions("march", checkers, "en|custom:off|", new Set());
    expect(result).toEqual(["marches"]);
  });

  it("returns null for short tokens or tokens with digits", () => {
    const checkers = [makeChecker("de", () => false, () => ["alpha"])];
    expect(getSpellcheckSuggestions("a", checkers, "short", new Set())).toBeNull();
    expect(getSpellcheckSuggestions("42", checkers, "digits", new Set())).toBeNull();
  });

  it("skips tokens that are explicitly ignored", () => {
    const checkers = [makeChecker("de", () => false, () => ["alpha"])];
    const ignored = new Set(["skip"]);
    expect(getSpellcheckSuggestions("skip", checkers, "ignored", ignored)).toBeNull();
  });

  it("handles checker errors and trims duplicate suggestions", () => {
    const checkers = [
      makeChecker("de", () => {
        throw new Error("boom");
      }, () => [" alpha ", ""]),
      makeChecker("de", () => false, () => ["alpha", "beta "]),
    ];
    const result = getSpellcheckSuggestions("alfa", checkers, "errors", new Set());
    expect(result).toEqual(["alpha", "beta"]);
  });

  it("reuses cached suggestions for the same language key", () => {
    const suggest = vi.fn(() => ["alpha"]);
    const checkers = [makeChecker("de", () => false, suggest)];
    const first = getSpellcheckSuggestions("alfa", checkers, "cache-test", new Set());
    const second = getSpellcheckSuggestions("alfa", checkers, "cache-test", new Set());
    expect(first).toEqual(["alpha"]);
    expect(second).toEqual(["alpha"]);
    expect(suggest).toHaveBeenCalledTimes(1);
  });
});

describe("loadSpellcheckers", () => {
  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads custom dictionaries when no languages are selected", async () => {
    const custom = makeCustomDictionary("custom-only", "glymbar");
    const checkers = await loadSpellcheckers([], [custom]);
    expect(checkers).toHaveLength(1);
    expect(checkers[0].language).toBe("custom");
    expect(checkers[0].checker.correct("glymbar")).toBe(true);
  });

  it("ignores custom dictionaries when a base language is selected", async () => {
    const custom = makeCustomDictionary("custom-ignored", "glymbar");
    const checkers = await loadSpellcheckers(["de"], [custom]);
    expect(checkers).toHaveLength(1);
    expect(checkers[0].language).toBe("de");
    expect(checkers[0].checker.correct("basis")).toBe(true);
    expect(checkers[0].checker.correct("glymbar")).toBe(false);
  });

  it("returns an empty list when no language or custom dictionary is provided", async () => {
    const checkers = await loadSpellcheckers([], []);
    expect(checkers).toEqual([]);
  });

  it("loads the EN base dictionary when EN is selected", async () => {
    const checkers = await loadSpellcheckers(["en"], []);
    expect(checkers).toHaveLength(1);
    expect(checkers[0].language).toBe("en");
    expect(checkers[0].checker.correct("simple")).toBe(true);
    expect(checkers[0].checker.correct("basis")).toBe(false);
  });

  it("reuses cached base dictionaries across calls", async () => {
    await loadSpellcheckers(["de"], []);
    const callCount = fetchMock.mock.calls.length;
    await loadSpellcheckers(["de"], []);
    expect(fetchMock.mock.calls.length).toBe(callCount);
  });

  it("throws when dictionary fetch fails", async () => {
    vi.resetModules();
    const { loadSpellcheckers: freshLoadSpellcheckers } = await import("@/lib/spellcheck");
    fetchMock.mockResolvedValueOnce({ ok: false, text: async () => "" });
    fetchMock.mockResolvedValueOnce({ ok: false, text: async () => "" });

    await expect(freshLoadSpellcheckers(["de"], [])).rejects.toThrow(
      "Failed to load de spellcheck dictionary",
    );
  });
});
