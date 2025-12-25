import nspell from "nspell";
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

type DictionarySource = {
  aff: string;
  dic: string;
};

const spellcheckerCache = new Map<string, Spellchecker>();
const correctCache = new Map<string, boolean>();
const suggestionCache = new Map<string, string[]>();

const normalizeCacheKey = (languagesKey: string, token: string) =>
  `${languagesKey}::${token.toLowerCase()}`;

export const normalizeSpellcheckToken = (value: string) =>
  value.replace(wordEdgeRegex, "");

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
          const extrasKey = customDictionaries.map((dictionary) => dictionary.id).sort().join("|");
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

  const cachedSuggestions = suggestionCache.get(cacheKey);
  if (cachedSuggestions) return cachedSuggestions;

  const suggestionSet = new Set<string>();
  checkers.forEach(({ checker }) => {
    try {
      checker.suggest(token).forEach((suggestion) => {
        const trimmed = suggestion.trim();
        if (!trimmed) return;
        suggestionSet.add(trimmed);
      });
    } catch {
      // ignore failed suggestion
    }
  });

  const suggestions = Array.from(suggestionSet).filter(
    (suggestion) => normalizeSpellcheckTerm(suggestion) !== normalized,
  );
  suggestionCache.set(cacheKey, suggestions);
  return suggestions;
};
