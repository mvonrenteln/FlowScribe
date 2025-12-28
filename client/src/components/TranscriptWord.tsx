import { BookOpenText, Check, Replace } from "lucide-react";
import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeSpellcheckToken } from "@/lib/spellcheck";
import type { SearchMatch, Word } from "@/lib/store";
import { cn } from "@/lib/utils";
import { wordLeadingRegex, wordTrailingRegex } from "@/lib/wordBoundaries";

interface TranscriptWordProps {
  readonly word: Word;
  readonly index: number;
  readonly segmentId: string;
  readonly isActive: boolean;
  readonly isSelected: boolean;
  readonly lexiconMatch?: { term: string; score: number; partIndex?: number };
  readonly spellcheckMatch?: { suggestions: string[]; partIndex?: number };
  readonly lexiconHighlightUnderline: boolean;
  readonly lexiconHighlightBackground: boolean;
  readonly highlightLowConfidence: boolean;
  readonly lowConfidenceThreshold: number | null;
  readonly isExpanded: boolean;
  readonly onToggleExpand: () => void;
  readonly onClick: (e: React.MouseEvent) => void;
  readonly onKeyDown: (e: React.KeyboardEvent) => void;
  readonly onApplyReplacement: (index: number, replacement: string, partIndex?: number) => void;
  readonly onIgnoreLexiconMatch?: (term: string, value: string) => void;
  readonly onIgnoreSpellcheckMatch?: (value: string) => void;
  readonly onAddSpellcheckToGlossary?: (value: string) => void;
  readonly getHyphenTarget: (value: string, partIndex?: number) => string;
  readonly searchQuery?: string;
  readonly isRegexSearch?: boolean;
  readonly currentMatch?: SearchMatch;
  readonly wordRange?: { start: number; end: number };
  readonly replaceQuery?: string;
  readonly onReplaceCurrent?: () => void;
  readonly onMatchClick?: (index: number) => void;
  readonly findMatchIndex?: (segmentId: string, startIndex: number) => number;
  readonly matches?: Array<{ segmentId: string; startIndex: number; endIndex: number; text: string }>;
}

