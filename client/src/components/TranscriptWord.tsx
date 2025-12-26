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

  const wordButton = (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        "cursor-pointer transition-colors inline-block bg-transparent border-none p-0 font-inherit text-inherit text-left align-baseline",
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
          {leading}
          {hyphenParts.map((part, partIndex) => (
            <span key={`${segmentId}-${word.start}-${partIndex}`}>
              <span
                className={cn(
                  partIndex === lexiconMatch?.partIndex && lexiconUnderlineClass,
                  partIndex === lexiconMatch?.partIndex && lexiconBackgroundClass,
                  partIndex === spellcheckMatch?.partIndex && spellcheckUnderlineClass,
                )}
              >
                {part}
              </span>
              {partIndex < hyphenParts.length - 1 ? "-" : ""}
            </span>
          ))}
          {trailing}
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
          {word.word}
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
