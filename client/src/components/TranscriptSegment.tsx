import {
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Segment, Speaker, Word } from "@/lib/store";
import { cn } from "@/lib/utils";

interface TranscriptSegmentProps {
  segment: Segment;
  speakers: Speaker[];
  isSelected: boolean;
  isActive: boolean;
  activeWordIndex?: number;
  splitWordIndex?: number;
  highlightLowConfidence?: boolean;
  lowConfidenceThreshold?: number | null;
  lexiconMatches?: Map<number, { term: string; score: number }>;
  showLexiconMatches?: boolean;
  lexiconHighlightUnderline?: boolean;
  lexiconHighlightBackground?: boolean;
  spellcheckMatches?: Map<number, { suggestions: string[] }>;
  showSpellcheckMatches?: boolean;
  editRequested?: boolean;
  onEditRequestHandled?: () => void;
  onSelect: () => void;
  onTextChange: (text: string) => void;
  onSpeakerChange: (speaker: string) => void;
  onSplit: (wordIndex: number) => void;
  onConfirm: () => void;
  onToggleBookmark: () => void;
  onIgnoreLexiconMatch?: (term: string, value: string) => void;
  onIgnoreSpellcheckMatch?: (value: string) => void;
  showConfirmAction?: boolean;
  onMergeWithPrevious?: () => void;
  onMergeWithNext?: () => void;
  onDelete: () => void;
  onSeek: (time: number) => void;
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
    (word: Word, index: number, event: React.KeyboardEvent<HTMLSpanElement>) => {
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
    (index: number, replacement: string) => {
      const nextText = segment.words.map((item) => item.word);
      const original = nextText[index] ?? "";
      const leading = original.match(/^[^\p{L}\p{N}]+/gu)?.[0] ?? "";
      const trailing = original.match(/[^\p{L}\p{N}]+$/gu)?.[0] ?? "";
      nextText[index] = `${leading}${replacement}${trailing}`;
      onTextChange(nextText.join(" "));
    },
    [onTextChange, segment.words],
  );

  const resolvedActiveWordIndex = isActive ? (activeWordIndex ?? -1) : -1;
  const resolvedSplitWordIndex = isActive ? (splitWordIndex ?? -1) : -1;
  const canSplitAtCurrentWord = resolvedSplitWordIndex > 0;
  const isConfirmed = segment.confirmed === true;
  const isBookmarked = segment.bookmarked === true;

  const isLowConfidence = (word: Word) => {
    if (!highlightLowConfidence) return false;
    if (lowConfidenceThreshold === null) return false;
    if (typeof word.score !== "number") return false;
    return word.score <= lowConfidenceThreshold;
  };

  return (
    <div
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
      role="button"
      aria-label={`Segment by ${segment.speaker}`}
      aria-pressed={isSelected}
      tabIndex={0}
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

          {!isEditing ? (
            <div
              onDoubleClick={handleStartEdit}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              className="text-base leading-relaxed outline-none"
              data-testid={`text-segment-${segment.id}`}
              role="textbox"
              aria-readonly
              tabIndex={0}
            >
              {segment.words.map((word, index) => {
                const lexiconMatch = showLexiconMatches ? lexiconMatches?.get(index) : undefined;
                const spellcheckMatch = showSpellcheckMatches
                  ? spellcheckMatches?.get(index)
                  : undefined;
                const isLexiconMatch = Boolean(lexiconMatch);
                const isSpellcheckMatch = Boolean(spellcheckMatch);
                const shouldUnderline = isLexiconMatch && lexiconHighlightUnderline;
                const shouldBackground =
                  isLexiconMatch && lexiconHighlightBackground && (lexiconMatch?.score ?? 0) < 1;
                const underlineClass = cn(
                  isLowConfidence(word) &&
                    "opacity-60 underline decoration-dotted decoration-2 underline-offset-2",
                  shouldUnderline &&
                    "underline decoration-dotted decoration-emerald-600 underline-offset-2",
                  isSpellcheckMatch && "spellcheck-underline",
                );
                const wordSpan = (
                  <span
                    key={`${segment.id}-${word.start}-${word.end}`}
                    onClick={(e) => handleWordClick(word, index, e)}
                    onKeyDown={(event) => handleWordKeyDown(word, index, event)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      index === resolvedActiveWordIndex && "bg-primary/20 underline",
                      index === selectedWordIndex && "bg-accent ring-1 ring-ring",
                      shouldBackground && "bg-amber-100/70 text-amber-950",
                    )}
                    data-testid={`word-${segment.id}-${index}`}
                    title={
                      isLowConfidence(word) && typeof word.score === "number"
                        ? `Score: ${word.score.toFixed(2)}`
                        : undefined
                    }
                    role="button"
                    tabIndex={0}
                  >
                    <span className={underlineClass}>{word.word}</span>
                    <span className="no-underline"> </span>
                  </span>
                );

                if (!isLexiconMatch && !isSpellcheckMatch) {
                  return wordSpan;
                }

                const suggestions = spellcheckMatch?.suggestions ?? [];
                const isExpanded = spellcheckExpandedIndex === index;
                const visibleSuggestions = isExpanded ? suggestions : suggestions.slice(0, 3);
                const showMore = suggestions.length > 3;

                return (
                  <TooltipProvider key={`${segment.id}-${word.start}-${word.end}`}>
                    <Tooltip>
                      <TooltipTrigger asChild>{wordSpan}</TooltipTrigger>
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
                                  data-testid={`button-apply-glossary-${segment.id}-${index}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    applyWordReplacement(index, lexiconMatch.term);
                                  }}
                                >
                                  Apply
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  data-testid={`button-ignore-glossary-${segment.id}-${index}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onIgnoreLexiconMatch?.(lexiconMatch.term, word.word);
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
                                    data-testid={`button-apply-spellcheck-${segment.id}-${index}`}
                                    data-suggestion={suggestion}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      applyWordReplacement(index, suggestion);
                                    }}
                                  >
                                    {suggestion}
                                  </Button>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  No suggestions
                                </span>
                              )}
                              {showMore && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSpellcheckExpandedIndex((current) =>
                                      current === index ? null : index,
                                    );
                                  }}
                                >
                                  {isExpanded
                                    ? "Less"
                                    : `More (${suggestions.length - 3})`}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                data-testid={`button-ignore-spellcheck-${segment.id}-${index}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onIgnoreSpellcheckMatch?.(word.word);
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
              })}
            </div>
          ) : (
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
    </div>
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
    prev.showConfirmAction === next.showConfirmAction &&
    prev.onMergeWithPrevious === next.onMergeWithPrevious &&
    prev.onMergeWithNext === next.onMergeWithNext &&
    prev.onDelete === next.onDelete &&
    prev.onSeek === next.onSeek
  );
};

export const TranscriptSegment = memo(TranscriptSegmentComponent, arePropsEqual);
