import { ChevronDown, Edit2, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Chapter, ChapterUpdate, Tag } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ChapterHeaderProps {
  chapter: Chapter;
  tags: Tag[];
  isSelected: boolean;
  onOpen: () => void;
  onUpdateChapter: (id: string, updates: ChapterUpdate) => void;
  onDeleteChapter: (id: string) => void;
  isTranscriptEditing: boolean;
  autoFocus?: boolean;
  onAutoFocusHandled?: () => void;
}

export function ChapterHeader({
  chapter,
  tags,
  isSelected,
  onOpen,
  onUpdateChapter,
  onDeleteChapter,
  isTranscriptEditing,
  autoFocus,
  onAutoFocusHandled,
}: ChapterHeaderProps) {
  const [expanded, setExpanded] = useState(false);
  const [titleDraft, setTitleDraft] = useState(chapter.title);
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const focusFrameRef = useRef<number | null>(null);
  const ignoreNextTitleBlurRef = useRef(false);

  const [summaryDraft, setSummaryDraft] = useState(chapter.summary ?? "");
  const [isSummaryEditing, setIsSummaryEditing] = useState(false);
  const summaryRef = useRef<HTMLTextAreaElement>(null);

  const [notesDraft, setNotesDraft] = useState(chapter.notes ?? "");
  const [isNotesEditing, setIsNotesEditing] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTitleDraft(chapter.title);
  }, [chapter.title]);

  useEffect(() => {
    if (!isSummaryEditing) {
      setSummaryDraft(chapter.summary ?? "");
    }
  }, [chapter.summary, isSummaryEditing]);

  useEffect(() => {
    if (!isNotesEditing) {
      setNotesDraft(chapter.notes ?? "");
    }
  }, [chapter.notes, isNotesEditing]);

  const scheduleTitleFocus = useCallback(() => {
    if (focusFrameRef.current) {
      cancelAnimationFrame(focusFrameRef.current);
    }
    focusFrameRef.current = requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
      focusFrameRef.current = null;
    });
  }, []);

  const startTitleEdit = useCallback(() => {
    setExpanded(true);
    setIsTitleEditing(true);
    ignoreNextTitleBlurRef.current = true;
  }, []);

  // Focus input after it has been rendered when entering edit mode
  useEffect(() => {
    if (isTitleEditing) {
      scheduleTitleFocus();
    }
  }, [isTitleEditing, scheduleTitleFocus]);

  // Set the transcriptEditing flag while editing title to prevent scroll/selection interference
  useEffect(() => {
    if (!isTitleEditing) return;
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
  }, [isTitleEditing]);

  // When autoFocus is true (e.g., after creating a new chapter), start editing immediately
  // This should work even if isTranscriptEditing is currently false
  useEffect(() => {
    if (!autoFocus) return;
    // Force start edit even without isTranscriptEditing since we're creating a new chapter
    setExpanded(true);
    setIsTitleEditing(true);
    ignoreNextTitleBlurRef.current = true;
    onAutoFocusHandled?.();
  }, [autoFocus, onAutoFocusHandled]);

  useEffect(() => {
    return () => {
      if (focusFrameRef.current) {
        cancelAnimationFrame(focusFrameRef.current);
      }
    };
  }, []);

  const tagLookup = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const chapterTagInfo = useMemo(
    () =>
      (chapter.tags ?? []).map((id) => {
        const tag = tagLookup.get(id);
        return { id, name: tag?.name ?? id, color: tag?.color };
      }),
    [chapter.tags, tagLookup],
  );

  const assignedTagIds = useMemo(() => new Set(chapter.tags ?? []), [chapter.tags]);
  const availableTags = useMemo(
    () => tags.filter((tag) => !assignedTagIds.has(tag.id)),
    [tags, assignedTagIds],
  );

  const commitTitle = () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setTitleDraft(chapter.title);
      setIsTitleEditing(false);
      return;
    }
    if (nextTitle !== chapter.title) {
      onUpdateChapter(chapter.id, { title: nextTitle });
    }
    setIsTitleEditing(false);
  };

  const handleTitleBlur = () => {
    if (ignoreNextTitleBlurRef.current) {
      ignoreNextTitleBlurRef.current = false;
      scheduleTitleFocus();
      return;
    }
    commitTitle();
  };

  const handleTitleCancel = () => {
    setTitleDraft(chapter.title);
    setIsTitleEditing(false);
  };

  const handleSummaryCommit = () => {
    const nextSummary = summaryDraft.trim();
    const nextValue = nextSummary === "" ? undefined : nextSummary;
    if (nextValue !== chapter.summary) {
      onUpdateChapter(chapter.id, { summary: nextValue });
    }
    setIsSummaryEditing(false);
  };

  const handleNotesCommit = () => {
    const nextNotes = notesDraft.trim();
    const nextValue = nextNotes === "" ? undefined : nextNotes;
    if (nextValue !== chapter.notes) {
      onUpdateChapter(chapter.id, { notes: nextValue });
    }
    setIsNotesEditing(false);
  };

  const handleAddTag = (tagId: string) => {
    const nextTags = [...(chapter.tags ?? []), tagId];
    onUpdateChapter(chapter.id, { tags: nextTags });
  };

  const handleRemoveTag = (tagId: string) => {
    const nextTags = (chapter.tags ?? []).filter((id) => id !== tagId);
    onUpdateChapter(chapter.id, { tags: nextTags.length ? nextTags : undefined });
  };

  const handleManualRenameSelect = () => {
    requestAnimationFrame(() => startTitleEdit());
  };

  const handleTitleDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    startTitleEdit();
  };

  const handleHeaderClick = () => {
    onOpen();
  };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        className={cn(
          "group relative mt-6 mb-2 flex items-start gap-3 py-3",
          isSelected && "text-primary",
        )}
        data-testid={`chapter-header-${chapter.id}`}
      >
        {/* Chevron toggle - only this triggers expand/collapse */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="mt-0.5 p-0.5 hover:bg-accent rounded"
            aria-label={expanded ? "Collapse chapter" : "Expand chapter"}
          >
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")}
            />
          </button>
        </CollapsibleTrigger>

        {/* Title area - separate from collapsible trigger */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={handleHeaderClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleHeaderClick();
            }
          }}
          role="button"
          tabIndex={0}
        >
          {isTitleEditing ? (
            <Input
              ref={titleInputRef}
              id={`chapter-title-${chapter.id}`}
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={handleTitleBlur}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitTitle();
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  handleTitleCancel();
                }
              }}
              className="text-lg font-semibold leading-tight tracking-tight"
              aria-label="Chapter title"
            />
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  role="button"
                  tabIndex={0}
                  className="text-lg font-semibold leading-tight tracking-tight truncate"
                  onDoubleClick={handleTitleDoubleClick}
                >
                  {chapter.title}
                </span>
                {/* Edit button - visible on hover */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(event) => {
                    event.stopPropagation();
                    startTitleEdit();
                  }}
                  aria-label="Edit chapter title"
                  data-testid={`button-edit-chapter-title-${chapter.id}`}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
              {chapterTagInfo.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 text-muted-foreground">
                  {chapterTagInfo.map((info) => (
                    <Badge
                      key={info.id}
                      variant="secondary"
                      className="text-[10px] px-2 py-0.5 flex items-center gap-1"
                      style={
                        info.color
                          ? { borderLeftWidth: "3px", borderLeftColor: info.color }
                          : undefined
                      }
                    >
                      <span className="truncate">{info.name}</span>
                      {isTranscriptEditing && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemoveTag(info.id);
                          }}
                          aria-label={`Remove tag ${info.name}`}
                          className="h-3 w-3 rounded-full text-muted-foreground transition-opacity hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions - always visible when isTranscriptEditing */}
        {isTranscriptEditing && (
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Add chapter tag"
                  disabled={availableTags.length === 0}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-64 overflow-auto p-1 text-xs">
                {availableTags.map((tag) => (
                  <DropdownMenuItem
                    key={tag.id}
                    className="py-1.5 text-xs"
                    onSelect={() => handleAddTag(tag.id)}
                  >
                    <div
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </DropdownMenuItem>
                ))}
                {availableTags.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No tags available</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Chapter options"
                  className="h-6 w-6 text-muted-foreground"
                  data-testid={`button-chapter-options-${chapter.id}`}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem
                  className="py-1.5 text-xs"
                  onSelect={handleManualRenameSelect}
                  data-testid={`menu-rename-chapter-${chapter.id}`}
                >
                  <Edit2 className="h-3 w-3 mr-2" />
                  Rename chapter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => onDeleteChapter(chapter.id)}
              aria-label={`Delete chapter ${chapter.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <CollapsibleContent>
        <div className="pl-7 pb-4 space-y-3 text-sm">
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Summary</span>
              {isTranscriptEditing && !isSummaryEditing && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    setIsSummaryEditing(true);
                    requestAnimationFrame(() => summaryRef.current?.focus());
                  }}
                  aria-label="Edit summary"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
            </div>
            {isSummaryEditing ? (
              <Textarea
                ref={summaryRef}
                value={summaryDraft}
                onChange={(event) => setSummaryDraft(event.target.value)}
                onBlur={handleSummaryCommit}
                rows={2}
                aria-label="Chapter summary"
              />
            ) : (
              <div
                className={cn(
                  "text-foreground",
                  !chapter.summary && "text-muted-foreground italic",
                  isTranscriptEditing && "cursor-text",
                )}
                data-testid={`chapter-summary-${chapter.id}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!isTranscriptEditing) return;
                  setIsSummaryEditing(true);
                  requestAnimationFrame(() => summaryRef.current?.focus());
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  if (!isTranscriptEditing) return;
                  setIsSummaryEditing(true);
                  requestAnimationFrame(() => summaryRef.current?.focus());
                }}
              >
                {chapter.summary ?? "Add a concise summary (optional)."}
              </div>
            )}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Notes</span>
              {isTranscriptEditing && !isNotesEditing && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    setIsNotesEditing(true);
                    requestAnimationFrame(() => notesRef.current?.focus());
                  }}
                  aria-label="Edit notes"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
            </div>
            {isNotesEditing ? (
              <Textarea
                ref={notesRef}
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                onBlur={handleNotesCommit}
                rows={3}
                aria-label="Chapter notes"
              />
            ) : (
              <div
                className={cn(
                  "text-muted-foreground",
                  !chapter.notes && "italic text-muted-foreground",
                  isTranscriptEditing && "cursor-text",
                )}
                data-testid={`chapter-notes-${chapter.id}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!isTranscriptEditing) return;
                  setIsNotesEditing(true);
                  requestAnimationFrame(() => notesRef.current?.focus());
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  if (!isTranscriptEditing) return;
                  setIsNotesEditing(true);
                  requestAnimationFrame(() => notesRef.current?.focus());
                }}
              >
                {chapter.notes ?? "Add notes for future reference (optional)."}
              </div>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
