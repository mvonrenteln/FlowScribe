import nspell from "nspell";
import { levenshteinDistance } from "@/lib/fuzzy";
import type { SpellcheckCustomDictionary } from "@/lib/store";
import { wordEdgeRegex } from "@/lib/wordBoundaries";

export type SpellcheckLanguage = "en" | "de";

export type Spellchecker = {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
};

export type LoadedSpellchecker = {
  language: SpellcheckLanguage | "custom";
  checker: Spellchecker;
};

export type SpellcheckMatch = {
  suggestions: string[];
  partIndex?: number;
};

type DictionarySource = {
  aff: string;
  dic: string;
};

const spellcheckerCache = new Map<string, Spellchecker>();
const correctCache = new Map<string, boolean>();
const suggestionCache = new Map<string, string[]>();

const normalizeCacheKey = (languagesKey: string, token: string) =>
  `${languagesKey}::${token.toLowerCase()}`;

export const normalizeSpellcheckToken = (value: string) => value.replace(wordEdgeRegex, "");

export const normalizeSpellcheckTerm = (value: string) =>
  normalizeSpellcheckToken(value).toLowerCase();

export const isSpellcheckableToken = (value: string) => {
  const trimmed = normalizeSpellcheckToken(value);
  if (!trimmed) return false;
  if (trimmed.length < 2) return false;
  if (/\d/.test(trimmed)) return false;
  return true;
};

const loadDictionarySource = async (language: SpellcheckLanguage): Promise<DictionarySource> => {
  const basePath = language === "de" ? "/dictionaries/de" : "/dictionaries/en";
  const [affResponse, dicResponse] = await Promise.all([
    fetch(`${basePath}.aff`),
    fetch(`${basePath}.dic`),
  ]);
  if (!affResponse.ok || !dicResponse.ok) {
    throw new Error(`Failed to load ${language} spellcheck dictionary`);
  }
  const [aff, dic] = await Promise.all([affResponse.text(), dicResponse.text()]);
  return { aff, dic };
};

export const loadSpellcheckers = async (
  languages: SpellcheckLanguage[],
  customDictionaries: SpellcheckCustomDictionary[],
): Promise<LoadedSpellchecker[]> => {
  const unique = Array.from(new Set(languages));
  const useCustomOnly = unique.length === 0;
  const customChecker =
    !useCustomOnly || customDictionaries.length === 0
      ? null
      : (() => {
          const extrasKey = customDictionaries
            .map((dictionary) => dictionary.id)
            .sort()
            .join("|");
          const cacheKey = `custom:${extrasKey}`;
          const cached = spellcheckerCache.get(cacheKey);
          if (cached) return cached;
          const checker = nspell(
            customDictionaries.map((dictionary) => ({
              aff: dictionary.aff,
              dic: dictionary.dic,
            })),
          ) as Spellchecker;
          spellcheckerCache.set(cacheKey, checker);
          return checker;
        })();

  if (useCustomOnly) {
    if (!customChecker) return [];
    return [{ checker: customChecker, language: "custom" }];
  }

  const baseCheckers = await Promise.all(
    unique.map(async (language) => {
      const cacheKey = `base:${language}`;
      const cached = spellcheckerCache.get(cacheKey);
      if (cached) {
        return { checker: cached, language };
      }
      const source = await loadDictionarySource(language);
      const checker = nspell(source.aff, source.dic) as Spellchecker;
      spellcheckerCache.set(cacheKey, checker);
      return { checker, language };
    }),
  );

  return baseCheckers;
};

const capitalizeToken = (value: string) =>
  value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;

const isGermanLowercase = (value: string) =>
  value === value.toLowerCase() && value !== value.toUpperCase();

const isCorrectForLanguage = (
  checker: Spellchecker,
  language: SpellcheckLanguage | "custom",
  token: string,
) => {
  if (checker.correct(token)) return true;
  if ((language === "de" || language === "custom") && isGermanLowercase(token)) {
    const capitalized = capitalizeToken(token);
    if (capitalized !== token && checker.correct(capitalized)) return true;
  }
  return false;
};

const maxIgnoreDistanceForToken = (normalizedToken: string) => (normalizedToken.length < 5 ? 1 : 2);

/**
 * Build ignore-based suggestion candidates for unknown spellcheck tokens.
 * The ignore list itself does not create standalone matches; it only augments
 * suggestion output after the spellchecker marked a token as unknown.
 */