export const TranscriptWord = memo(({
  word,
  index,
  segmentId,
  isActive,
  isSelected,
  lexiconMatch,
  spellcheckMatch,
  lexiconHighlightUnderline,
  lexiconHighlightBackground,
  highlightLowConfidence,
  lowConfidenceThreshold,
  isExpanded,
  onToggleExpand,
  onClick,
  onKeyDown,
  onApplyReplacement,
  onIgnoreLexiconMatch,
  onIgnoreSpellcheckMatch,
  onAddSpellcheckToGlossary,
  getHyphenTarget,
  searchQuery = "",
  isRegexSearch = false,
  currentMatch,
  wordRange,
  replaceQuery = "",
  onReplaceCurrent,
  onMatchClick,
  findMatchIndex,
  matches,
}: TranscriptWordProps) => {
  const isLexiconMatch = Boolean(lexiconMatch);
  const isSpellcheckMatch = Boolean(spellcheckMatch);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMatchClick && findMatchIndex && wordRange) {
      const globalIndex = findMatchIndex(segmentId, wordRange.start);
      if (globalIndex !== -1) {
        onMatchClick(globalIndex);
      }
    }
    onClick(e);
  };

  const isCurrentMatch = useMemo(() => {
    if (!currentMatch || !wordRange) return false;
    // Check if the current match overlap with this word's range in the segment
    return (
      currentMatch.startIndex < wordRange.end &&
      currentMatch.endIndex > wordRange.start
    );
  }, [currentMatch, wordRange]);
  const shouldUnderline = isLexiconMatch && lexiconHighlightUnderline;
  const shouldBackground =
    isLexiconMatch && lexiconHighlightBackground && (lexiconMatch?.score ?? 0) < 1;

  const isLowConfidence =
    highlightLowConfidence &&
    lowConfidenceThreshold !== null &&
    typeof word.score === "number" &&
    word.score <= lowConfidenceThreshold;

  const lowConfidenceClass = cn(
    isLowConfidence && "opacity-60 underline decoration-dotted decoration-2 underline-offset-2",
  );
  const lexiconUnderlineClass = shouldUnderline
    ? "underline decoration-dotted decoration-emerald-600 underline-offset-2"
    : "";
  const lexiconBackgroundClass = shouldBackground ? "bg-amber-100/70 text-amber-950" : "";
  const spellcheckUnderlineClass = isSpellcheckMatch ? "spellcheck-underline" : "";

  const leading = wordLeadingRegex.exec(word.word)?.[0] ?? "";
  const trailing = wordTrailingRegex.exec(word.word)?.[0] ?? "";
  const core = word.word.slice(leading.length, word.word.length - trailing.length);
  const hyphenParts =
    (spellcheckMatch?.partIndex !== undefined || lexiconMatch?.partIndex !== undefined) &&
      core.includes("-")
      ? core.split("-")
      : null;

  const renderTextWithHighlights = (text: string) => {
    const query = searchQuery.trim();
    if (!query) return text;

    // Use normalized search for robustness, but we must map back to original indices
    // This is complex with NFD/NFC if lengths differ, so for highlighting we will stick to
    // a regex approach that ignores case and tries to match flexible whitespace/punctuation if needed,
    // OR we just use the simple regex if assumption is IS_REGEX or simple text search.
    // Given the user issue "Blume." not matching "Blume", the previous regex `(${escaped})`
    // works IF `escaped` is just "Blume".
    // BUT the issue was likely that "Blume." was split into ["Blume", "."] or something?
    // No, split returns ["", "Blume", "."] if the regex matches separators.

    // The previous implementation used split with capturing group `(${escaped})`.
    // If text is "Blume." and query is "Blume", regex is /(Blume)/gi.
    // "Blume.".split(/(Blume)/gi) -> ["", "Blume", "."].
    // part[1] is "Blume". regex.test("Blume") is true. It highlights.

    // HOWEVER, if text is "Blume." and query is "Blume.", regex is /(Blume\.)/gi.
    // "Blume.".split(/(Blume\.)/gi) -> ["", "Blume.", ""].
    // This works too.

    // The user said: "Wenn ein gesuchtes Wort Satzzeichen oder Bindestriche enthielt (z.B. "Blume."), wurde es zwar gefunden, aber nicht gelb markiert."
    // Maybe they searched "Blume" and the word was "Blume."?
    // If word is "Blume.", part is "Blume.". regex is /(Blume)/gi.
    // split -> ["", "Blume", "."].
    // "Blume" matches. "." does not.
    // It should work.

    // WAIT. word.word includes punctuation in `Segment` usually?
    // `wordLeadingRegex` and `wordTrailingRegex` strip it for `core`.
    // The `TranscriptWord` renders `leading`, then `hyphenParts` OR `word.word` (if no parts).
    // If `hyphenParts` is null, it renders `word.word` via `renderTextWithHighlights`.

    // If the word in store is "Blume.", and we search "Blume".
    // renderTextWithHighlights("Blume.") with regex /(Blume)/gi.
    // split -> ["", "Blume", "."].
    // "" -> no match
    // "Blume" -> match -> Highlighted
    // "." -> no match
    // Result: <mark>Blume</mark>.

    // If user searches "Blume." (query = "Blume."). Regex /(Blume\.)/gi.
    // renderTextWithHighlights("Blume.") -> ["", "Blume.", ""].
    // "Blume." matches. Highlighted.

    // What if the user searches "Blume" and the text is "Blume-Topf"?
    // Word might be "Blume-Topf". Core.
    // renderTextWithHighlights("Blume-Topf") with /(Blume)/gi.
    // ["", "Blume", "-Topf"]. "Blume" matches.

    // Maybe the issue is `split` behavior or `regex.test` check.
    // Let's make it more robust by ensuring we catch the match correctly.
    // Also handle unicode normalization in highlighting if possible, but that's hard with regex on raw text.
    // We will stick to the regex but ensuring we handle the "split" result correctly.

    let regex: RegExp;
    try {
      if (isRegexSearch) {
        regex = new RegExp(`(${query})`, "gi");
      } else {
        // Normalize the query for the regex creation if we want to match "u" to "ü" ??
        // Standard Regex won't match "u" to "ü" unless we strictly map.
        // For highlighting, if the filter found it via normalization, but the regex doesn't match raw text,
        // we won't highlight it. That might be the "missing highlighting" issue!
        // The user searches "valla" (normalized) but text is "voilà" (or similar).
        // Filter says YES. Highlight says NO (because "valla" != "voilà").

        // If we want to highlight "müller" when searching "muller", we need the regex to handle it.
        // Or we use a non-regex approach?
        // Let's stick to strict highlighting for now (what matches the query visually).
        // BUT user said "Blume." failed.

        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        regex = new RegExp(`(${escaped})`, "gi");
      }
    } catch {
      return text;
    }

    const parts = text.split(regex);
    if (parts.length === 1) return text;

    return parts.map((part, i) => {
      if (!part) return null; // Filter empty strings from split if any (though usually we want them for key/structure?)
      // Actually split keeps empty strings at boundaries. We should render them as text (empty).

      // We check if this part matches the regex.
      // Re-running regex.test(part) is usually fine for "GI" regex on the part produced by capturing group.
      // However, regex is stateful if 'g' is used with exec, but .test with 'g' also advances lastIndex.
      // AND `split` doesn't use lastIndex.
      // BUT `regex.test(part)` advances `regex.lastIndex` if 'g' is set!
      // This is a common bug. calling .test() on the same regex instance multiple times.
      // We should use a fresh regex or reset lastIndex, or simpler:
      // Just check if part.toLowerCase() == query.toLowerCase() (for simple search)?
      // No, regex search needs regex.
      // For the capturing group split, the "odd" indices are usually the matches?
      // "a_b_c".split(/(_)/) -> ["a", "_", "b", "_", "c"].
      // Indices: 0, 1, 2, 3, 4. 1 and 3 are matches.
      // So valid matches are at index 1, 3, 5...

      if (i % 2 === 1) {
        return (
          <mark
            key={`${i}-${part}`}
            className={cn(
              "rounded-sm px-0.5 mx-[-0.5px] transition-colors duration-200",
              replaceQuery ? (isCurrentMatch ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground dark:bg-primary/35 dark:text-primary-foreground") : "bg-primary text-primary-foreground shadow-sm",
            )}
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  const wordButton = (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={onKeyDown}
      className={cn(
        "transcript-word cursor-pointer transition-colors inline-block bg-transparent border-none p-0 font-inherit text-inherit text-left align-baseline",
        isActive && "bg-primary/20 underline",
        isSelected && "bg-accent ring-1 ring-ring",
      )}
      data-testid={`word-${segmentId}-${index}`}
      title={
        isLowConfidence && typeof word.score === "number"
          ? `Score: ${word.score.toFixed(2)}`
          : undefined
      }
    >
      {hyphenParts ? (
        <span className={lowConfidenceClass}>
          {renderTextWithHighlights(leading)}
          {hyphenParts.map((part, partIndex) => (
            <span key={`${segmentId}-${word.start}-${partIndex}`}>
              <span
                className={cn(
                  partIndex === lexiconMatch?.partIndex && lexiconUnderlineClass,
                  partIndex === lexiconMatch?.partIndex && lexiconBackgroundClass,
                  partIndex === spellcheckMatch?.partIndex && spellcheckUnderlineClass,
                )}
              >
                {renderTextWithHighlights(part)}
              </span>
              {partIndex < hyphenParts.length - 1 ? "-" : ""}
            </span>
          ))}
          {renderTextWithHighlights(trailing)}
        </span>
      ) : (
        <span
          className={cn(
            lowConfidenceClass,
            lexiconUnderlineClass,
            lexiconBackgroundClass,
            spellcheckUnderlineClass,
            isCurrentMatch && "bg-primary/30 ring-1 ring-primary/50 rounded-sm px-0.5 -mx-0.5 shadow-sm",
          )}
        >
          {renderTextWithHighlights(word.word)}
        </span>
      )}
    </button>
  );

  if (isCurrentMatch && replaceQuery && onReplaceCurrent) {
    return (
      <Popover open={!!replaceQuery}>
        <PopoverTrigger asChild>{wordButton}</PopoverTrigger>
        <PopoverContent
          className="p-2 w-auto flex flex-col gap-2 animate-in fade-in zoom-in duration-150"
          side="top"
          onOpenAutoFocus={(e) => e.preventDefault()} // Don't steal focus from search input
        >
          <div className="text-[10px] font-semibold text-primary uppercase flex items-center gap-1.5 border-b pb-1 mb-0.5">
            <Replace className="w-3 h-3" />
            Replace Preview
          </div>
          <div className="flex items-center gap-2">
            <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded border shadow-sm">{word.word}</code>
            <span className="text-muted-foreground text-xs">→</span>
            <code className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold border border-primary/20 shadow-sm">{replaceQuery}</code>
            <Button
              size="sm"
              variant="default"
              className="h-7 px-2.5 text-[11px] font-semibold shadow-sm hover:shadow-md transition-all active:scale-95"
              onClick={(e) => {
                e.stopPropagation();
                onReplaceCurrent();
              }}
            >
              <Check className="w-3 h-3 mr-1" />
              Replace
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  if (!isLexiconMatch && !isSpellcheckMatch) {
    return wordButton;
  }

  const suggestions = spellcheckMatch?.suggestions ?? [];
  const visibleSuggestions = isExpanded ? suggestions : suggestions.slice(0, 3);
  const showMore = suggestions.length > 3;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{wordButton}</TooltipTrigger>
        <TooltipContent className="flex flex-col gap-2">
          {isLexiconMatch && lexiconMatch && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs">
                Match: {lexiconMatch.term} ({lexiconMatch.score.toFixed(2)})
              </div>
              {lexiconMatch.score < 1 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`button-apply-glossary-${segmentId}-${index}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onApplyReplacement(index, lexiconMatch.term, lexiconMatch.partIndex);
                    }}
                  >
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid={`button-ignore-glossary-${segmentId}-${index}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      const target = getHyphenTarget(word.word, lexiconMatch.partIndex);
                      onIgnoreLexiconMatch?.(lexiconMatch.term, target);
                    }}
                  >
                    Ignore
                  </Button>
                </>
              )}
            </div>
          )}
          {isSpellcheckMatch && (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-muted-foreground">Spelling</div>
              <div className="flex flex-wrap items-center gap-2">
                {visibleSuggestions.length > 0 ? (
                  visibleSuggestions.map((suggestion) => (
                    <Button
                      key={suggestion}
                      size="sm"
                      variant="outline"
                      data-testid={`button-apply-spellcheck-${segmentId}-${index}`}
                      data-suggestion={suggestion}
                      onClick={(event) => {
                        event.stopPropagation();
                        onApplyReplacement(index, suggestion, spellcheckMatch?.partIndex);
                      }}
                    >
                      {suggestion}
                    </Button>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No suggestions</span>
                )}
                {showMore && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleExpand();
                    }}
                  >
                    {isExpanded ? "Less" : `More (${suggestions.length - 3})`}
                  </Button>
                )}
                {onAddSpellcheckToGlossary && (
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid={`button-add-glossary-spellcheck-${segmentId}-${index}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      const target = getHyphenTarget(word.word, spellcheckMatch?.partIndex);
                      const cleaned = normalizeSpellcheckToken(target).trim();
                      onAddSpellcheckToGlossary(cleaned || target);
                    }}
                  >
                    <BookOpenText className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                    Add to glossary
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid={`button-ignore-spellcheck-${segmentId}-${index}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    const target = getHyphenTarget(word.word, spellcheckMatch?.partIndex);
                    onIgnoreSpellcheckMatch?.(target);
                  }}
                >
                  Ignore
                </Button>
              </div>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
