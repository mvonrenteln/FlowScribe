import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLogger } from "@/lib/logging";
import { getSpellcheckMatch, loadSpellcheckers, normalizeSpellcheckTerm } from "@/lib/spellcheck";
import type {
  LexiconEntry,
  Segment,
  SpellcheckCustomDictionary,
  SpellcheckLanguage,
} from "@/lib/store";

const logger = createLogger({ feature: "Spellcheck", namespace: "UI" });

export interface SpellcheckMatchMeta {
  suggestions: string[];
  partIndex?: number;
  /** When true, this match originated from an explicit lexicon variant lookup
   *  and must not be filtered by the ignored-words / false-positive set. */
  isVariant?: boolean;
}

export interface UseSpellcheckOptions {
  spellcheckEnabled: boolean;
  spellcheckLanguages: SpellcheckLanguage[];
  spellcheckCustomEnabled: boolean;
  spellcheckCustomDictionaries: SpellcheckCustomDictionary[];
  loadSpellcheckCustomDictionaries: () => Promise<void>;
  segments: Segment[];
  spellcheckIgnoreWords: string[];
  lexiconEntries: LexiconEntry[];
}

const tokenizeLexiconPhrase = (value: string) =>
  value
    .split(/\s+/)
    .map((token) => normalizeSpellcheckTerm(token))
    .filter(Boolean);

const buildIgnoredLexiconPhrases = (lexiconEntries: LexiconEntry[]) => {
  const phrases: string[][] = [];
  lexiconEntries.forEach((entry) => {
    // Only the canonical term itself is suppressed (no spellcheck marker).
    // Multi-word variants are handled separately as matches, not suppressions.
    const tokens = tokenizeLexiconPhrase(entry.term);
    if (tokens.length > 1) {
      phrases.push(tokens);
    }
  });

  return Array.from(new Map(phrases.map((tokens) => [tokens.join(" "), tokens])).values()).sort(
    (left, right) => right.length - left.length,
  );
};

/** Entry for a multi-word variant: the token sequence plus the canonical term to suggest. */
type MultiWordVariantEntry = { tokens: string[]; term: string };

/**
 * Build an ordered list of multi-word variant sequences together with their
 * canonical glossary term.  Longer sequences are sorted first so that the
 * most specific match wins.
 */
const buildMultiWordVariantPhrases = (lexiconEntries: LexiconEntry[]): MultiWordVariantEntry[] => {
  const map = new Map<string, MultiWordVariantEntry>();
  lexiconEntries.forEach((entry) => {
    const term = entry.term.trim();
    if (!term) return;
    (entry.variants ?? []).forEach((variant) => {
      const tokens = tokenizeLexiconPhrase(variant);
      if (tokens.length > 1) {
        const key = tokens.join(" ");
        if (!map.has(key)) {
          map.set(key, { tokens, term });
        }
      }
    });
  });
  return Array.from(map.values()).sort((a, b) => b.tokens.length - a.tokens.length);
};

/**
 * Scan a segment for multi-word variant sequences and return a map of
 * wordIndex → SpellcheckMatchMeta for the first word of each matched sequence.
 * Remaining words of the sequence are added to `ignoredIndexes` so they are
 * not independently flagged.
 *
 * @param ignoredIndexes - Mutated in place: word indices for the non-first
 *   words of each matched sequence are added so the caller's main loop skips them.
 */
const findMultiWordVariantMatches = (
  segment: Segment,
  multiWordVariantPhrases: MultiWordVariantEntry[],
  ignoredIndexes: Set<number>,
): Map<number, SpellcheckMatchMeta> => {
  const result = new Map<number, SpellcheckMatchMeta>();
  if (multiWordVariantPhrases.length === 0 || segment.words.length === 0) return result;
  const normalizedWords = segment.words.map((w) => normalizeSpellcheckTerm(w.word));

  for (let wordIndex = 0; wordIndex < normalizedWords.length; wordIndex += 1) {
    for (const { tokens, term } of multiWordVariantPhrases) {
      if (wordIndex + tokens.length > normalizedWords.length) continue;
      if (normalizedWords[wordIndex] !== tokens[0]) continue;

      let allMatch = true;
      for (let offset = 1; offset < tokens.length; offset += 1) {
        if (normalizedWords[wordIndex + offset] !== tokens[offset]) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        // Mark the first word as the match carrier
        result.set(wordIndex, { suggestions: [term], isVariant: true });
        // Mark remaining words as ignored so they are skipped in the main loop
        for (let offset = 1; offset < tokens.length; offset += 1) {
          ignoredIndexes.add(wordIndex + offset);
        }
        break;
      }
    }
  }
  return result;
};

