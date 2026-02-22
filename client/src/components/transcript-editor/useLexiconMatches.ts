import { useMemo, useRef } from "react";
import { normalizeToken, similarityScore } from "@/lib/fuzzy";
import type { LexiconEntry, Segment } from "@/lib/store";
import { wordLeadingRegex, wordTrailingRegex } from "@/lib/wordBoundaries";

export interface LexiconMatchMeta {
  term: string;
  score: number;
  partIndex?: number;
}

interface NormalizedLexiconEntry {
  term: string;
  normalized: string;
  normalizedLength: number;
  raw: string;
  variantRawSet: Set<string>;
  variantNormalizedSet: Set<string>;
  variantPhraseTokens: string[][];
  falsePositiveRawSet: Set<string>;
  falsePositiveNormalizedSet: Set<string>;
  falsePositiveNormalized: string[];
}

interface ComputeLexiconMatchesOptions {
  segments: Segment[];
  lexiconEntries: LexiconEntry[];
  lexiconThreshold: number;
}

export interface LexiconMatchesResult {
  lexiconMatchesBySegment: Map<string, Map<number, LexiconMatchMeta>>;
  lexiconMatchCount: number;
  lexiconLowScoreMatchCount: number;
  hasLexiconEntries: boolean;
}

const normalizeLexiconEntries = (lexiconEntries: LexiconEntry[]): NormalizedLexiconEntry[] => {
  return lexiconEntries
    .map((entry) => {
      const normalized = normalizeToken(entry.term);
      const raw = entry.term.trim().toLowerCase();
      const variants = entry.variants
        .map((variant) => ({
          normalized: normalizeToken(variant),
          raw: variant.trim().toLowerCase(),
          phraseTokens: variant
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .map((token) => normalizeToken(token))
            .filter(Boolean),
        }))
        .filter((variant) => variant.normalized.length > 0);
      const falsePositives = (entry.falsePositives ?? [])
        .map((value) => ({
          normalized: normalizeToken(value),
          raw: value.trim().toLowerCase(),
        }))
        .filter((value) => value.normalized.length > 0);

      return {
        term: entry.term,
        normalized,
        normalizedLength: normalized.length,
        raw,
        variantRawSet: new Set(variants.map((variant) => variant.raw).filter(Boolean)),
        variantNormalizedSet: new Set(
          variants.map((variant) => variant.normalized).filter(Boolean),
        ),
        variantPhraseTokens: variants
          .map((variant) => variant.phraseTokens)
          .filter((tokens) => tokens.length > 1),
        falsePositiveRawSet: new Set(falsePositives.map((value) => value.raw).filter(Boolean)),
        falsePositiveNormalizedSet: new Set(falsePositives.map((value) => value.normalized)),
        falsePositiveNormalized: falsePositives.map((value) => value.normalized),
      };
    })
    .filter((entry) => entry.normalizedLength > 0);
};

const canReachThreshold = (aLength: number, bLength: number, threshold: number) => {
  if (aLength === 0 || bLength === 0) return false;
  const diff = Math.abs(aLength - bLength);
  const maxLen = Math.max(aLength, bLength);
  return 1 - diff / maxLen >= threshold;
};

