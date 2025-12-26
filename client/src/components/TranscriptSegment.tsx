import {
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
  Edit,
  Merge,
  MoreVertical,
  Scissors,
  Trash2,
  User,
} from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import type { Segment, Speaker, Word } from "@/lib/store";
import { cn } from "@/lib/utils";
import { wordLeadingRegex, wordTrailingRegex } from "@/lib/wordBoundaries";
import { TranscriptWord } from "./TranscriptWord";

interface TranscriptSegmentProps {
  readonly segment: Segment;
  readonly speakers: Speaker[];
  readonly isSelected: boolean;
  readonly isActive: boolean;
  readonly activeWordIndex?: number;
  readonly splitWordIndex?: number;
  readonly highlightLowConfidence?: boolean;
  readonly lowConfidenceThreshold?: number | null;
  readonly lexiconMatches?: Map<number, { term: string; score: number; partIndex?: number }>;
  readonly showLexiconMatches?: boolean;
  readonly lexiconHighlightUnderline?: boolean;
  readonly lexiconHighlightBackground?: boolean;
  readonly spellcheckMatches?: Map<number, { suggestions: string[]; partIndex?: number }>;
  readonly showSpellcheckMatches?: boolean;
  readonly editRequested?: boolean;
  readonly onEditRequestHandled?: () => void;
  readonly onSelect: () => void;
  readonly onTextChange: (text: string) => void;
  readonly onSpeakerChange: (speaker: string) => void;
  readonly onSplit: (wordIndex: number) => void;
  readonly onConfirm: () => void;
  readonly onToggleBookmark: () => void;
  readonly onIgnoreLexiconMatch?: (term: string, value: string) => void;
  readonly onIgnoreSpellcheckMatch?: (value: string) => void;
  readonly onAddSpellcheckToGlossary?: (value: string) => void;
  readonly showConfirmAction?: boolean;
  readonly onMergeWithPrevious?: () => void;
  readonly onMergeWithNext?: () => void;
  readonly onDelete: () => void;
  readonly onSeek: (time: number) => void;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

function TranscriptSegmentComponent({
  segment,
  speakers,
  isSelected,
  isActive,
  activeWordIndex,
  splitWordIndex,
  highlightLowConfidence = false,
  lowConfidenceThreshold = null,
  lexiconMatches,
  showLexiconMatches = false,
  lexiconHighlightUnderline = false,
  lexiconHighlightBackground = false,
  spellcheckMatches,
  showSpellcheckMatches = false,
  editRequested = false,
  onEditRequestHandled,
  onSelect,
  onTextChange,
  onSpeakerChange,
  onSplit,
  onConfirm,
  onToggleBookmark,
  onIgnoreLexiconMatch,
  onIgnoreSpellcheckMatch,
  onAddSpellcheckToGlossary,
  showConfirmAction = true,
  onMergeWithPrevious,
  onMergeWithNext,
  onDelete,
  onSeek,
}: TranscriptSegmentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(segment.text);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [spellcheckExpandedIndex, setSpellcheckExpandedIndex] = useState<number | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  const speaker = speakers.find((s) => s.name === segment.speaker);
  const speakerColor = speaker?.color || "hsl(217, 91%, 48%)";

  useEffect(() => {
    if (!isEditing) {
      setDraftText(segment.text);
    }
  }, [isEditing, segment.text]);

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const body = document.body;
    const previousValue = body.dataset.transcriptEditing;
    body.dataset.transcriptEditing = "true";
    return () => {
      if (previousValue === undefined) {
        delete body.dataset.transcriptEditing;
      } else {
        body.dataset.transcriptEditing = previousValue;
      }
    };
  }, [isEditing]);

  const handleStartEdit = useCallback(() => {
    setDraftText(segment.text);
    setIsEditing(true);
  }, [segment.text]);

  useEffect(() => {
    if (!editRequested) return;
    if (!isEditing) {
      handleStartEdit();
    }
    onEditRequestHandled?.();
  }, [editRequested, handleStartEdit, isEditing, onEditRequestHandled]);

  const handleSaveEdit = useCallback(() => {
    setIsEditing(false);
    onTextChange(draftText);
  }, [draftText, onTextChange]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraftText(segment.text);
  }, [segment.text]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSaveEdit();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancelEdit();
      }
    },
    [handleCancelEdit, handleSaveEdit],
  );

  const handleWordAction = useCallback(
    (word: Word, index: number, shiftKey: boolean) => {
      if (shiftKey) {
        setSelectedWordIndex(index);
      } else {
        onSeek(word.start);
      }
    },
    [onSeek],
  );

  const handleWordClick = useCallback(
    (word: Word, index: number, e: React.MouseEvent) => {
      e.stopPropagation();
      handleWordAction(word, index, e.shiftKey);
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

  const handleSelectKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) return;
      if (event.key === " ") {
        event.preventDefault();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        onSelect();
      }
    },
    [isEditing, onSelect],
  );

  const handleSegmentClick = useCallback(() => {
    if (isEditing) return;
    onSelect();
  }, [isEditing, onSelect]);

  const applyWordReplacement = useCallback(
    (index: number, replacement: string, partIndex?: number) => {
      const nextText = segment.words.map((item) => item.word);
      const original = nextText[index] ?? "";
      const leading = wordLeadingRegex.exec(original)?.[0] ?? "";
      const trailing = wordTrailingRegex.exec(original)?.[0] ?? "";
      const core = original.slice(leading.length, original.length - trailing.length);
      if (partIndex === undefined || !core.includes("-")) {
        nextText[index] = `${leading}${replacement}${trailing}`;
        onTextChange(nextText.join(" "));
        return;
      }
      const parts = core.split("-");
      if (partIndex < 0 || partIndex >= parts.length) {
        nextText[index] = `${leading}${replacement}${trailing}`;
        onTextChange(nextText.join(" "));
        return;
      }
      parts[partIndex] = replacement;
      nextText[index] = `${leading}${parts.join("-")}${trailing}`;
      onTextChange(nextText.join(" "));
    },
    [onTextChange, segment.words],
  );

  const getHyphenTarget = useCallback((value: string, partIndex?: number) => {
    if (partIndex === undefined) return value;
    const leading = wordLeadingRegex.exec(value)?.[0] ?? "";
    const trailing = wordTrailingRegex.exec(value)?.[0] ?? "";
    const core = value.slice(leading.length, value.length - trailing.length);
    if (!core.includes("-")) return value;
    const parts = core.split("-");
    const part = parts[partIndex];
    return part ?? value;
  }, []);

  const resolvedActiveWordIndex = isActive ? (activeWordIndex ?? -1) : -1;
  const resolvedSplitWordIndex = isActive ? (splitWordIndex ?? -1) : -1;
  const canSplitAtCurrentWord = resolvedSplitWordIndex > 0;
  const isConfirmed = segment.confirmed === true;
  const isBookmarked = segment.bookmarked === true;

  return (
    <article // NOSONAR
      className={cn(
        "group relative p-3 rounded-md border transition-colors cursor-pointer",
        isSelected && "ring-2 ring-ring",
        isActive && "bg-accent/50",
        !isSelected && !isActive && "hover-elevate",
      )}
      onClick={handleSegmentClick}
      onKeyDown={handleSelectKeyDown}
      data-testid={`segment-${segment.id}`}
      data-segment-id={segment.id}
      aria-label={`Segment by ${segment.speaker}`}
      aria-current={isSelected ? "true" : undefined}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Segment needs to be focusable for keyboard navigation
      tabIndex={0} // NOSONAR
    >
      <div className="flex items-start gap-3">
        <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: speakerColor }} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge
                  variant="secondary"
                  className="cursor-pointer text-xs uppercase tracking-wide"
                  style={{
                    backgroundColor: `${speakerColor}20`,
                    color: speakerColor,
                    borderColor: speakerColor,
                  }}
                  data-testid={`badge-speaker-${segment.id}`}
                >
                  <User className="h-3 w-3 mr-1" />
                  {segment.speaker}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {speakers.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => onSpeakerChange(s.name)}
                    data-testid={`menu-speaker-${s.name}`}
                  >
                    <div
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
            </span>
            {isConfirmed && (
              <span className="text-xs font-semibold text-emerald-600/90 bg-emerald-600/10 rounded px-1.5 py-0.5">
                Confirmed
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                ref={editInputRef}
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                onKeyDown={handleEditKeyDown}
                className="text-base leading-relaxed"
                data-testid={`textarea-segment-${segment.id}`}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSaveEdit();
                  }}
                  data-testid={`button-save-segment-${segment.id}`}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCancelEdit();
                  }}
                  data-testid={`button-cancel-segment-${segment.id}`}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            // biome-ignore lint/a11y/noStaticElementInteractions: Double click to edit text
            <div // NOSONAR
              onDoubleClick={handleStartEdit}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              className="text-base leading-relaxed outline-none"
              data-testid={`text-segment-${segment.id}`}
            >
              {segment.words.map((word, index) => (
                <TranscriptWord
                  key={`${segment.id}-${word.start}-${word.end}`}
                  word={word}
                  index={index}
                  segmentId={segment.id}
                  isActive={index === resolvedActiveWordIndex}
                  isSelected={index === selectedWordIndex}
                  lexiconMatch={showLexiconMatches ? lexiconMatches?.get(index) : undefined}
                  spellcheckMatch={
                    showSpellcheckMatches ? spellcheckMatches?.get(index) : undefined
                  }
                  lexiconHighlightUnderline={lexiconHighlightUnderline}
                  lexiconHighlightBackground={lexiconHighlightBackground}
                  highlightLowConfidence={highlightLowConfidence}
                  lowConfidenceThreshold={lowConfidenceThreshold}
                  isExpanded={spellcheckExpandedIndex === index}
                  onToggleExpand={() =>
                    setSpellcheckExpandedIndex((current) => (current === index ? null : index))
                  }
                  onClick={(e) => handleWordClick(word, index, e)}
                  onKeyDown={(e) => handleWordKeyDown(word, index, e)}
                  onApplyReplacement={applyWordReplacement}
                  onIgnoreLexiconMatch={onIgnoreLexiconMatch}
                  onIgnoreSpellcheckMatch={onIgnoreSpellcheckMatch}
                  onAddSpellcheckToGlossary={onAddSpellcheckToGlossary}
                  getHyphenTarget={getHyphenTarget}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {showConfirmAction && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                if (!isConfirmed) {
                  onConfirm();
                }
              }}
              data-testid={`button-confirm-${segment.id}`}
              aria-label={isConfirmed ? "Segment confirmed" : "Confirm segment"}
              disabled={isConfirmed}
            >
              {isConfirmed ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark();
            }}
            data-testid={`button-bookmark-${segment.id}`}
            aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
          >
            {isBookmarked ? (
              <BookmarkCheck className="h-4 w-4" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </Button>
          {selectedWordIndex !== null && selectedWordIndex > 0 && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onSplit(selectedWordIndex);
                setSelectedWordIndex(null);
              }}
              data-testid={`button-split-${segment.id}`}
              aria-label="Split segment at selected word"
            >
              <Scissors className="h-4 w-4" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => e.stopPropagation()}
                data-testid={`button-segment-menu-${segment.id}`}
                aria-label="Segment options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleStartEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit text
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (!canSplitAtCurrentWord) return;
                  onSplit(resolvedSplitWordIndex);
                  setSelectedWordIndex(null);
                }}
                disabled={!canSplitAtCurrentWord}
              >
                <Scissors className="h-4 w-4 mr-2" />
                Split at current word
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (isConfirmed) return;
                  onConfirm();
                }}
                disabled={isConfirmed}
              >
                <Check className="h-4 w-4 mr-2" />
                {isConfirmed ? "Confirmed" : "Confirm block"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onMergeWithPrevious && (
                <DropdownMenuItem onClick={onMergeWithPrevious}>
                  <Merge className="h-4 w-4 mr-2" />
                  Merge with previous
                </DropdownMenuItem>
              )}
              {onMergeWithNext && (
                <DropdownMenuItem onClick={onMergeWithNext}>
                  <Merge className="h-4 w-4 mr-2" />
                  Merge with next
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete segment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}

const arePropsEqual = (prev: TranscriptSegmentProps, next: TranscriptSegmentProps) => {
  return (
    prev.segment === next.segment &&
    prev.speakers === next.speakers &&
    prev.isSelected === next.isSelected &&
    prev.isActive === next.isActive &&
    prev.activeWordIndex === next.activeWordIndex &&
    prev.highlightLowConfidence === next.highlightLowConfidence &&
    prev.lowConfidenceThreshold === next.lowConfidenceThreshold &&
    prev.lexiconMatches === next.lexiconMatches &&
    prev.showLexiconMatches === next.showLexiconMatches &&
    prev.lexiconHighlightUnderline === next.lexiconHighlightUnderline &&
    prev.lexiconHighlightBackground === next.lexiconHighlightBackground &&
    prev.spellcheckMatches === next.spellcheckMatches &&
    prev.showSpellcheckMatches === next.showSpellcheckMatches &&
    prev.editRequested === next.editRequested &&
    prev.onEditRequestHandled === next.onEditRequestHandled &&
    prev.onSelect === next.onSelect &&
    prev.onTextChange === next.onTextChange &&
    prev.onSpeakerChange === next.onSpeakerChange &&
    prev.onSplit === next.onSplit &&
    prev.onConfirm === next.onConfirm &&
    prev.onToggleBookmark === next.onToggleBookmark &&
    prev.onIgnoreLexiconMatch === next.onIgnoreLexiconMatch &&
    prev.onIgnoreSpellcheckMatch === next.onIgnoreSpellcheckMatch &&
    prev.onAddSpellcheckToGlossary === next.onAddSpellcheckToGlossary &&
    prev.showConfirmAction === next.showConfirmAction &&
    prev.onMergeWithPrevious === next.onMergeWithPrevious &&
    prev.onMergeWithNext === next.onMergeWithNext &&
    prev.onDelete === next.onDelete &&
    prev.onSeek === next.onSeek
  );
};

export const TranscriptSegment = memo(TranscriptSegmentComponent, arePropsEqual);
