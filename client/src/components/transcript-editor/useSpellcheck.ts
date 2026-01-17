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
  audioUrl: string | null;
  isWaveReady: boolean;
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
  audioUrl,
  isWaveReady,
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
    if (audioUrl && !isWaveReady) {
      return () => {
        isMounted = false;
        cancelIdle(scheduled);
      };
    }
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
    audioUrl,
    cancelIdle,
    isWaveReady,
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

    if (!spellcheckEnabled || spellcheckers.length === 0 || segments.length === 0) {
      setSpellcheckMatchesBySegment(new Map());
      previousSegmentsRef.current = [];
      previousMatchesRef.current = new Map();
      previousCacheKeyRef.current = null;
      previousSpellcheckersRef.current = spellcheckers;
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
      previousSpellcheckersRef.current === spellcheckers;
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
      return;
    }

    if (segmentsToProcess.length === 0) {
      setSpellcheckMatchesBySegment(new Map(matches));
      previousMatchesRef.current = new Map(matches);
      return;
    }

    const scheduleIdleCheck = (callback: (deadline?: { timeRemaining: () => number }) => void) => {
      const requestIdle = (
        globalThis as typeof globalThis & {
          requestIdleCallback?: (
            cb: (deadline?: { timeRemaining: () => number }) => void,
          ) => number;
        }
      ).requestIdleCallback;
      if (requestIdle) {
        return requestIdle(callback);
      }
      return globalThis.setTimeout(() => callback(), 0);
    };

    const processChunk = (deadline?: { timeRemaining: () => number }) => {
      if (cancelled || spellcheckRunIdRef.current !== runId) return;
      let timeRemaining = deadline?.timeRemaining?.() ?? 0;
      let iterations = 0;

      while (segmentIndex < segmentsToProcess.length && (iterations < 120 || timeRemaining > 4)) {
        const segment = segmentsToProcess[segmentIndex];
        const words = segment.words;
        const wordMatches = matches.get(segment.id) ?? new Map<number, SpellcheckMatchMeta>();

        while (wordIndex < words.length) {
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
          timeRemaining = deadline?.timeRemaining?.() ?? 0;
          if (iterations >= 120 && timeRemaining <= 4) break;
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

      if (processedSinceUpdate >= 240 || segmentIndex >= segmentsToProcess.length) {
        setSpellcheckMatchesBySegment(new Map(matches));
        previousMatchesRef.current = new Map(matches);
        processedSinceUpdate = 0;
      }

      if (segmentIndex < segmentsToProcess.length) {
        scheduleIdleCheck(processChunk);
      } else if (matches.size === 0) {
        setSpellcheckMatchesBySegment(new Map());
        previousMatchesRef.current = new Map();
      } else {
        previousMatchesRef.current = new Map(matches);
      }
    };

    scheduleIdleCheck(processChunk);

    return () => {
      cancelled = true;
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
