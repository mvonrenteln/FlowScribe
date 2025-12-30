import { useCallback, useEffect, useMemo, useState } from "react";
import { createSearchRegex } from "@/lib/searchUtils";
import type { Segment } from "@/lib/store";

interface MatchLocation {
  segmentId: string;
  startIndex: number;
  endIndex: number;
  text: string;
}

export function useSearchAndReplace(
  segments: Segment[],
  updateSegmentsTexts: (updates: Array<{ id: string; text: string }>) => void,
  searchQuery: string,
  isRegexSearch: boolean,
) {
  const [replaceQuery, setReplaceQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  const regex = useMemo(
    () => createSearchRegex(searchQuery, isRegexSearch),
    [searchQuery, isRegexSearch],
  );

  const allMatches = useMemo(() => {
    if (!regex || !searchQuery) return [];

    const matches: MatchLocation[] = [];

    for (const segment of segments) {
      const text = segment.text;
      // Create a global version of the regex to find all matches
      // If regex search, use original flags but ensure 'g' is present
      // Simple searchUtils.ts createSearchRegex uses 'gi' by default for non-regex

      // We use matchAll or a loop with exec
      const searchRegex = new RegExp(
        regex.source,
        regex.flags.includes("g") ? regex.flags : `${regex.flags}g`,
      );

      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
      while ((match = searchRegex.exec(text)) !== null) {
        matches.push({
          segmentId: segment.id,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          text: match[0],
        });
        if (!searchRegex.global) break;
      }
    }
    return matches;
  }, [segments, regex, searchQuery]);

  // Reset current match when allMatches change (e.g. search query change)
  useEffect(() => {
    if (allMatches.length > 0 && currentMatchIndex === -1) {
      setCurrentMatchIndex(0);
    } else if (allMatches.length === 0) {
      setCurrentMatchIndex(-1);
    } else if (currentMatchIndex >= allMatches.length) {
      setCurrentMatchIndex(allMatches.length - 1);
    }
  }, [allMatches.length, currentMatchIndex]);

  const goToNextMatch = useCallback(() => {
    if (allMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % allMatches.length);
  }, [allMatches.length]);

  const goToPrevMatch = useCallback(() => {
    if (allMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + allMatches.length) % allMatches.length);
  }, [allMatches.length]);

  const replaceAll = useCallback(() => {
    if (!regex || !searchQuery) return;

    const updates: Array<{ id: string; text: string }> = [];
    const searchRegex = new RegExp(regex.source, regex.flags);

    for (const segment of segments) {
      const newText = segment.text.replace(searchRegex, replaceQuery);
      if (newText !== segment.text) {
        updates.push({ id: segment.id, text: newText });
      }
    }

    if (updates.length > 0) {
      updateSegmentsTexts(updates);
    }
  }, [segments, regex, searchQuery, replaceQuery, updateSegmentsTexts]);

  const replaceCurrent = useCallback(() => {
    if (currentMatchIndex === -1 || !allMatches[currentMatchIndex]) return;

    const match = allMatches[currentMatchIndex];
    const segment = segments.find((s) => s.id === match.segmentId);
    if (!segment) return;

    const text = segment.text;
    const before = text.substring(0, match.startIndex);
    const after = text.substring(match.endIndex);
    const newText = before + replaceQuery + after;

    updateSegmentsTexts([{ id: segment.id, text: newText }]);

    // We don't manually call goToNextMatch because the allMatches memo
    // will recalculate and the useEffect will handle index adjustment if needed.
    // However, to mimic "Replace and Find Next", we can keep the same index
    // which will now point to the "next" match in the list.
  }, [currentMatchIndex, allMatches, segments, replaceQuery, updateSegmentsTexts]);

  return {
    replaceQuery,
    setReplaceQuery,
    currentMatchIndex,
    totalMatches: allMatches.length,
    currentMatch: allMatches[currentMatchIndex] ?? null,
    goToNextMatch,
    goToPrevMatch,
    replaceAll,
    replaceCurrent,
    onMatchClick: (index: number) => {
      if (index >= 0 && index < allMatches.length) {
        setCurrentMatchIndex(index);
      }
    },
    findMatchIndex: (segmentId: string, startIndex: number) => {
      return allMatches.findIndex((m) => m.segmentId === segmentId && m.startIndex === startIndex);
    },
    allMatches,
  };
}
