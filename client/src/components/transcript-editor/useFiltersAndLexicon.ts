import { useCallback, useEffect, useMemo, useState } from "react";
import type { LexiconEntry, Segment, Speaker } from "@/lib/store";
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
}

export interface FiltersAndLexiconState {
  filterSpeakerId?: string;
  filterLowConfidence: boolean;
  filterBookmarked: boolean;
  filterLexicon: boolean;
  filterLexiconLowScore: boolean;
  filterSpellcheck: boolean;
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
}: UseFiltersAndLexiconOptions) {
  const [filterSpeakerId, setFilterSpeakerId] = useState<string | undefined>();
  const [filterLowConfidence, setFilterLowConfidence] = useState(false);
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  const [filterLexicon, setFilterLexicon] = useState(false);
  const [filterLexiconLowScore, setFilterLexiconLowScore] = useState(false);
  const [filterSpellcheck, setFilterSpellcheck] = useState(false);
  const [highlightLowConfidence, setHighlightLowConfidence] = useState(true);
  const [manualConfidenceThreshold, setManualConfidenceThreshold] = useState<number | null>(null);

  const activeSpeakerName = filterSpeakerId
    ? speakers.find((speaker) => speaker.id === filterSpeakerId)?.name
    : undefined;

  const autoConfidenceThreshold = useMemo(() => {
    const scores = segments
      .flatMap((segment) => segment.words)
      .map((word) => word.score)
      .filter((score): score is number => typeof score === "number");
    if (scores.length === 0) return null;
    scores.sort((a, b) => a - b);
    const index = Math.floor(scores.length * 0.1);
    const percentile = scores[Math.min(index, scores.length - 1)];
    return Math.min(0.4, percentile);
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
    return segments.filter((segment) => {
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
      return true;
    });
  }, [
    activeSpeakerName,
    filterBookmarked,
    filterLexicon,
    filterLexiconLowScore,
    filterLowConfidence,
    filterSpellcheck,
    lexiconMatchesBySegment,
    lowConfidenceThreshold,
    segments,
    spellcheckMatchesBySegment,
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
