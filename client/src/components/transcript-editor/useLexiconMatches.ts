import { useMemo } from "react";
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
  raw: string;
  variants: Array<{
    value: string;
    normalized: string;
    raw: string;
  }>;
  falsePositives: Array<{
    value: string;
    normalized: string;
  }>;
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
    .map((entry) => ({
      term: entry.term,
      normalized: normalizeToken(entry.term),
      raw: entry.term.trim().toLowerCase(),
      variants: entry.variants
        .map((variant) => ({
          value: variant,
          normalized: normalizeToken(variant),
          raw: variant.trim().toLowerCase(),
        }))
        .filter((variant) => variant.normalized.length > 0),
      falsePositives: (entry.falsePositives ?? [])
        .map((value) => ({
          value,
          normalized: normalizeToken(value),
        }))
        .filter((value) => value.normalized.length > 0),
    }))
    .filter((entry) => entry.normalized.length > 0);
};

const buildMatches = (
  segments: Segment[],
  lexiconEntries: NormalizedLexiconEntry[],
  lexiconThreshold: number,
): Map<string, Map<number, LexiconMatchMeta>> => {
  const matches = new Map<string, Map<number, LexiconMatchMeta>>();

  segments.forEach((segment) => {
    if (segment.confirmed) {
      return;
    }
    const wordMatches = new Map<number, LexiconMatchMeta>();

    segment.words.forEach((word, index) => {
      const leading = word.word.match(wordLeadingRegex)?.[0] ?? "";
      const trailing = word.word.match(wordTrailingRegex)?.[0] ?? "";
      const core = word.word.slice(leading.length, word.word.length - trailing.length);
      if (!core) return;

      const parts = core.includes("-") ? core.split("-").filter(Boolean) : [core];
      if (parts.length === 0) return;

      let bestScore = 0;
      let bestTerm = "";
      let bestPartIndex: number | undefined;

      parts.forEach((part, partIndex) => {
        const normalizedPart = normalizeToken(part);
        const rawPart = part.trim().toLowerCase();
        if (!normalizedPart) return;

        lexiconEntries.forEach((entry) => {
          const rawTerm = entry.raw;
          const isExactTermMatch = rawPart === rawTerm;

          if (
            entry.falsePositives.some(
              (value) =>
                value.normalized === normalizedPart || value.value.trim().toLowerCase() === rawPart,
            )
          ) {
            return;
          }

          let bestFalsePositiveScore = 0;
          entry.falsePositives.forEach((value) => {
            const score = similarityScore(normalizedPart, value.normalized);
            if (score > bestFalsePositiveScore) {
              bestFalsePositiveScore = score;
            }
          });

          if (bestFalsePositiveScore >= lexiconThreshold) {
            return;
          }

          const score = similarityScore(normalizedPart, entry.normalized);
          const adjustedScore = score === 1 && !isExactTermMatch ? 0.99 : score;

          if (adjustedScore > bestScore) {
            bestScore = adjustedScore;
            bestTerm = entry.term;
            bestPartIndex = parts.length > 1 ? partIndex : undefined;
          }

          const hasVariantMatch = entry.variants.some((variant) => variant.raw === rawPart);
          if (hasVariantMatch && !isExactTermMatch && 0.99 > bestScore) {
            bestScore = 0.99;
            bestTerm = entry.term;
            bestPartIndex = parts.length > 1 ? partIndex : undefined;
          }
        });
      });

      if (bestScore >= lexiconThreshold) {
        wordMatches.set(index, { term: bestTerm, score: bestScore, partIndex: bestPartIndex });
      }
    });

    if (wordMatches.size > 0) {
      matches.set(segment.id, wordMatches);
    }
  });

  return matches;
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

  const lexiconMatchesBySegment = buildMatches(
    segments,
    lexiconEntriesNormalized,
    lexiconThreshold,
  );

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
  return useMemo(
    () => computeLexiconMatches({ segments, lexiconEntries, lexiconThreshold }),
    [segments, lexiconEntries, lexiconThreshold],
  );
};
