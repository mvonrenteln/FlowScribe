import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSpellcheckMatch, loadSpellcheckers, normalizeSpellcheckTerm } from "@/lib/spellcheck";
import type {
  LexiconEntry,
  Segment,
  SpellcheckCustomDictionary,
  SpellcheckLanguage,
} from "@/lib/store";

export interface SpellcheckMatchMeta {
  suggestions: string[];
  partIndex?: number;
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
          console.error("Failed to load spellcheck dictionaries:", err);
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

  useEffect(() => {
    const SPELLCHECK_MATCH_LIMIT = 1000;
    const runId = spellcheckRunIdRef.current + 1;
    spellcheckRunIdRef.current = runId;
    setSpellcheckMatchLimitReached(false);
    previousRunCompletedRef.current = false;

    if (!spellcheckEnabled || spellcheckers.length === 0 || segments.length === 0) {
      setSpellcheckMatchesBySegment(new Map());
      previousSegmentsRef.current = [];
      previousMatchesRef.current = new Map();
      previousCacheKeyRef.current = null;
      previousSpellcheckersRef.current = spellcheckers;
      previousRunCompletedRef.current = true;
      return;
    }

    const ignored = new Set(spellcheckIgnoreWords);
    lexiconEntries.forEach((entry) => {
      const term = normalizeSpellcheckTerm(entry.term);
      if (term) {
        ignored.add(term);
      }
      (entry.variants ?? []).forEach((variant) => {
        const normalized = normalizeSpellcheckTerm(variant);
        if (normalized) {
          ignored.add(normalized);
        }
      });
    });

    const ignoredKey = Array.from(ignored).sort().join("|");
    const cacheKey = `${spellcheckLanguageKey}|${ignoredKey}`;
    const reuseMatches =
      previousCacheKeyRef.current === cacheKey &&
      previousSpellcheckersRef.current === spellcheckers &&
      previousRunCompletedRef.current;
    const matches = new Map<string, Map<number, SpellcheckMatchMeta>>();
    const segmentsToProcess: Segment[] = [];
    let matchCount = 0;
    let segmentIndex = 0;
    let wordIndex = 0;
    let processedSinceUpdate = 0;
    let cancelled = false;

    if (reuseMatches) {
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

    if (matchCount >= SPELLCHECK_MATCH_LIMIT) {
      setSpellcheckMatchesBySegment(new Map(matches));
      previousMatchesRef.current = new Map(matches);
      setSpellcheckMatchLimitReached(true);
      previousCacheKeyRef.current = cacheKey;
      previousSpellcheckersRef.current = spellcheckers;
      previousRunCompletedRef.current = true;
      return;
    }

    if (segmentsToProcess.length === 0) {
      setSpellcheckMatchesBySegment(new Map(matches));
      previousMatchesRef.current = new Map(matches);
      previousCacheKeyRef.current = cacheKey;
      previousSpellcheckersRef.current = spellcheckers;
      previousRunCompletedRef.current = true;
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

        while (wordIndex < words.length && iterations < CHUNK_SIZE) {
          const word = words[wordIndex];
          const match = getSpellcheckMatch(
            word.word,
            spellcheckers,
            spellcheckLanguageKey,
            ignored,
          );
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
      } else {
        previousMatchesRef.current = new Map(matches);
        previousCacheKeyRef.current = cacheKey;
        previousSpellcheckersRef.current = spellcheckers;
        previousRunCompletedRef.current = true;
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
    lexiconEntries,
    segments,
    spellcheckEnabled,
    spellcheckIgnoreWords,
    spellcheckLanguageKey,
    spellcheckers,
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
