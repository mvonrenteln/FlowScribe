import { normalizeToken } from "@/lib/fuzzy";
import type { LexiconEntry, PersistedGlobalState } from "../types";

export const normalizeLexiconTerm = (value: string) => value.trim().toLowerCase();

/**
 * Build a normalized key for session-scoped lexicon ignores.
 *
 * Combines the lexicon term and matched value so we can skip fuzzy matches
 * without mutating the global glossary state.
 */
export const buildLexiconSessionIgnoreKey = (term: string, value: string): string | null => {
  const normalizedTerm = normalizeToken(term);
  const normalizedValue = normalizeToken(value);
  if (!normalizedTerm || !normalizedValue) return null;
  return `${normalizedTerm}::${normalizedValue}`;
};

/**
 * Normalize session-scoped lexicon ignore keys from persisted data.
 */
export const normalizeLexiconSessionIgnores = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
};

const normalizeLexiconVariants = (variants: string[]) => {
  const seen = new Set<string>();
  return variants
    .map((variant) => variant.trim())
    .filter((variant) => {
      const normalized = normalizeLexiconTerm(variant);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
};

export const normalizeLexiconEntry = (entry: LexiconEntry): LexiconEntry | null => {
  const term = entry.term.trim();
  if (!term) return null;
  return {
    term,
    variants: normalizeLexiconVariants(entry.variants ?? []),
    falsePositives: normalizeLexiconVariants(entry.falsePositives ?? []),
  };
};

export const normalizeLexiconEntriesFromGlobal = (state: PersistedGlobalState | null) => {
  if (!state) return [];
  if (Array.isArray(state.lexiconEntries)) {
    return state.lexiconEntries
      .filter((entry) => entry && typeof entry.term === "string")
      .map((entry) => ({
        term: String(entry.term),
        variants: Array.isArray(entry.variants) ? entry.variants.map(String).filter(Boolean) : [],
        falsePositives: Array.isArray(entry.falsePositives)
          ? entry.falsePositives.map(String).filter(Boolean)
          : [],
      }));
  }
  if (Array.isArray(state.lexiconTerms)) {
    return state.lexiconTerms
      .map((term) => (typeof term === "string" ? term : String(term ?? "")))
      .filter(Boolean)
      .map((term) => ({ term, variants: [], falsePositives: [] }));
  }
  return [];
};

export const uniqueEntries = (entries: LexiconEntry[]) => {
  const seen = new Map<string, LexiconEntry>();
  entries.forEach((entry) => {
    const normalized = normalizeLexiconEntry(entry);
    if (!normalized) return;
    const key = normalizeLexiconTerm(normalized.term);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, normalized);
      return;
    }
    const mergedVariants = normalizeLexiconVariants([...existing.variants, ...normalized.variants]);
    const mergedFalsePositives = normalizeLexiconVariants([
      ...existing.falsePositives,
      ...normalized.falsePositives,
    ]);
    seen.set(key, {
      term: existing.term,
      variants: mergedVariants,
      falsePositives: mergedFalsePositives,
    });
  });
  return Array.from(seen.values()).sort((a, b) =>
    a.term.localeCompare(b.term, undefined, { sensitivity: "base" }),
  );
};
