import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSpellcheck } from "../useSpellcheck";

const loadSpellcheckersMock = vi.fn().mockResolvedValue([]);
const getSpellcheckMatchMock = vi.fn();

vi.mock("@/lib/spellcheck", () => ({
  loadSpellcheckers: (...args: unknown[]) => loadSpellcheckersMock(...args),
  getSpellcheckMatch: (...args: unknown[]) => getSpellcheckMatchMock(...args),
  normalizeSpellcheckTerm: (value: string) => value.toLowerCase(),
}));

describe("useSpellcheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    loadSpellcheckersMock.mockClear();
    getSpellcheckMatchMock.mockReset();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("loads spellcheckers and collects matches", async () => {
    const segments = [
      {
        id: "segment-1",
        speaker: "SPEAKER_00",
        start: 0,
        end: 1,
        text: "Wrd",
        words: [{ word: "Wrd", start: 0, end: 1 }],
      },
    ];

    getSpellcheckMatchMock.mockReturnValue({ suggestions: ["Word"] });

    const { result } = renderHook(() =>
      useSpellcheck({
        audioUrl: null,
        isWaveReady: true,
        spellcheckEnabled: true,
        spellcheckLanguages: ["en"],
        spellcheckCustomEnabled: false,
        spellcheckCustomDictionaries: [],
        loadSpellcheckCustomDictionaries: vi.fn(),
        segments,
        spellcheckIgnoreWords: [],
        lexiconEntries: [],
      }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    await waitFor(() => {
      expect(loadSpellcheckersMock).toHaveBeenCalledWith(["en"], []);
      expect(
        result.current.spellcheckMatchesBySegment.get("segment-1")?.get(0)?.suggestions,
      ).toEqual(["Word"]);
    });
  });

  it("resets matches when spellcheck is disabled", async () => {
    const segments = [
      {
        id: "segment-1",
        speaker: "SPEAKER_00",
        start: 0,
        end: 1,
        text: "Test",
        words: [{ word: "Test", start: 0, end: 1 }],
      },
    ];

    const { result, rerender } = renderHook((props) => useSpellcheck(props), {
      initialProps: {
        audioUrl: null,
        isWaveReady: true,
        spellcheckEnabled: true,
        spellcheckLanguages: ["en"],
        spellcheckCustomEnabled: false,
        spellcheckCustomDictionaries: [],
        loadSpellcheckCustomDictionaries: vi.fn(),
        segments,
        spellcheckIgnoreWords: [],
        lexiconEntries: [],
      },
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    rerender({
      audioUrl: null,
      isWaveReady: true,
      spellcheckEnabled: false,
      spellcheckLanguages: ["en"],
      spellcheckCustomEnabled: false,
      spellcheckCustomDictionaries: [],
      loadSpellcheckCustomDictionaries: vi.fn(),
      segments,
      spellcheckIgnoreWords: [],
      lexiconEntries: [],
    });

    await waitFor(() => {
      expect(result.current.spellcheckMatchesBySegment.size).toBe(0);
    });
  });
});
