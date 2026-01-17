import { useCallback, useEffect, useMemo, useState } from "react";
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
  spellcheckEnabled: boolean;
  spellcheckMatchesBySegment: Map<string, Map<number, unknown>>;
  // Confidence from store
  highlightLowConfidence: boolean;
  manualConfidenceThreshold: number | null;
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
  spellcheckEnabled,
  spellcheckMatchesBySegment,
  highlightLowConfidence,
  manualConfidenceThreshold,
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

  const activeSpeakerName = filterSpeakerId
    ? speakers.find((speaker) => speaker.id === filterSpeakerId)?.name
    : undefined;

  const normalizedSegments = useMemo(
    () =>
      segments.map((segment) => {
        const wordsText = segment.words.map((word) => word.word).join(" ");
        return {
          id: segment.id,
          textNormalized: normalizeForSearch(segment.text),
          wordsText,
          wordsNormalized: normalizeForSearch(wordsText),
        };
      }),
    [segments],
  );

  const normalizedSegmentsById = useMemo(
    () => new Map(normalizedSegments.map((entry) => [entry.id, entry])),
    [normalizedSegments],
  );

  // Pre-compute tag sets for O(1) lookups during filtering
  const segmentTagSets = useMemo(() => {
    const tagSets = new Map<string, Set<string>>();
    for (const segment of segments) {
      tagSets.set(segment.id, new Set(getSegmentTags(segment)));
    }
    return tagSets;
  }, [segments]);

  const autoConfidenceThreshold = useMemo(() => {
    return computeAutoConfidenceThreshold(segments);
  }, [segments]);

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

  const filteredSegments = useMemo(() => {
    const regex = createSearchRegex(searchQuery, isRegexSearch);
    const searchNormalized = normalizeForSearch(searchQuery);

    return segments.filter((segment) => {
      const normalizedSegment = normalizedSegmentsById.get(segment.id);
      if (activeSpeakerName && segment.speaker !== activeSpeakerName) {
        return false;
      }
      if (filterLowConfidence) {
        if (lowConfidenceThreshold === null) return false;
        const hasLowScore = segment.words.some(
          (word) => typeof word.score === "number" && word.score <= lowConfidenceThreshold,
        );
        if (!hasLowScore) return false;
      }
      if (filterBookmarked && !segment.bookmarked) {
        return false;
      }
      if (filterLexicon) {
        if (!lexiconMatchesBySegment.has(segment.id)) return false;
      }
      if (filterLexiconLowScore) {
        const matches = lexiconMatchesBySegment.get(segment.id);
        if (!matches) return false;
        const hasLowMatch = Array.from(matches.values()).some((match) => match.score < 1);
        if (!hasLowMatch) return false;
      }
      if (filterSpellcheck) {
        if (!spellcheckMatchesBySegment.has(segment.id)) return false;
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

      if (searchNormalized) {
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
          if (textNormalized.includes(searchNormalized)) return true;

          // Check words reconstruction fallback
          const wordsTextNormalized =
            normalizedSegment?.wordsNormalized ??
            normalizeForSearch(segment.words.map((w) => w.word).join(" "));
          if (!wordsTextNormalized.includes(searchNormalized)) {
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
    lowConfidenceThreshold,
    normalizedSegmentsById,
    segments,
    segmentTagSets,
    spellcheckMatchesBySegment,
    searchQuery,
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
