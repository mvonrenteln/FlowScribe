import {
  Check,
  ChevronDown,
  Edit2,
  FileText,
  GripVertical,
  MoreVertical,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { CHAPTER_DRAG_TYPE } from "@/lib/dragTypes";
import type { Chapter, ChapterUpdate, Tag } from "@/lib/store";
import { useTranscriptStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ChapterHeaderProps {
  chapter: Chapter;
  tags: Tag[];
  isSelected: boolean;
  onOpen: () => void;
  onUpdateChapter: (id: string, updates: ChapterUpdate) => void;
  onDeleteChapter: (id: string) => void;
  onRewriteChapter: (chapterId: string) => void;
  isTranscriptEditing: boolean;
  autoFocus?: boolean;
  onAutoFocusHandled?: () => void;
}

export function ChapterHeader({
  chapter,
  tags,
  // isSelected is intentionally unused here
  onOpen,
  onUpdateChapter,
  onDeleteChapter,
  onRewriteChapter,
  isTranscriptEditing,
  autoFocus,
  onAutoFocusHandled,
}: ChapterHeaderProps) {
  // Get chapter display mode from store
  const chapterDisplayModes = useTranscriptStore((s) => s.chapterDisplayModes);
  const setChapterDisplayMode = useTranscriptStore((s) => s.setChapterDisplayMode);
  const currentDisplayMode = chapterDisplayModes[chapter.id] || "original";
  const { t } = useTranslation();

  const [expanded, setExpanded] = useState(false);
  const [titleDraft, setTitleDraft] = useState(chapter.title);
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const focusFrameRef = useRef<number | null>(null);
  const ignoreNextTitleBlurRef = useRef(false);
  const ignoreNextSummaryBlurRef = useRef(false);
  const ignoreNextNotesBlurRef = useRef(false);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [hoveredTagId, setHoveredTagId] = useState<string | null>(null);
  const [_hasOverflow, setHasOverflow] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const tagRowRef = useRef<HTMLDivElement>(null);
  const tagContainerRef = useRef<HTMLDivElement>(null);
  const dragPreviewCleanupRef = useRef<number | null>(null);
  // Check if tags overflow - recheck when tags change
  // eslint-disable-next-line react-hooks/exhaustive-deps, lint/correctness/useExhaustiveDependencies
  useEffect(() => {
    const checkOverflow = () => {
      if (tagContainerRef.current) {
        const { scrollWidth, clientWidth } = tagContainerRef.current;
        const overflow = scrollWidth > clientWidth + 1; // +1 for rounding
        setHasOverflow(overflow);
      }
    };

    const timer = setTimeout(checkOverflow, 0);
    window.addEventListener("resize", checkOverflow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", checkOverflow);
    };
  }, []);

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

  // Manage the transcriptEditing dataset flag while any field is in edit mode
  const previousTranscriptEditingValueRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const anyEditing = isTitleEditing || isSummaryEditing || isNotesEditing;
    const body = document.body;
    if (anyEditing) {
      if (previousTranscriptEditingValueRef.current === undefined) {
        previousTranscriptEditingValueRef.current = body.dataset.transcriptEditing;
      }
      body.dataset.transcriptEditing = "true";
      return;
    }

    // cleanup: restore previous value
    if (previousTranscriptEditingValueRef.current === undefined) {
      delete body.dataset.transcriptEditing;
    } else {
      body.dataset.transcriptEditing = previousTranscriptEditingValueRef.current;
    }
    previousTranscriptEditingValueRef.current = undefined;
  }, [isTitleEditing, isSummaryEditing, isNotesEditing]);

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
      if (dragPreviewCleanupRef.current) {
        cancelAnimationFrame(dragPreviewCleanupRef.current);
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

  const handleSummaryCancel = () => {
    setSummaryDraft(chapter.summary ?? "");
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

  const handleNotesCancel = () => {
    setNotesDraft(chapter.notes ?? "");
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

  const handleTitleDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    startTitleEdit();
  };

  const startSummaryEdit = useCallback(() => {
    setExpanded(true);
    setIsSummaryEditing(true);
    ignoreNextSummaryBlurRef.current = true;
  }, []);

  const startNotesEdit = useCallback(() => {
    setExpanded(true);
    setIsNotesEditing(true);
    ignoreNextNotesBlurRef.current = true;
  }, []);

  const handleHeaderClick = () => {
    onOpen();
  };

  // Build a drag image that mirrors the transcript width and chapter title.
  const buildDragPreview = (width: number, title: string) => {
    const preview = document.createElement("div");
    preview.className =
      "pointer-events-none select-none rounded-md border border-border bg-muted/80 px-3 py-2 shadow-sm";
    preview.style.width = `${Math.max(240, Math.floor(width))}px`;
    preview.style.position = "absolute";
    preview.style.top = "-9999px";
    preview.style.left = "-9999px";

    const titleEl = document.createElement("div");
    titleEl.className = "text-sm font-medium text-foreground truncate";
    titleEl.textContent = title || "New Chapter";
    preview.appendChild(titleEl);
    return preview;
  };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        className={cn("group relative mt-6 mb-2 flex items-start gap-3 py-3")}
        data-testid={`chapter-header-${chapter.id}`}
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        role="group"
      >
        <button
          type="button"
          draggable
          className={cn(
            "mt-0.5 p-0.5 rounded transition-opacity focus-visible:ring-0 focus:ring-0 focus:outline-none",
            isHeaderHovered ? "opacity-100" : "opacity-0",
          )}
          aria-label="Drag to move chapter boundary"
          title="Drag to move chapter boundary"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.setData(CHAPTER_DRAG_TYPE, chapter.id);
            event.dataTransfer.effectAllowed = "move";
            const container = (event.currentTarget as HTMLElement).closest(
              "[data-transcript-container]",
            ) as HTMLElement | null;
            const containerWidth = container?.getBoundingClientRect().width ?? 640;
            const preview = buildDragPreview(containerWidth, chapter.title);
            document.body.appendChild(preview);
            event.dataTransfer.setDragImage(preview, 24, 18);
            if (dragPreviewCleanupRef.current) {
              cancelAnimationFrame(dragPreviewCleanupRef.current);
            }
            dragPreviewCleanupRef.current = requestAnimationFrame(() => {
              preview.remove();
              dragPreviewCleanupRef.current = null;
            });
          }}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Chevron toggle - only this triggers expand/collapse */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "mt-0.5 p-0.5 rounded hover:bg-muted/10 transition-opacity focus-visible:ring-0 focus:ring-0 focus:outline-none",
              isHeaderHovered ? "opacity-100" : "opacity-0",
            )}
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
          onClick={isTitleEditing ? undefined : handleHeaderClick}
          onKeyDown={(event) => {
            if (isTitleEditing) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleHeaderClick();
            }
          }}
          role="button"
          tabIndex={0}
        >
          {isTitleEditing ? (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="group"
              aria-label="Edit chapter title"
            >
              <Input
                ref={titleInputRef}
                id={`chapter-title-${chapter.id}`}
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={handleTitleBlur}
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
                className="text-base font-medium text-foreground leading-tight tracking-tight flex-1"
                aria-label="Chapter title"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  commitTitle();
                }}
                aria-label="Save chapter title"
                className="h-8 w-8 shrink-0 focus-visible:ring-0 focus:ring-0 focus:outline-none"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTitleCancel();
                }}
                aria-label="Cancel edit"
                className="h-8 w-8 shrink-0 focus-visible:ring-0 focus:ring-0 focus:outline-none"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1 pb-1 border-b border-border/10">
              <div className="flex items-center gap-2 w-full">
                <span
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "text-base font-medium leading-tight tracking-tight truncate text-foreground pointer-events-auto",
                    !chapter.title && "text-muted-foreground italic",
                  )}
                  onDoubleClick={handleTitleDoubleClick}
                >
                  {chapter.title || "New Chapter"}
                </span>

                {/* Right-aligned tag row + options menu (tags directly left of menu) */}
                <div className="ml-auto flex items-center gap-2 min-h-6">
                  {/* Tag list - copied behavior from SegmentHeader to match UX */}
                  <div
                    ref={tagRowRef}
                    className="relative flex items-center"
                    role="group"
                    data-testid={`chapter-tags-${chapter.id}`}
                  >
                    {chapterTagInfo.length > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <div
                          ref={tagContainerRef}
                          className={cn(
                            "flex items-center gap-1.5 max-w-[28ch] overflow-hidden transition-opacity",
                            isHeaderHovered ? "opacity-100" : "opacity-0",
                          )}
                        >
                          {chapterTagInfo.map((info) => (
                            <Badge
                              key={info.id}
                              variant="secondary"
                              className="text-xs px-2 py-0.5 flex items-center gap-1.5 flex-shrink-0 group/tag"
                              style={
                                info.color
                                  ? { borderLeftWidth: "3px", borderLeftColor: info.color }
                                  : undefined
                              }
                              onMouseEnter={() => setHoveredTagId(info.id)}
                              onMouseLeave={() => setHoveredTagId(null)}
                            >
                              <span className="truncate">{info.name}</span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleRemoveTag(info.id);
                                }}
                                onFocus={() => setHoveredTagId(info.id)}
                                onBlur={() => setHoveredTagId(null)}
                                className={`transition-opacity ${hoveredTagId === info.id ? "opacity-100" : "opacity-0"} w-3`}
                                aria-label={`Remove tag ${info.name}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>

                        {/* Add Tag Button */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-6 w-6 flex-shrink-0 transition-opacity focus-visible:ring-0 focus:ring-0 focus:outline-none",
                                isHeaderHovered ? "opacity-100" : "opacity-0",
                              )}
                              disabled={availableTags.length === 0}
                              data-testid={`button-add-tag-${chapter.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="max-h-64 overflow-auto p-1 text-xs"
                          >
                            {availableTags.map((tag) => (
                              <DropdownMenuItem
                                key={tag.id}
                                className="py-1.5 text-xs"
                                onSelect={() => handleAddTag(tag.id)}
                                data-testid={`menu-add-tag-${tag.id}`}
                              >
                                <div
                                  className="w-2 h-2 rounded-full mr-2"
                                  style={{ backgroundColor: tag.color }}
                                />
                                {tag.name}
                              </DropdownMenuItem>
                            ))}
                            {availableTags.length === 0 && (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                No tags available
                              </div>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "px-2 text-xs gap-1.5 transition-opacity focus-visible:ring-0 focus:ring-0 focus:outline-none",
                              isHeaderHovered ? "opacity-100" : "opacity-0",
                            )}
                            data-testid={`button-add-first-tag-${chapter.id}`}
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Tag</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="max-h-64 overflow-auto p-1 text-xs"
                        >
                          {tags.map((tag) => (
                            <DropdownMenuItem
                              key={tag.id}
                              className="py-1.5 text-xs"
                              onSelect={() => handleAddTag(tag.id)}
                              data-testid={`menu-add-tag-${tag.id}`}
                            >
                              <div
                                className="w-2 h-2 rounded-full mr-2"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name}
                            </DropdownMenuItem>
                          ))}
                          {tags.length === 0 && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                              Keine Tags verfügbar
                            </div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Rewrite Toggle - only shown when rewrite exists */}
                  {chapter.rewrittenText && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 px-2 text-xs gap-1.5 transition-opacity focus-visible:ring-0 focus:ring-0 focus:outline-none",
                        isHeaderHovered ? "opacity-100" : "opacity-0",
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        const newMode =
                          currentDisplayMode === "original" ? "rewritten" : "original";
                        setChapterDisplayMode(chapter.id, newMode);
                      }}
                      aria-label={
                        currentDisplayMode === "original"
                          ? t("rewrite.view.rewrittenLabel")
                          : t("diffView.original")
                      }
                      data-testid={`button-toggle-rewrite-${chapter.id}`}
                    >
                      {currentDisplayMode === "original" ? (
                        <>
                          <Sparkles className="h-3 w-3" />
                          <span>{t("rewrite.view.rewrittenLabel")}</span>
                        </>
                      ) : (
                        <>
                          <FileText className="h-3 w-3" />
                          <span>{t("diffView.original")}</span>
                        </>
                      )}
                    </Button>
                  )}

                  {/* Options menu - aligned to the far right */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-6 w-6 transition-opacity focus-visible:ring-0 focus:ring-0 focus:outline-none",
                          isHeaderHovered ? "opacity-100" : "opacity-0",
                        )}
                        onClick={(event) => event.stopPropagation()}
                        aria-label="Chapter options"
                        data-testid={`button-chapter-options-${chapter.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs">
                      <DropdownMenuItem
                        className="py-1.5 text-xs"
                        onSelect={() => {
                          startTitleEdit();
                        }}
                        data-testid={`menu-edit-chapter-${chapter.id}`}
                      >
                        <Edit2 className="h-3 w-3 mr-2" />
                        Edit title
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="py-1.5 text-xs"
                        onSelect={() => onRewriteChapter(chapter.id)}
                        data-testid={`menu-rewrite-chapter-${chapter.id}`}
                      >
                        <Sparkles className="h-3 w-3 mr-2" />
                        Rewrite chapter
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="py-1.5 text-xs text-destructive"
                        onSelect={() => setShowDeleteDialog(true)}
                        data-testid={`menu-delete-chapter-${chapter.id}`}
                      >
                        <Trash2 className="h-3 w-3 mr-2" />
                        Delete chapter
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          )}
        </div>
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
                  className="h-6 w-6 p-0 focus-visible:ring-0 focus:ring-0 focus:outline-none"
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
              <div
                className="flex items-start gap-2"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="group"
                aria-label="Edit chapter summary"
              >
                <Textarea
                  ref={summaryRef}
                  value={summaryDraft}
                  onChange={(event) => setSummaryDraft(event.target.value)}
                  onBlur={() => {
                    if (ignoreNextSummaryBlurRef.current) {
                      ignoreNextSummaryBlurRef.current = false;
                      requestAnimationFrame(() => summaryRef.current?.focus());
                      return;
                    }
                    handleSummaryCommit();
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSummaryCommit();
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      handleSummaryCancel();
                    }
                  }}
                  rows={2}
                  aria-label="Chapter summary"
                />
                <div className="flex flex-col gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onMouseDown={() => {
                      ignoreNextSummaryBlurRef.current = true;
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSummaryCommit();
                    }}
                    aria-label="Save summary"
                    className="h-8 w-8 shrink-0"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onMouseDown={() => {
                      ignoreNextSummaryBlurRef.current = true;
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSummaryCancel();
                    }}
                    aria-label="Cancel edit"
                    className="h-8 w-8 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
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
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  startSummaryEdit();
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
                  className="h-6 w-6 p-0 focus-visible:ring-0 focus:ring-0 focus:outline-none"
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
              <div
                className="flex items-start gap-2"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="group"
                aria-label="Edit chapter notes"
              >
                <Textarea
                  ref={notesRef}
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  onBlur={() => {
                    if (ignoreNextNotesBlurRef.current) {
                      ignoreNextNotesBlurRef.current = false;
                      requestAnimationFrame(() => notesRef.current?.focus());
                      return;
                    }
                    handleNotesCommit();
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleNotesCommit();
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      handleNotesCancel();
                    }
                  }}
                  rows={3}
                  aria-label="Chapter notes"
                />
                <div className="flex flex-col gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onMouseDown={() => {
                      ignoreNextNotesBlurRef.current = true;
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNotesCommit();
                    }}
                    aria-label="Save notes"
                    className="h-8 w-8 shrink-0"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onMouseDown={() => {
                      ignoreNextNotesBlurRef.current = true;
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNotesCancel();
                    }}
                    aria-label="Cancel edit"
                    className="h-8 w-8 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
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
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  startNotesEdit();
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chapter?</AlertDialogTitle>
            <AlertDialogDescription>
              {chapter.rewrittenText
                ? "This chapter has a rewrite. Both will be deleted."
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDeleteChapter(chapter.id);
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {chapter.rewrittenText ? "Delete Both" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
