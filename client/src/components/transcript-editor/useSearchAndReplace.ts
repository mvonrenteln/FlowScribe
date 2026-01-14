import { useCallback, useEffect, useMemo, useState } from "react";
import { createSearchRegex } from "@/lib/searchUtils";
import type { Segment } from "@/lib/store";

interface MatchLocation {
  segmentId: string;
  startIndex: number;
  endIndex: number;
  text: string;
}

const applyReplacementTemplate = (
  template: string,
  matchText: string,
  offset: number,
  input: string,
  groups: Array<string | undefined>,
  namedGroups?: Record<string, string>,
) => {
  const suffixStart = offset + matchText.length;
  return template.replace(/\$(\$|&|`|'|\d{1,2}|<[^>]+>)/g, (token, value) => {
    if (value === "$") return "$";
    if (value === "&") return matchText;
    if (value === "`") return input.slice(0, offset);
    if (value === "'") return input.slice(suffixStart);
    if (value.startsWith("<") && value.endsWith(">")) {
      const groupName = value.slice(1, -1);
      return namedGroups?.[groupName] ?? "";
    }
    const index = Number(value);
    if (Number.isNaN(index) || index <= 0) return token;
    return groups[index - 1] ?? "";
  });
};

const parseReplacementArgs = (
  args: Array<unknown>,
): {
  matchText: string;
  offset: number;
  input: string;
  groups: Array<string | undefined>;
  namedGroups?: Record<string, string>;
} => {
  const matchText = args[0] as string;
  const lastArg = args[args.length - 1];
  const hasNamedGroups = typeof lastArg === "object" && lastArg !== null;
  const namedGroups = hasNamedGroups ? (lastArg as Record<string, string>) : undefined;
  const offsetIndex = hasNamedGroups ? args.length - 3 : args.length - 2;
  const inputIndex = hasNamedGroups ? args.length - 2 : args.length - 1;
  const offset = args[offsetIndex] as number;
  const input = args[inputIndex] as string;
  const groups = args.slice(1, offsetIndex) as Array<string | undefined>;

  return { matchText, offset, input, groups, namedGroups };
};

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

  const literalQuery = useMemo(
    () => (isRegexSearch ? "" : searchQuery.trim()),
    [isRegexSearch, searchQuery],
  );
  const lowerLiteralQuery = useMemo(() => literalQuery.toLowerCase(), [literalQuery]);

  const globalRegex = useMemo(() => {
    if (!regex || !searchQuery || !isRegexSearch) return null;
    const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
    return new RegExp(regex.source, flags);
  }, [isRegexSearch, regex, searchQuery]);

  const searchableSegments = useMemo(
    () =>
      segments.map((segment) => ({
        id: segment.id,
        text: segment.text,
        lowerText: segment.text.toLowerCase(),
      })),
    [segments],
  );

  const allMatches = useMemo(() => {
    if (!searchQuery) return [];

    const matches: MatchLocation[] = [];

    if (!isRegexSearch) {
      if (!lowerLiteralQuery) return matches;
      for (const segment of searchableSegments) {
        const { id, text, lowerText } = segment;
        let fromIndex = 0;
        while (fromIndex <= lowerText.length) {
          const foundIndex = lowerText.indexOf(lowerLiteralQuery, fromIndex);
          if (foundIndex === -1) break;
          matches.push({
            segmentId: id,
            startIndex: foundIndex,
            endIndex: foundIndex + lowerLiteralQuery.length,
            text: text.slice(foundIndex, foundIndex + literalQuery.length),
          });
          fromIndex = foundIndex + Math.max(lowerLiteralQuery.length, 1);
        }
      }
      return matches;
    }

    const searchRegex = globalRegex;
    if (!searchRegex) return matches;

    for (const segment of searchableSegments) {
      searchRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
      while ((match = searchRegex.exec(segment.text)) !== null) {
        matches.push({
          segmentId: segment.id,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          text: match[0],
        });
        if (!searchRegex.global) break;
        if (match.index === searchRegex.lastIndex) {
          searchRegex.lastIndex += 1;
        }
      }
    }
    return matches;
  }, [
    globalRegex,
    isRegexSearch,
    literalQuery,
    lowerLiteralQuery,
    searchableSegments,
    searchQuery,
  ]);

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

    if (isRegexSearch && regex) {
      const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
      const searchRegex = new RegExp(regex.source, flags);
      let replaced = false;
      const newText = segment.text.replace(searchRegex, (...args) => {
        const { matchText, offset, input, groups, namedGroups } = parseReplacementArgs(
          args as Array<unknown>,
        );
        if (replaced || offset !== match.startIndex) {
          return matchText;
        }
        replaced = true;
        return applyReplacementTemplate(
          replaceQuery,
          matchText,
          offset,
          input,
          groups,
          namedGroups,
        );
      });

      if (replaced && newText !== segment.text) {
        updateSegmentsTexts([{ id: segment.id, text: newText }]);
      }
      return;
    }

    const text = segment.text;
    const before = text.substring(0, match.startIndex);
    const after = text.substring(match.endIndex);
    const newText = before + replaceQuery + after;

    updateSegmentsTexts([{ id: segment.id, text: newText }]);

    // We don't manually call goToNextMatch because the allMatches memo
    // will recalculate and the useEffect will handle index adjustment if needed.
    // However, to mimic "Replace and Find Next", we can keep the same index
    // which will now point to the "next" match in the list.
  }, [
    currentMatchIndex,
    allMatches,
    segments,
    replaceQuery,
    updateSegmentsTexts,
    isRegexSearch,
    regex,
  ]);

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