const getIgnoreSuggestions = (normalizedToken: string, ignoredWords: Set<string>) => {
  if (!normalizedToken) return [];
  const maxDistance = maxIgnoreDistanceForToken(normalizedToken);
  const candidates: Array<{ value: string; distance: number }> = [];

  ignoredWords.forEach((ignoredWord) => {
    const normalizedIgnored = normalizeSpellcheckTerm(ignoredWord);
    if (!normalizedIgnored || normalizedIgnored === normalizedToken) return;
    if (Math.abs(normalizedIgnored.length - normalizedToken.length) > maxDistance) return;
    const distance = levenshteinDistance(normalizedToken, normalizedIgnored);
    if (distance <= maxDistance) {
      candidates.push({ value: ignoredWord, distance });
    }
  });

  candidates.sort((left, right) => {
    if (left.distance !== right.distance) return left.distance - right.distance;
    return left.value.localeCompare(right.value);
  });

  return candidates.map((candidate) => candidate.value);
};

/**
 * Merge ignore-based and dictionary-based suggestions while preserving
 * source priority and removing normalized duplicates.
 */
const mergeSuggestions = (
  normalizedToken: string,
  ignoreSuggestions: string[],
  checkerSuggestions: string[],
) => {
  const merged: string[] = [];
  const seen = new Set<string>();
  const addSuggestion = (suggestion: string) => {
    const trimmed = suggestion.trim();
    if (!trimmed) return;
    const normalizedSuggestion = normalizeSpellcheckTerm(trimmed);
    if (!normalizedSuggestion || normalizedSuggestion === normalizedToken) return;
    if (seen.has(normalizedSuggestion)) return;
    seen.add(normalizedSuggestion);
    merged.push(trimmed);
  };

  ignoreSuggestions.forEach(addSuggestion);
  checkerSuggestions.forEach(addSuggestion);
  return merged;
};

export const getSpellcheckSuggestions = (
  word: string,
  checkers: LoadedSpellchecker[],
  languagesKey: string,
  ignoredWords: Set<string>,
): string[] | null => {
  if (!isSpellcheckableToken(word)) return null;
  const normalized = normalizeSpellcheckTerm(word);
  if (!normalized || ignoredWords.has(normalized)) return null;

  const token = normalizeSpellcheckToken(word);
  const cacheKey = normalizeCacheKey(languagesKey, normalized);
  const cachedCorrect = correctCache.get(cacheKey);
  if (cachedCorrect === true) return null;

  const isCorrect =
    cachedCorrect ??
    checkers.some(({ checker, language }) => {
      try {
        return isCorrectForLanguage(checker, language, token);
      } catch {
        return false;
      }
    });

  correctCache.set(cacheKey, isCorrect);
  if (isCorrect) return null;

  // Only dictionary/checker suggestions are cached. Ignore-based fuzzy candidates
  // depend on the ignoredWords set (call-specific) and must always be computed
  // fresh so that newly-added ignore words immediately appear as suggestions for
  // existing unknown tokens.
  const cachedCheckerSuggestions = suggestionCache.get(cacheKey);
  const checkerSuggestions: string[] = cachedCheckerSuggestions ?? [];
  if (!cachedCheckerSuggestions) {
    checkers.forEach(({ checker }) => {
      try {
        checker.suggest(token).forEach((suggestion) => {
          const trimmed = suggestion.trim();
          if (!trimmed) return;
          checkerSuggestions.push(trimmed);
        });
      } catch {
        // ignore failed suggestion
      }
    });
    suggestionCache.set(cacheKey, checkerSuggestions);
  }

  const ignoreSuggestions = getIgnoreSuggestions(normalized, ignoredWords);
  return mergeSuggestions(normalized, ignoreSuggestions, checkerSuggestions);
};

export const getSpellcheckMatch = (
  word: string,
  checkers: LoadedSpellchecker[],
  languagesKey: string,
  ignoredWords: Set<string>,
): SpellcheckMatch | null => {
  const token = normalizeSpellcheckToken(word);
  if (!token) return null;
  if (!token.includes("-")) {
    const suggestions = getSpellcheckSuggestions(word, checkers, languagesKey, ignoredWords);
    return suggestions ? { suggestions } : null;
  }

  const parts = token.split("-");
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part) continue;
    const suggestions = getSpellcheckSuggestions(part, checkers, languagesKey, ignoredWords);
    if (suggestions) {
      return { suggestions, partIndex: index };
    }
  }

  return null;
};