const findIgnoredWordIndexes = (segment: Segment, ignoredLexiconPhrases: string[][]) => {
  if (ignoredLexiconPhrases.length === 0 || segment.words.length === 0) return new Set<number>();
  const normalizedWords = segment.words.map((word) => normalizeSpellcheckTerm(word.word));
  const ignoredIndexes = new Set<number>();

  for (let wordIndex = 0; wordIndex < normalizedWords.length; wordIndex += 1) {
    for (const phraseTokens of ignoredLexiconPhrases) {
      if (wordIndex + phraseTokens.length > normalizedWords.length) continue;
      if (normalizedWords[wordIndex] !== phraseTokens[0]) continue;

      let matchesPhrase = true;
      for (let offset = 1; offset < phraseTokens.length; offset += 1) {
        if (normalizedWords[wordIndex + offset] !== phraseTokens[offset]) {
          matchesPhrase = false;
          break;
        }
      }

      if (matchesPhrase) {
        for (let offset = 0; offset < phraseTokens.length; offset += 1) {
          ignoredIndexes.add(wordIndex + offset);
        }
        break;
      }
    }
  }

  return ignoredIndexes;
};

export function useSpellcheck({
  spellcheckEnabled,
  spellcheckLanguages,
  spellcheckCustomEnabled,
  spellcheckCustomDictionaries,
  loadSpellcheckCustomDictionaries,
  segments,
  spellcheckIgnoreWords,
  lexiconEntries,
}: UseSpellcheckOptions) {
  const [spellcheckers, setSpellcheckers] = useState<Awaited<ReturnType<typeof loadSpellcheckers>>>(
    [],
  );
  const [spellcheckMatchesBySegment, setSpellcheckMatchesBySegment] = useState<
    Map<string, Map<number, SpellcheckMatchMeta>>
  >(new Map());
  const [spellcheckMatchLimitReached, setSpellcheckMatchLimitReached] = useState(false);
  const spellcheckRunIdRef = useRef(0);
  const previousSegmentsRef = useRef<Segment[]>([]);
  const previousMatchesRef = useRef<Map<string, Map<number, SpellcheckMatchMeta>>>(new Map());
  const previousCacheKeyRef = useRef<string | null>(null);
  const previousSpellcheckersRef = useRef(spellcheckers);
  const previousRunCompletedRef = useRef(false);
  const previousIgnoredWordsRef = useRef<Set<string>>(new Set());

  // When custom dictionaries are enabled, they replace built-in languages
  const effectiveSpellcheckLanguages = useMemo(
    () => (spellcheckCustomEnabled ? [] : spellcheckLanguages),
    [spellcheckLanguages, spellcheckCustomEnabled],
  );

  const spellcheckDebugEnabled = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("spellcheckDebug") === "1";
    } catch {
      return false;
    }
  }, []);

  type IdleHandle = {
    id: number | ReturnType<typeof setTimeout>;
    type: "idle" | "timeout";
  };

  const scheduleIdle = useCallback((callback: () => void): IdleHandle => {
    const requestIdle = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (cb: () => void) => number;
      }
    ).requestIdleCallback;
    if (requestIdle) {
      return { id: requestIdle(callback), type: "idle" };
    }
    return { id: globalThis.setTimeout(callback, 0), type: "timeout" };
  }, []);

  const cancelIdle = useCallback((handle: IdleHandle | null) => {
    if (!handle) return;
    if (
      handle.type === "idle" &&
      (
        globalThis as typeof globalThis & {
          cancelIdleCallback?: (id: number) => void;
        }
      ).cancelIdleCallback
    ) {
      (
        globalThis as typeof globalThis & {
          cancelIdleCallback?: (id: number) => void;
        }
      ).cancelIdleCallback?.(handle.id as number);
      return;
    }
    globalThis.clearTimeout(handle.id);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let scheduled: IdleHandle | null = null;
    if (
      !spellcheckEnabled ||
      (effectiveSpellcheckLanguages.length === 0 && !spellcheckCustomEnabled)
    ) {
      setSpellcheckers([]);
      return () => {
        isMounted = false;
        cancelIdle(scheduled);
      };
    }

    scheduled = scheduleIdle(() => {
      loadSpellcheckers(
        effectiveSpellcheckLanguages,
        spellcheckCustomEnabled ? spellcheckCustomDictionaries : [],
      )
        .then((loaded) => {
          if (isMounted) {
            setSpellcheckers(loaded);
          }
        })
        .catch((err) => {
          logger.error("Failed to load spellcheck dictionaries.", { error: err });
        });
    });

    return () => {
      isMounted = false;
      cancelIdle(scheduled);
    };
  }, [
    cancelIdle,
    scheduleIdle,
    spellcheckCustomDictionaries,
    spellcheckCustomEnabled,
    spellcheckEnabled,
    effectiveSpellcheckLanguages,
  ]);

  useEffect(() => {
    loadSpellcheckCustomDictionaries();
  }, [loadSpellcheckCustomDictionaries]);

  const spellcheckLanguageKey = useMemo(() => {
    const languageKey = effectiveSpellcheckLanguages.slice().sort().join(",");
    const customKey = spellcheckCustomDictionaries
      .map((dictionary) => dictionary.id)
      .sort()
      .join("|");
    const enabledKey = spellcheckCustomEnabled ? "custom:on" : "custom:off";
    return `${languageKey}|${enabledKey}|${customKey}`;
  }, [effectiveSpellcheckLanguages, spellcheckCustomDictionaries, spellcheckCustomEnabled]);

  const ignoredWordsSet = useMemo(() => {
    const ignored = new Set(spellcheckIgnoreWords);
    lexiconEntries.forEach((entry) => {
      const term = normalizeSpellcheckTerm(entry.term);
      if (term) {
        ignored.add(term);
      }
      // False positives are suppressed (no spellcheck marker).
      (entry.falsePositives ?? []).forEach((fp) => {
        const normalized = normalizeSpellcheckTerm(fp);
        if (normalized) {
          ignored.add(normalized);
        }
      });
      // Variants are NOT suppressed – they are flagged as matches with the
      // canonical term as suggestion (see variantMatchMap below).
    });
    return ignored;
  }, [lexiconEntries, spellcheckIgnoreWords]);

  /**
   * Maps normalized single-word variant → canonical term (suggestion).
   * Used to flag variants directly, bypassing the spellchecker so that
   * even valid dictionary words are correctly identified as variants.
   */
  const variantMatchMap = useMemo(() => {
    const map = new Map<string, string>();
    lexiconEntries.forEach((entry) => {
      const term = entry.term.trim();
      if (!term) return;
      (entry.variants ?? []).forEach((variant) => {
        const tokens = variant
          .split(/\s+/)
          .map((t) => normalizeSpellcheckTerm(t))
          .filter(Boolean);
        // Only single-word variants go into this map;
        // multi-word variants are flagged via buildMultiWordVariantPhrases/findMultiWordVariantMatches.
        if (tokens.length === 1) {
          map.set(tokens[0], term);
        }
      });
    });
    return map;
  }, [lexiconEntries]);

  const ignoredLexiconPhrases = useMemo(
    () => buildIgnoredLexiconPhrases(lexiconEntries),
    [lexiconEntries],
  );

  /**
   * Multi-word variant phrases together with their canonical term.
   * Used to inject match entries for consecutive word sequences that represent
   * a known variant of a glossary term.
   */
  const multiWordVariantPhrases = useMemo(
    () => buildMultiWordVariantPhrases(lexiconEntries),
    [lexiconEntries],
  );

  const ignoredKey = useMemo(() => Array.from(ignoredWordsSet).sort().join("|"), [ignoredWordsSet]);

  /** Stable key that changes whenever variant mappings change.
   *  Included in cacheKey so that adding/removing variants invalidates
   *  cached spellcheck results for unchanged segments. */
  const variantKey = useMemo(() => {
    const singleWord = Array.from(variantMatchMap.entries())
      .map(([k, v]) => `${k}:${v}`)
      .sort()
      .join(",");
    const multiWord = multiWordVariantPhrases
      .map((e) => `${e.tokens.join(" ")}:${e.term}`)
      .sort()
      .join(",");
    return `${singleWord}|${multiWord}`;
  }, [variantMatchMap, multiWordVariantPhrases]);

  const isSuperset = useCallback((subset: Set<string>, superset: Set<string>) => {
    if (subset.size > superset.size) return false;
    for (const value of subset) {
      if (!superset.has(value)) return false;
    }
    return true;
  }, []);

  const filterMatchesForSegment = useCallback(
    (
      segment: Segment,
      matches: Map<number, SpellcheckMatchMeta>,
      ignored: Set<string>,
      ignoredWordIndexes: Set<number>,
    ) => {
      if (matches.size === 0) return matches;
      let didChange = false;
      const nextMatches = new Map<number, SpellcheckMatchMeta>();
      matches.forEach((value, index) => {
        if (ignoredWordIndexes.has(index)) {
          didChange = true;
          return;
        }
        const word = segment.words[index]?.word;
        if (!word) {
          didChange = true;
          return;
        }
        const normalized = normalizeSpellcheckTerm(word);
        // Variant matches must never be filtered by ignored words / false
        // positives — consistent with useLexiconMatches.ts where explicit
        // variants always win over false-positive entries.
        if (!value.isVariant && normalized && ignored.has(normalized)) {
          didChange = true;
          return;
        }
        nextMatches.set(index, value);
      });
      return didChange ? nextMatches : matches;
    },
    [],
  );

  useEffect(() => {
    const SPELLCHECK_MATCH_LIMIT = 1000;
    const runId = spellcheckRunIdRef.current + 1;
    spellcheckRunIdRef.current = runId;
    setSpellcheckMatchLimitReached(false);
    const previousRunCompleted = previousRunCompletedRef.current;

    if (!spellcheckEnabled || spellcheckers.length === 0 || segments.length === 0) {
      setSpellcheckMatchesBySegment(new Map());
      previousSegmentsRef.current = [];
      previousMatchesRef.current = new Map();
      previousCacheKeyRef.current = null;
      previousSpellcheckersRef.current = spellcheckers;
      previousRunCompletedRef.current = true;
      previousIgnoredWordsRef.current = new Set(ignoredWordsSet);
      return;
    }

    previousRunCompletedRef.current = false;

    const cacheKey = `${spellcheckLanguageKey}|${ignoredKey}|${variantKey}`;
    const previousIgnoredWords = previousIgnoredWordsRef.current;
    const ignoredWordsExpanded = isSuperset(previousIgnoredWords, ignoredWordsSet);
    const canReuseForIgnoreChange =
      ignoredWordsExpanded &&
      previousRunCompleted &&
      previousSpellcheckersRef.current === spellcheckers &&
      previousSegmentsRef.current.length > 0;

    const reuseMatches =
      previousCacheKeyRef.current === cacheKey &&
      previousSpellcheckersRef.current === spellcheckers &&
      previousRunCompleted;
    const matches = new Map<string, Map<number, SpellcheckMatchMeta>>();
    const ignoredWordIndexesBySegment = new Map<string, Set<number>>();
    const multiWordVariantProcessedSegments = new Set<string>();
    const segmentsToProcess: Segment[] = [];
    let matchCount = 0;
    let segmentIndex = 0;
    let wordIndex = 0;
    let processedSinceUpdate = 0;
    let cancelled = false;

    if (canReuseForIgnoreChange) {
      const previousSegmentsById = new Map(
        previousSegmentsRef.current.map((segment) => [segment.id, segment]),
      );
      segments.forEach((segment) => {
        const previousSegment = previousSegmentsById.get(segment.id);
        if (segment.confirmed) {
          return;
        }
        if (previousSegment === segment) {
          const previousMatches = previousMatchesRef.current.get(segment.id);
          if (previousMatches) {
            const ignoredWordIndexes = findIgnoredWordIndexes(segment, ignoredLexiconPhrases);
            ignoredWordIndexesBySegment.set(segment.id, ignoredWordIndexes);
            const filtered = filterMatchesForSegment(
              segment,
              previousMatches,
              ignoredWordsSet,
              ignoredWordIndexes,
            );
            if (filtered.size > 0) {
              matches.set(segment.id, filtered);
              matchCount += filtered.size;
            }
          }
          return;
        }
        segmentsToProcess.push(segment);
      });
    } else if (reuseMatches) {
      const previousSegmentsById = new Map(
        previousSegmentsRef.current.map((segment) => [segment.id, segment]),
      );
      segments.forEach((segment) => {
        const previousSegment = previousSegmentsById.get(segment.id);
        if (segment.confirmed) {
          return;
        }
        if (previousSegment === segment) {
          const previousMatches = previousMatchesRef.current.get(segment.id);
          if (previousMatches) {
            matches.set(segment.id, previousMatches);
            matchCount += previousMatches.size;
            return;
          }
        }
        segmentsToProcess.push(segment);
      });
    } else {
      segmentsToProcess.push(...segments.filter((segment) => !segment.confirmed));
    }

    previousSegmentsRef.current = segments;
    previousCacheKeyRef.current = cacheKey;
    previousSpellcheckersRef.current = spellcheckers;
    previousIgnoredWordsRef.current = new Set(ignoredWordsSet);

    if (matchCount >= SPELLCHECK_MATCH_LIMIT) {
      setSpellcheckMatchesBySegment(new Map(matches));
      previousMatchesRef.current = new Map(matches);
      setSpellcheckMatchLimitReached(true);
      previousCacheKeyRef.current = cacheKey;
      previousSpellcheckersRef.current = spellcheckers;
      previousRunCompletedRef.current = true;
      previousIgnoredWordsRef.current = new Set(ignoredWordsSet);
      return;
    }

    if (segmentsToProcess.length === 0) {
      setSpellcheckMatchesBySegment(new Map(matches));
      previousMatchesRef.current = new Map(matches);
      previousCacheKeyRef.current = cacheKey;
      previousSpellcheckersRef.current = spellcheckers;
      previousRunCompletedRef.current = true;
      previousIgnoredWordsRef.current = new Set(ignoredWordsSet);
      return;
    }

    const CHUNK_SIZE = 5; // Very small chunks to stay under 16ms budget
    const CHUNK_DELAY = 0; // Process as fast as possible but yield between chunks
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const processChunk = () => {
      if (cancelled || spellcheckRunIdRef.current !== runId) return;
      let iterations = 0;

      while (segmentIndex < segmentsToProcess.length && iterations < CHUNK_SIZE) {
        const segment = segmentsToProcess[segmentIndex];
        const words = segment.words;
        const wordMatches = matches.get(segment.id) ?? new Map<number, SpellcheckMatchMeta>();
        const ignoredWordIndexes =
          ignoredWordIndexesBySegment.get(segment.id) ??
          findIgnoredWordIndexes(segment, ignoredLexiconPhrases);
        ignoredWordIndexesBySegment.set(segment.id, ignoredWordIndexes);

        // Pre-populate wordMatches with multi-word variant hits (first word of
        // each sequence carries the suggestion; remaining words are added to
        // ignoredWordIndexes so the inner loop skips them).
        if (!multiWordVariantProcessedSegments.has(segment.id)) {
          multiWordVariantProcessedSegments.add(segment.id);
          const multiWordMatches = findMultiWordVariantMatches(
            segment,
            multiWordVariantPhrases,
            ignoredWordIndexes,
          );
          for (const [idx, meta] of multiWordMatches) {
            wordMatches.set(idx, meta);
            matchCount += 1;
          }
        }

        while (wordIndex < words.length && iterations < CHUNK_SIZE) {
          if (ignoredWordIndexes.has(wordIndex)) {
            wordIndex += 1;
            iterations += 1;
            processedSinceUpdate += 1;
            continue;
          }
          // Skip words that were already matched by the multi-word variant pass
          if (wordMatches.has(wordIndex)) {
            wordIndex += 1;
            iterations += 1;
            processedSinceUpdate += 1;
            continue;
          }
          const word = words[wordIndex];
          // Direct variant lookup: check before the spellchecker so that valid
          // dictionary words listed as variants are still flagged.
          const normalizedWord = normalizeSpellcheckTerm(word.word);
          const variantTerm = variantMatchMap.get(normalizedWord);
          const match = variantTerm
            ? { suggestions: [variantTerm], isVariant: true }
            : getSpellcheckMatch(word.word, spellcheckers, spellcheckLanguageKey, ignoredWordsSet);
          if (match) {
            wordMatches.set(wordIndex, match);
            matchCount += 1;
            if (matchCount >= SPELLCHECK_MATCH_LIMIT) {
              if (wordMatches.size > 0) {
                matches.set(segment.id, wordMatches);
              }
              setSpellcheckMatchesBySegment(new Map(matches));
              setSpellcheckMatchLimitReached(true);
              return;
            }
          }
          wordIndex += 1;
          iterations += 1;
          processedSinceUpdate += 1;
        }

        if (wordMatches.size > 0) {
          matches.set(segment.id, wordMatches);
        }

        if (wordIndex >= words.length) {
          segmentIndex += 1;
          wordIndex = 0;
        } else {
          break;
        }
      }

      // Update UI every 25 processed words or when done
      if (processedSinceUpdate >= 25 || segmentIndex >= segmentsToProcess.length) {
        setSpellcheckMatchesBySegment(new Map(matches));
        previousMatchesRef.current = new Map(matches);
        processedSinceUpdate = 0;
      }

      // Schedule next chunk with delay or finish
      if (segmentIndex < segmentsToProcess.length) {
        timeoutId = setTimeout(processChunk, CHUNK_DELAY);
      } else if (matches.size === 0) {
        setSpellcheckMatchesBySegment(new Map());
        previousMatchesRef.current = new Map();
        previousCacheKeyRef.current = cacheKey;
        previousSpellcheckersRef.current = spellcheckers;
        previousRunCompletedRef.current = true;
        previousIgnoredWordsRef.current = new Set(ignoredWordsSet);
      } else {
        previousMatchesRef.current = new Map(matches);
        previousCacheKeyRef.current = cacheKey;
        previousSpellcheckersRef.current = spellcheckers;
        previousRunCompletedRef.current = true;
        previousIgnoredWordsRef.current = new Set(ignoredWordsSet);
      }
    };

    // Start processing with initial delay to avoid blocking mount
    timeoutId = setTimeout(processChunk, CHUNK_DELAY);

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [
    filterMatchesForSegment,
    ignoredKey,
    ignoredLexiconPhrases,
    ignoredWordsSet,
    isSuperset,
    multiWordVariantPhrases,
    segments,
    spellcheckEnabled,
    spellcheckLanguageKey,
    spellcheckers,
    variantKey,
    variantMatchMap,
  ]);

  const spellcheckMatchCount = useMemo(() => {
    const SPELLCHECK_MATCH_LIMIT = 1000;
    let totalMatches = 0;
    spellcheckMatchesBySegment.forEach((matches) => {
      totalMatches += matches.size;
    });
    return Math.min(totalMatches, SPELLCHECK_MATCH_LIMIT);
  }, [spellcheckMatchesBySegment]);

  return {
    effectiveSpellcheckLanguages,
    spellcheckDebugEnabled,
    spellcheckers,
    spellcheckMatchesBySegment,
    spellcheckMatchCount,
    spellcheckMatchLimitReached,
  };
}