const computeSegmentMatches = (
  segment: Segment,
  lexiconEntries: NormalizedLexiconEntry[],
  lexiconThreshold: number,
): Map<number, LexiconMatchMeta> => {
  const wordMatches = new Map<number, LexiconMatchMeta>();
  const normalizedWords = segment.words.map((word) => {
    const leading = word.word.match(wordLeadingRegex)?.[0] ?? "";
    const trailing = word.word.match(wordTrailingRegex)?.[0] ?? "";
    const core = word.word.slice(leading.length, word.word.length - trailing.length);
    return {
      core,
      raw: core.trim().toLowerCase(),
      normalized: normalizeToken(core),
    };
  });

  lexiconEntries.forEach((entry) => {
    entry.variantPhraseTokens.forEach((phraseTokens) => {
      for (
        let wordIndex = 0;
        wordIndex <= normalizedWords.length - phraseTokens.length;
        wordIndex += 1
      ) {
        let isPhraseMatch = true;
        for (let offset = 0; offset < phraseTokens.length; offset += 1) {
          if (normalizedWords[wordIndex + offset]?.normalized !== phraseTokens[offset]) {
            isPhraseMatch = false;
            break;
          }
        }
        if (!isPhraseMatch) continue;

        for (let offset = 0; offset < phraseTokens.length; offset += 1) {
          const phraseIndex = wordIndex + offset;
          const existing = wordMatches.get(phraseIndex);
          if (!existing || existing.score < 0.99) {
            wordMatches.set(phraseIndex, { term: entry.term, score: 0.99 });
          }
        }
      }
    });
  });

  segment.words.forEach((word, index) => {
    const leading = word.word.match(wordLeadingRegex)?.[0] ?? "";
    const trailing = word.word.match(wordTrailingRegex)?.[0] ?? "";
    const core = word.word.slice(leading.length, word.word.length - trailing.length);
    if (!core) return;

    const parts = core.includes("-") ? core.split("-").filter(Boolean) : [core];
    if (parts.length === 0) return;

    let bestScore = wordMatches.get(index)?.score ?? 0;
    let bestTerm = wordMatches.get(index)?.term ?? "";
    let bestPartIndex: number | undefined;

    parts.forEach((part, partIndex) => {
      const normalizedPart = normalizeToken(part);
      const rawPart = part.trim().toLowerCase();
      const normalizedPartLength = normalizedPart.length;
      if (!normalizedPart) return;

      lexiconEntries.forEach((entry) => {
        const rawTerm = entry.raw;
        const isExactTermMatch = rawPart === rawTerm;
        const hasVariantMatch =
          entry.variantRawSet.has(rawPart) || entry.variantNormalizedSet.has(normalizedPart);

        let candidateScore = 0;
        if (isExactTermMatch) {
          candidateScore = 1;
        } else if (hasVariantMatch) {
          candidateScore = 0.99;
        } else if (
          canReachThreshold(normalizedPartLength, entry.normalizedLength, lexiconThreshold)
        ) {
          const score = similarityScore(normalizedPart, entry.normalized);
          candidateScore = score === 1 ? 0.99 : score;
        }

        if (candidateScore < lexiconThreshold) return;

        // False positives only filter fuzzy similarity matches, not explicit variants or exact terms.
        // A word listed as both a variant and a false positive should always match as a variant.
        if (!isExactTermMatch && !hasVariantMatch) {
          if (
            entry.falsePositiveRawSet.has(rawPart) ||
            entry.falsePositiveNormalizedSet.has(normalizedPart)
          ) {
            return;
          }

          let bestFalsePositiveScore = 0;
          if (entry.falsePositiveNormalized.length > 0) {
            for (const falsePositive of entry.falsePositiveNormalized) {
              if (
                !canReachThreshold(normalizedPartLength, falsePositive.length, lexiconThreshold)
              ) {
                continue;
              }
              const score = similarityScore(normalizedPart, falsePositive);
              if (score > bestFalsePositiveScore) {
                bestFalsePositiveScore = score;
              }
              if (bestFalsePositiveScore >= lexiconThreshold) {
                return;
              }
            }
          }
        }

        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          bestTerm = entry.term;
          bestPartIndex = parts.length > 1 ? partIndex : undefined;
        }
      });
    });

    if (bestScore >= lexiconThreshold) {
      wordMatches.set(index, { term: bestTerm, score: bestScore, partIndex: bestPartIndex });
    }
  });

  return wordMatches;
};

