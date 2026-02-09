import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSearchRegex, normalizeForSearch } from "@/lib/searchUtils";
import type { LexiconEntry, Segment, Speaker } from "@/lib/store";
import { getSegmentTags } from "@/lib/store/utils/segmentTags";
import { computeAutoConfidenceThreshold } from "@/lib/transcript/lowConfidenceThreshold";
import type { LexiconMatchMeta } from "./useLexiconMatches";
import { useLexiconMatches } from "./useLexiconMatches";

interface UseFiltersAndLexiconOptions {
  segments: Segment[];
  speakers: Speaker[];
  lexiconEntries: LexiconEntry[];
  lexiconThreshold: number;
  lexiconHighlightUnderline: boolean;
  lexiconHighlightBackground: boolean;
  lexiconSessionIgnores: string[];
  spellcheckEnabled: boolean;
  spellcheckMatchesBySegment: Map<string, Map<number, unknown>>;
  // Confidence from store
  highlightLowConfidence: boolean;
  manualConfidenceThreshold: number | null;
  confidenceScoresVersion: number;
  setHighlightLowConfidence: (enabled: boolean) => void;
  setManualConfidenceThreshold: (threshold: number | null) => void;
}

export interface FiltersAndLexiconState {
  filterSpeakerId?: string;
  filterLowConfidence: boolean;
  filterBookmarked: boolean;
  filterLexicon: boolean;
  filterLexiconLowScore: boolean;
  filterSpellcheck: boolean;
  filterTagIds: string[];
  filterNotTagIds: string[];
  filterNoTags: boolean;
  highlightLowConfidence: boolean;
  manualConfidenceThreshold: number | null;
  activeSpeakerName?: string;
  lowConfidenceThreshold: number | null;
  lexiconMatchesBySegment: Map<string, Map<number, LexiconMatchMeta>>;
  lexiconMatchCount: number;
  lexiconLowScoreMatchCount: number;
  showLexiconMatches: boolean;
  showSpellcheckMatches: boolean;
  effectiveLexiconHighlightUnderline: boolean;
  effectiveLexiconHighlightBackground: boolean;
  filteredSegments: Segment[];
}

