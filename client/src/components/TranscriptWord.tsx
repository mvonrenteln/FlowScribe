import { BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { normalizeSpellcheckToken } from "@/lib/spellcheck";
import type { Word } from "@/lib/store";
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
}

export function TranscriptWord({
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
}: TranscriptWordProps) {
  const isLexiconMatch = Boolean(lexiconMatch);
  const isSpellcheckMatch = Boolean(spellcheckMatch);
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
            className="bg-yellow-200 text-black rounded-sm px-0.5 mx-[-0.5px]"
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
      onClick={onClick}
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
          )}
        >
          {renderTextWithHighlights(word.word)}
        </span>
      )}
    </button>
  );

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
}
