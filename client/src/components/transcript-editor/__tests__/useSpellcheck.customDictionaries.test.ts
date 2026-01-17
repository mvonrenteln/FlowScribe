/**
 * Tests for Custom Dictionaries behavior in useSpellcheck
 *
 * These tests ensure that:
 * 1. When spellcheckCustomEnabled is true, built-in languages are NOT used
 * 2. When spellcheckCustomEnabled is false, built-in languages ARE used
 * 3. Custom dictionaries replace (not supplement) built-in languages
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSpellcheck } from "../useSpellcheck";

// Mock the spellcheck module
vi.mock("@/lib/spellcheck", () => ({
  loadSpellcheckers: vi.fn().mockResolvedValue([]),
  getSpellcheckMatch: vi.fn().mockReturnValue(null),
  normalizeSpellcheckTerm: vi.fn((term: string) => term.toLowerCase()),
}));

describe("useSpellcheck - Custom Dictionaries", () => {
  const baseOptions = {
    spellcheckEnabled: true,
    spellcheckLanguages: ["de", "en"] as ("de" | "en")[],
    spellcheckCustomEnabled: false,
    spellcheckCustomDictionaries: [],
    loadSpellcheckCustomDictionaries: vi.fn().mockResolvedValue(undefined),
    segments: [],
    spellcheckIgnoreWords: [],
    lexiconEntries: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("effectiveSpellcheckLanguages", () => {
    it("should return built-in languages when custom dictionaries are disabled", () => {
      const { result } = renderHook(() =>
        useSpellcheck({
          ...baseOptions,
          spellcheckCustomEnabled: false,
          spellcheckLanguages: ["de", "en"],
        }),
      );

      expect(result.current.effectiveSpellcheckLanguages).toEqual(["de", "en"]);
    });

    it("should return empty array when custom dictionaries are enabled", () => {
      const { result } = renderHook(() =>
        useSpellcheck({
          ...baseOptions,
          spellcheckCustomEnabled: true,
          spellcheckLanguages: ["de", "en"],
        }),
      );

      expect(result.current.effectiveSpellcheckLanguages).toEqual([]);
    });

    it("should return empty array when custom is enabled even with multiple languages selected", () => {
      const { result } = renderHook(() =>
        useSpellcheck({
          ...baseOptions,
          spellcheckCustomEnabled: true,
          spellcheckLanguages: ["de", "en"],
        }),
      );

      // This is the critical test: even though de and en are selected,
      // effectiveSpellcheckLanguages should be empty when custom is enabled
      expect(result.current.effectiveSpellcheckLanguages).toHaveLength(0);
    });

    it("should switch from languages to empty when toggling custom on", () => {
      const { result, rerender } = renderHook((props) => useSpellcheck(props), {
        initialProps: {
          ...baseOptions,
          spellcheckCustomEnabled: false,
          spellcheckLanguages: ["de"] as ("de" | "en")[],
        },
      });

      // Initially should have the language
      expect(result.current.effectiveSpellcheckLanguages).toEqual(["de"]);

      // Toggle custom on
      rerender({
        ...baseOptions,
        spellcheckCustomEnabled: true,
        spellcheckLanguages: ["de"],
      });

      // Now should be empty (custom replaces built-in)
      expect(result.current.effectiveSpellcheckLanguages).toEqual([]);
    });

    it("should switch from empty to languages when toggling custom off", () => {
      const { result, rerender } = renderHook((props) => useSpellcheck(props), {
        initialProps: {
          ...baseOptions,
          spellcheckCustomEnabled: true,
          spellcheckLanguages: ["en"] as ("de" | "en")[],
        },
      });

      // Initially should be empty (custom enabled)
      expect(result.current.effectiveSpellcheckLanguages).toEqual([]);

      // Toggle custom off
      rerender({
        ...baseOptions,
        spellcheckCustomEnabled: false,
        spellcheckLanguages: ["en"],
      });

      // Now should have the language back
      expect(result.current.effectiveSpellcheckLanguages).toEqual(["en"]);
    });
  });

  describe("Custom dictionaries replace built-in behavior", () => {
    it("should not include built-in languages in effective list when custom is on", () => {
      const customDict = {
        id: "custom-1",
        name: "My Dictionary",
        aff: "SET UTF-8",
        dic: "1\nword",
      };

      const { result } = renderHook(() =>
        useSpellcheck({
          ...baseOptions,
          spellcheckCustomEnabled: true,
          spellcheckLanguages: ["de", "en"],
          spellcheckCustomDictionaries: [customDict],
        }),
      );

      // Built-in languages should be completely replaced
      expect(result.current.effectiveSpellcheckLanguages).toEqual([]);
      expect(result.current.effectiveSpellcheckLanguages).not.toContain("de");
      expect(result.current.effectiveSpellcheckLanguages).not.toContain("en");
    });
  });
});