export function useFiltersAndLexicon({
  segments,
  speakers,
  lexiconEntries,
  lexiconThreshold,
  lexiconHighlightUnderline,
  lexiconHighlightBackground,
  lexiconSessionIgnores,
  spellcheckEnabled,
  spellcheckMatchesBySegment,
  highlightLowConfidence,
  manualConfidenceThreshold,
  confidenceScoresVersion,
  setHighlightLowConfidence,
  setManualConfidenceThreshold,
}: UseFiltersAndLexiconOptions) {
  const [filterSpeakerId, setFilterSpeakerId] = useState<string | undefined>();
  const [filterLowConfidence, setFilterLowConfidence] = useState(false);
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  const [filterLexicon, setFilterLexicon] = useState(false);
  const [filterLexiconLowScore, setFilterLexiconLowScore] = useState(false);
  const [filterSpellcheck, setFilterSpellcheck] = useState(false);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [filterNotTagIds, setFilterNotTagIds] = useState<string[]>([]);
  const [filterNoTags, setFilterNoTags] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRegexSearch, setIsRegexSearch] = useState(false);
  const segmentsRef = useRef(segments);

  const needsSearch = searchQuery.trim().length > 0;
  const needsTagFiltering = filterNoTags || filterTagIds.length > 0 || filterNotTagIds.length > 0;

  const activeSpeakerName = filterSpeakerId
    ? speakers.find((speaker) => speaker.id === filterSpeakerId)?.name
    : undefined;

  const normalizedSegments = useMemo(
    () =>
      needsSearch
        ? segments.map((segment) => {
            const wordsText = segment.words.map((word) => word.word).join(" ");
            return {
              id: segment.id,
              textNormalized: normalizeForSearch(segment.text),
              wordsText,
              wordsNormalized: normalizeForSearch(wordsText),
            };
          })
        : [],
    [needsSearch, segments],
  );

  const normalizedSegmentsById = useMemo(
    () => new Map(normalizedSegments.map((entry) => [entry.id, entry])),
    [normalizedSegments],
  );

  const searchCriteria = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      return {
        normalizedQuery: "",
        regex: null as RegExp | null,
      };
    }
    return {
      normalizedQuery: normalizeForSearch(trimmedQuery),
      regex: createSearchRegex(trimmedQuery, isRegexSearch),
    };
  }, [searchQuery, isRegexSearch]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // Pre-compute tag sets for O(1) lookups during filtering
  const segmentTagSets = useMemo(() => {
    if (!needsTagFiltering) {
      return new Map<string, Set<string>>();
    }
    const tagSets = new Map<string, Set<string>>();
    for (const segment of segments) {
      tagSets.set(segment.id, new Set(getSegmentTags(segment)));
    }
    return tagSets;
  }, [needsTagFiltering, segments]);

  const shouldComputeAutoThreshold = manualConfidenceThreshold === null;
  const autoConfidenceThreshold = useMemo(() => {
    if (!shouldComputeAutoThreshold) return null;
    // Confidence scores do not change on merge/split, so depend on the score version.
    void confidenceScoresVersion;
    return computeAutoConfidenceThreshold(segmentsRef.current);
  }, [confidenceScoresVersion, shouldComputeAutoThreshold]);

  const lowConfidenceThreshold = manualConfidenceThreshold ?? autoConfidenceThreshold;
  const {
    lexiconMatchesBySegment,
    lexiconMatchCount,
    lexiconLowScoreMatchCount,
    hasLexiconEntries,
  } = useLexiconMatches({
    segments,
    lexiconEntries,
    lexiconThreshold,
    lexiconSessionIgnores,
  });

  const lexiconHighlightEnabled = lexiconHighlightUnderline || lexiconHighlightBackground;
  const forceLexiconHighlight = filterLexicon || filterLexiconLowScore;
  const effectiveLexiconHighlightUnderline = forceLexiconHighlight
    ? true
    : lexiconHighlightUnderline;
  const effectiveLexiconHighlightBackground = forceLexiconHighlight
    ? true
    : lexiconHighlightBackground;
  const showLexiconMatches =
    hasLexiconEntries && (filterLexicon || filterLexiconLowScore || lexiconHighlightEnabled);
  const showSpellcheckMatches =
    (spellcheckEnabled || filterSpellcheck) && !(filterLexicon || filterLexiconLowScore);

  const lowConfidenceSegmentIds = useMemo(() => {
    if (!filterLowConfidence || lowConfidenceThreshold === null) {
      return null;
    }
    const lowConfidenceIds = new Set<string>();
    for (const segment of segments) {
      const hasLowScore = segment.words.some(
        (word) => typeof word.score === "number" && word.score <= lowConfidenceThreshold,
      );
      if (hasLowScore) {
        lowConfidenceIds.add(segment.id);
      }
    }
    return lowConfidenceIds;
  }, [filterLowConfidence, lowConfidenceThreshold, segments]);

  const lexiconLowScoreSegmentIds = useMemo(() => {
    if (!filterLexiconLowScore) return null;
    const lowScoreIds = new Set<string>();
    for (const [segmentId, matches] of lexiconMatchesBySegment.entries()) {
      const hasLowMatch = Array.from(matches.values()).some((match) => match.score < 1);
      if (hasLowMatch) {
        lowScoreIds.add(segmentId);
      }
    }
    return lowScoreIds;
  }, [filterLexiconLowScore, lexiconMatchesBySegment]);

  const spellcheckSegmentIds = useMemo(() => {
    if (!filterSpellcheck) return null;
    return new Set(spellcheckMatchesBySegment.keys());
  }, [filterSpellcheck, spellcheckMatchesBySegment]);

  const filteredSegments = useMemo(() => {
    const { regex, normalizedQuery } = searchCriteria;

    return segments.filter((segment) => {
      const normalizedSegment = normalizedSegmentsById.get(segment.id);
      if (activeSpeakerName && segment.speaker !== activeSpeakerName) {
        return false;
      }
      if (filterLowConfidence) {
        if (!lowConfidenceSegmentIds || !lowConfidenceSegmentIds.has(segment.id)) return false;
      }
      if (filterBookmarked && !segment.bookmarked) {
        return false;
      }
      if (filterLexicon) {
        if (!lexiconMatchesBySegment.has(segment.id)) return false;
      }
      if (filterLexiconLowScore) {
        if (!lexiconLowScoreSegmentIds || !lexiconLowScoreSegmentIds.has(segment.id)) {
          return false;
        }
      }
      if (filterSpellcheck) {
        if (!spellcheckSegmentIds || !spellcheckSegmentIds.has(segment.id)) return false;
      }
      // Tag filtering with pre-computed sets for O(1) lookups
      const segmentTags = segmentTagSets.get(segment.id);
      if (filterNoTags) {
        if (segmentTags && segmentTags.size > 0) return false;
      }
      if (filterTagIds.length > 0) {
        // OR-logic: segment matches if it has ANY of the selected tags
        if (!segmentTags) return false;
        const hasMatchingTag = filterTagIds.some((tagId) => segmentTags.has(tagId));
        if (!hasMatchingTag) return false;
      }
      if (filterNotTagIds.length > 0) {
        // NOT-logic: segment matches if it does NOT have ANY of the NOT-selected tags
        if (!segmentTags) return true; // No tags means not excluded
        const hasExcludedTag = filterNotTagIds.some((tagId) => segmentTags.has(tagId));
        if (hasExcludedTag) return false;
      }

      if (normalizedQuery) {
        if (isRegexSearch) {
          if (regex) {
            regex.lastIndex = 0;
          }
          if (regex && !regex.test(segment.text)) {
            // Fallback: check reconstructed text from words too
            const wordsText =
              normalizedSegment?.wordsText ?? segment.words.map((w) => w.word).join(" ");
            regex.lastIndex = 0;
            if (!regex.test(wordsText)) {
              return false;
            }
          }
          if (!regex) return true;
        } else {
          // Normal normalized text search
          const textNormalized =
            normalizedSegment?.textNormalized ?? normalizeForSearch(segment.text);
          if (textNormalized.includes(normalizedQuery)) return true;

          // Check words reconstruction fallback
          const wordsTextNormalized =
            normalizedSegment?.wordsNormalized ??
            normalizeForSearch(segment.words.map((w) => w.word).join(" "));
          if (!wordsTextNormalized.includes(normalizedQuery)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    activeSpeakerName,
    filterBookmarked,
    filterLexicon,
    filterLexiconLowScore,
    filterLowConfidence,
    filterSpellcheck,
    filterTagIds,
    filterNotTagIds,
    filterNoTags,
    lexiconMatchesBySegment,
    lowConfidenceSegmentIds,
    normalizedSegmentsById,
    segments,
    segmentTagSets,
    searchCriteria,
    spellcheckSegmentIds,
    lexiconLowScoreSegmentIds,
    isRegexSearch,
  ]);

  useEffect(() => {
    if (!spellcheckEnabled && filterSpellcheck) {
      setFilterSpellcheck(false);
    }
  }, [filterSpellcheck, spellcheckEnabled]);

  const clearFilters = useCallback(() => {
    setFilterSpeakerId(undefined);
    setFilterLowConfidence(false);
    setFilterBookmarked(false);
    setFilterLexicon(false);
    setFilterLexiconLowScore(false);
    setFilterSpellcheck(false);
    setFilterTagIds([]);
    setFilterNotTagIds([]);
    setFilterNoTags(false);
    setSearchQuery("");
    setIsRegexSearch(false);
  }, []);

  return {
    filterSpeakerId,
    setFilterSpeakerId,
    filterLowConfidence,
    setFilterLowConfidence,
    filterBookmarked,
    setFilterBookmarked,
    filterLexicon,
    setFilterLexicon,
    filterLexiconLowScore,
    setFilterLexiconLowScore,
    filterSpellcheck,
    setFilterSpellcheck,
    filterTagIds,
    setFilterTagIds,
    filterNotTagIds,
    setFilterNotTagIds,
    filterNoTags,
    setFilterNoTags,
    highlightLowConfidence,
    setHighlightLowConfidence,
    manualConfidenceThreshold,
    setManualConfidenceThreshold,
    activeSpeakerName,
    lowConfidenceThreshold,
    lexiconMatchesBySegment,
    lexiconMatchCount,
    lexiconLowScoreMatchCount,
    showLexiconMatches,
    showSpellcheckMatches,
    effectiveLexiconHighlightUnderline,
    effectiveLexiconHighlightBackground,
    filteredSegments,
    clearFilters,
    searchQuery,
    setSearchQuery,
    isRegexSearch,
    setIsRegexSearch,
  };
}

export function getEmptyStateMessage({
  segments,
  filterSpellcheck,
  filterLowConfidence,
  activeSpeakerName,
}: {
  segments: Segment[];
  filterSpellcheck: boolean;
  filterLowConfidence: boolean;
  activeSpeakerName?: string;
}) {
  if (segments.length === 0) {
    return {
      title: "No transcript loaded",
      description:
        "Upload an audio file and its Whisper or WhisperX JSON transcript to get started.",
    };
  }

  if (filterSpellcheck && activeSpeakerName) {
    return {
      title: "No spelling issues for this speaker",
      description: "Clear filters to see all segments.",
    };
  }

  if (filterSpellcheck) {
    return {
      title: "No spelling issues",
      description: "Clear filters to see all segments.",
    };
  }

  if (filterLowConfidence && activeSpeakerName) {
    return {
      title: "No low-score segments for this speaker",
      description: "Adjust the threshold or clear filters to see more segments.",
    };
  }

  if (filterLowConfidence) {
    return {
      title: "No low-score segments",
      description: "Adjust the threshold or clear filters to see more segments.",
    };
  }

  return {
    title: "No segments for this speaker",
    description: "Click the speaker again to show all segments.",
  };
}
