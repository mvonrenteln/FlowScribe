import type { LexiconEntry, PersistedGlobalState } from "../types";

export const normalizeLexiconTerm = (value: string) => value.trim().toLowerCase();

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
  return Array.from(seen.values());
};
