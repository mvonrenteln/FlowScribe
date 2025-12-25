import nspell from "nspell";

export type SpellcheckLanguage = "en" | "de";

export type Spellchecker = {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
};

type DictionarySource = {
  aff: string;
  dic: string;
};

const spellcheckerCache = new Map<SpellcheckLanguage, Spellchecker>();
const correctCache = new Map<string, boolean>();
const suggestionCache = new Map<string, string[]>();

const normalizeCacheKey = (languagesKey: string, token: string) =>
  `${languagesKey}::${token.toLowerCase()}`;

export const normalizeSpellcheckToken = (value: string) =>
  value.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

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
): Promise<Spellchecker[]> => {
  const unique = Array.from(new Set(languages));
  const checkers = await Promise.all(
    unique.map(async (language) => {
      const cached = spellcheckerCache.get(language);
      if (cached) return cached;
      const source = await loadDictionarySource(language);
      const checker = nspell(source.aff, source.dic) as Spellchecker;
      spellcheckerCache.set(language, checker);
      return checker;
    }),
  );
  return checkers;
};

export const getSpellcheckSuggestions = (
  word: string,
  checkers: Spellchecker[],
  languagesKey: string,
  ignoredWords: Set<string>,
): string[] | null => {
  if (!isSpellcheckableToken(word)) return null;
  const normalized = normalizeSpellcheckTerm(word);
  if (!normalized || ignoredWords.has(normalized)) return null;

  const cacheKey = normalizeCacheKey(languagesKey, normalized);
  const cachedCorrect = correctCache.get(cacheKey);
  if (cachedCorrect === true) return null;

  const isCorrect =
    cachedCorrect ??
    checkers.some((checker) => {
      try {
        return checker.correct(normalizeSpellcheckToken(word));
      } catch {
        return false;
      }
    });

  correctCache.set(cacheKey, isCorrect);
  if (isCorrect) return null;

  const cachedSuggestions = suggestionCache.get(cacheKey);
  if (cachedSuggestions) return cachedSuggestions;

  const suggestionSet = new Set<string>();
  checkers.forEach((checker) => {
    try {
      checker.suggest(word).forEach((suggestion) => {
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