export const computeLexiconMatches = ({
  segments,
  lexiconEntries,
  lexiconThreshold,
}: ComputeLexiconMatchesOptions): LexiconMatchesResult => {
  const lexiconEntriesNormalized = normalizeLexiconEntries(lexiconEntries);

  if (lexiconEntriesNormalized.length === 0) {
    return {
      lexiconMatchesBySegment: new Map<string, Map<number, LexiconMatchMeta>>(),
      lexiconMatchCount: 0,
      lexiconLowScoreMatchCount: 0,
      hasLexiconEntries: false,
    };
  }

  const lexiconMatchesBySegment = new Map<string, Map<number, LexiconMatchMeta>>();
  segments.forEach((segment) => {
    if (segment.confirmed) return;
    const wordMatches = computeSegmentMatches(segment, lexiconEntriesNormalized, lexiconThreshold);
    if (wordMatches.size > 0) {
      lexiconMatchesBySegment.set(segment.id, wordMatches);
    }
  });

  let lexiconMatchCount = 0;
  let lexiconLowScoreMatchCount = 0;
  lexiconMatchesBySegment.forEach((wordMatches) => {
    lexiconMatchCount += wordMatches.size;
    wordMatches.forEach((match) => {
      if (match.score < 1) {
        lexiconLowScoreMatchCount += 1;
      }
    });
  });

  return {
    lexiconMatchesBySegment,
    lexiconMatchCount,
    lexiconLowScoreMatchCount,
    hasLexiconEntries: true,
  };
};

export const useLexiconMatches = ({
  segments,
  lexiconEntries,
  lexiconThreshold,
}: ComputeLexiconMatchesOptions): LexiconMatchesResult => {
  const previousRef = useRef<{
    segments: Segment[];
    lexiconEntries: LexiconEntry[];
    lexiconThreshold: number;
    matches: Map<string, Map<number, LexiconMatchMeta>>;
  }>({
    segments: [],
    lexiconEntries: [],
    lexiconThreshold,
    matches: new Map(),
  });

  // Memoize normalized lexicon entries separately to avoid duplicate normalization
  const lexiconEntriesNormalized = useMemo(
    () => normalizeLexiconEntries(lexiconEntries),
    [lexiconEntries],
  );

  return useMemo(() => {
    if (lexiconEntriesNormalized.length === 0) {
      const empty = {
        lexiconMatchesBySegment: new Map<string, Map<number, LexiconMatchMeta>>(),
        lexiconMatchCount: 0,
        lexiconLowScoreMatchCount: 0,
        hasLexiconEntries: false,
      };
      previousRef.current = {
        segments,
        lexiconEntries,
        lexiconThreshold,
        matches: empty.lexiconMatchesBySegment,
      };
      return empty;
    }

    const reuseMatches =
      previousRef.current.lexiconEntries === lexiconEntries &&
      previousRef.current.lexiconThreshold === lexiconThreshold;
    const matches = new Map<string, Map<number, LexiconMatchMeta>>();
    let lexiconMatchCount = 0;
    let lexiconLowScoreMatchCount = 0;
    const previousSegmentsById = reuseMatches
      ? new Map(previousRef.current.segments.map((segment) => [segment.id, segment]))
      : null;

    segments.forEach((segment) => {
      if (segment.confirmed) return;
      let wordMatches: Map<number, LexiconMatchMeta>;
      if (reuseMatches && previousSegmentsById?.get(segment.id) === segment) {
        wordMatches = previousRef.current.matches.get(segment.id) ?? new Map();
      } else {
        wordMatches = computeSegmentMatches(segment, lexiconEntriesNormalized, lexiconThreshold);
      }
      if (wordMatches.size > 0) {
        matches.set(segment.id, wordMatches);
        lexiconMatchCount += wordMatches.size;
        wordMatches.forEach((match) => {
          if (match.score < 1) {
            lexiconLowScoreMatchCount += 1;
          }
        });
      }
    });

    const result = {
      lexiconMatchesBySegment: matches,
      lexiconMatchCount,
      lexiconLowScoreMatchCount,
      hasLexiconEntries: true,
    };
    previousRef.current = {
      segments,
      lexiconEntries,
      lexiconThreshold,
      matches,
    };
    return result;
  }, [segments, lexiconEntries, lexiconEntriesNormalized, lexiconThreshold]);
};
