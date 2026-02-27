import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import type { SearchMatch, Segment, Word } from "@/lib/store";
import type { SeekMeta } from "@/lib/store/types";
import { TranscriptWord } from "../TranscriptWord";
import { buildReplacementText, getHyphenTarget } from "./lexiconActions";

interface WordListProps {
  readonly segment: Segment;
  readonly resolvedActiveWordIndex: number;
  readonly selectedWordIndex: number | null;
  readonly setSelectedWordIndex: (index: number | null) => void;
  readonly spellcheckExpandedIndex: number | null;
  readonly setSpellcheckExpandedIndex: Dispatch<SetStateAction<number | null>>;
  readonly highlightLowConfidence?: boolean;
  readonly lowConfidenceThreshold?: number | null;
  readonly lexiconMatches?: Map<number, { term: string; score: number; partIndex?: number }>;
  readonly showLexiconMatches?: boolean;
  readonly lexiconHighlightUnderline?: boolean;
  readonly lexiconHighlightBackground?: boolean;
  readonly spellcheckMatches?: Map<
    number,
    { suggestions: string[]; partIndex?: number; spanLength?: number }
  >;
  readonly showSpellcheckMatches?: boolean;
  readonly searchQuery?: string;
  readonly isRegexSearch?: boolean;
  readonly replaceQuery?: string;
  readonly currentMatch?: SearchMatch;
  readonly onTextChange: (text: string) => void;
  readonly onSeek: (time: number, meta: SeekMeta) => void;
  readonly onIgnoreLexiconMatch?: (term: string, value: string) => void;
  readonly onIgnoreSpellcheckMatch?: (value: string) => void;
  readonly onAddSpellcheckToGlossary?: (value: string) => void;
  readonly onReplaceCurrent?: () => void;
  readonly onMatchClick?: (index: number) => void;
  readonly findMatchIndex?: (segmentId: string, startIndex: number) => number;
  readonly onSelectOnly?: () => void;
}

export function WordList({
  segment,
  resolvedActiveWordIndex,
  selectedWordIndex,
  setSelectedWordIndex,
  spellcheckExpandedIndex,
  setSpellcheckExpandedIndex,
  highlightLowConfidence = false,
  lowConfidenceThreshold = null,
  lexiconMatches,
  showLexiconMatches = false,
  lexiconHighlightUnderline = false,
  lexiconHighlightBackground = false,
  spellcheckMatches,
  showSpellcheckMatches = false,
  searchQuery,
  isRegexSearch,
  replaceQuery,
  currentMatch,
  onTextChange,
  onSeek,
  onIgnoreLexiconMatch,
  onIgnoreSpellcheckMatch,
  onAddSpellcheckToGlossary,
  onReplaceCurrent,
  onMatchClick,
  findMatchIndex,
  onSelectOnly,
}: WordListProps) {
  const handleWordAction = useCallback(
    (word: Word, index: number, shiftKey: boolean) => {
      if (shiftKey) {
        onSelectOnly?.();
        setSelectedWordIndex(index);
      } else {
        // First mark the segment as selected without triggering the
        // segment-level seek that jumps to the segment start. Then perform
        // the word-level seek to jump precisely to the clicked word.
        onSelectOnly?.();
        onSeek(word.start, { source: "transcript", action: "word_click" });
      }
    },
    [onSeek, setSelectedWordIndex, onSelectOnly],
  );

  const handleWordClick = useCallback(
    (word: Word, index: number, event: React.MouseEvent) => {
      event.stopPropagation();
      // Keep word clicks isolated so they don't trigger segment-level selection.
      handleWordAction(word, index, event.shiftKey);
    },
    [handleWordAction],
  );

  const handleWordKeyDown = useCallback(
    (word: Word, index: number, event: React.KeyboardEvent) => {
      if (event.key === " ") {
        event.preventDefault();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        handleWordAction(word, index, event.shiftKey);
      }
    },
    [handleWordAction],
  );

  const handleApplyReplacement = useCallback(
    (index: number, replacement: string, partIndex?: number, spanLength?: number) => {
      const updatedText = buildReplacementText(
        segment.words,
        index,
        replacement,
        partIndex,
        spanLength,
      );
      onTextChange(updatedText);
    },
    [onTextChange, segment.words],
  );

  const handleToggleExpand = useCallback(
    (index: number) => {
      setSpellcheckExpandedIndex((current) => (current === index ? null : index));
    },
    [setSpellcheckExpandedIndex],
  );

  const handleGetHyphenTarget = useCallback(getHyphenTarget, []);

  let currentPos = 0;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Prevent default on mouse down to avoid text selection
    <div // NOSONAR
      onMouseDown={(event) => {
        // Only prevent default for single clicks, not double clicks.
        // Only stop propagation when the click originates from a word button,
        // otherwise allow bubbling so empty-space clicks still select the segment.
        if (event.detail === 1) {
          event.preventDefault();
          const target = event.target as HTMLElement | null;
          const clickedWord = target?.closest?.("button.transcript-word");
          if (clickedWord) {
            event.stopPropagation();
          }
        }
      }}
      className="text-base leading-relaxed outline-none"
      data-testid={`text-segment-${segment.id}`}
    >
      {segment.words.map((word, index) => {
        const wordStart = currentPos;
        const wordEnd = currentPos + word.word.length;
        currentPos += word.word.length + 1;

        return (
          <TranscriptWord
            key={`${segment.id}-${word.start}-${word.end}-${index}`}
            word={word}
            index={index}
            segmentId={segment.id}
            isActive={index === resolvedActiveWordIndex}
            isSelected={index === selectedWordIndex}
            lexiconMatch={showLexiconMatches ? lexiconMatches?.get(index) : undefined}
            spellcheckMatch={showSpellcheckMatches ? spellcheckMatches?.get(index) : undefined}
            lexiconHighlightUnderline={lexiconHighlightUnderline}
            lexiconHighlightBackground={lexiconHighlightBackground}
            highlightLowConfidence={highlightLowConfidence}
            lowConfidenceThreshold={lowConfidenceThreshold}
            isExpanded={spellcheckExpandedIndex === index}
            onToggleExpand={() => handleToggleExpand(index)}
            onClick={(event) => handleWordClick(word, index, event)}
            onKeyDown={(event) => handleWordKeyDown(word, index, event)}
            onApplyReplacement={handleApplyReplacement}
            onIgnoreLexiconMatch={onIgnoreLexiconMatch}
            onIgnoreSpellcheckMatch={onIgnoreSpellcheckMatch}
            onAddSpellcheckToGlossary={onAddSpellcheckToGlossary}
            getHyphenTarget={handleGetHyphenTarget}
            searchQuery={searchQuery}
            isRegexSearch={isRegexSearch}
            currentMatch={currentMatch}
            wordRange={{ start: wordStart, end: wordEnd }}
            replaceQuery={replaceQuery}
            segmentText={segment.text}
            onReplaceCurrent={onReplaceCurrent}
            onMatchClick={onMatchClick}
            findMatchIndex={findMatchIndex}
          />
        );
      })}
    </div>
  );
}
