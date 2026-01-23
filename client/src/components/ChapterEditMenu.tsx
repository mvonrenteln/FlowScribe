import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { Chapter, ChapterUpdate, Tag } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ChapterEditMenuProps {
  chapter: Chapter;
  tags: Tag[];
  onUpdateChapter: (id: string, updates: ChapterUpdate) => void;
  onDeleteChapter: (id: string) => void;
  trigger?: React.ReactNode;
  anchorRef?: React.RefObject<HTMLSpanElement>;
  anchorClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Popover menu for editing chapter metadata (title, summary, notes, tags).
 */
export function ChapterEditMenu({
  chapter,
  tags,
  onUpdateChapter,
  onDeleteChapter,
  trigger,
  anchorRef,
  anchorClassName,
  open,
  onOpenChange,
  align = "start",
  side = "right",
}: ChapterEditMenuProps) {
  const [titleDraft, setTitleDraft] = useState(chapter.title);
  const [summaryDraft, setSummaryDraft] = useState(chapter.summary ?? "");
  const [notesDraft, setNotesDraft] = useState(chapter.notes ?? "");
  const [internalOpen, setInternalOpen] = useState(false);

  const resolvedOpen = open ?? internalOpen;
  const handleOpenChange = onOpenChange ?? setInternalOpen;

  useEffect(() => {
    setTitleDraft(chapter.title);
    setSummaryDraft(chapter.summary ?? "");
    setNotesDraft(chapter.notes ?? "");
  }, [chapter.notes, chapter.summary, chapter.title]);

  const selectedTags = useMemo(() => new Set(chapter.tags ?? []), [chapter.tags]);

  const commitUpdate = (updates: ChapterUpdate) => {
    onUpdateChapter(chapter.id, updates);
  };

  const handleTitleCommit = () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle || nextTitle === chapter.title) return;
    commitUpdate({ title: nextTitle });
  };

  const handleSummaryCommit = () => {
    const nextSummary = summaryDraft.trim();
    const nextValue = nextSummary === "" ? undefined : nextSummary;
    if (nextValue === chapter.summary) return;
    commitUpdate({ summary: nextValue });
  };

  const handleNotesCommit = () => {
    const nextNotes = notesDraft.trim();
    const nextValue = nextNotes === "" ? undefined : nextNotes;
    if (nextValue === chapter.notes) return;
    commitUpdate({ notes: nextValue });
  };

  const handleToggleTag = (tagId: string) => {
    const current = new Set(selectedTags);
    if (current.has(tagId)) {
      current.delete(tagId);
    } else {
      current.add(tagId);
    }
    const nextTags = Array.from(current);
    commitUpdate({ tags: nextTags.length > 0 ? nextTags : undefined });
  };

  return (
    <Popover open={resolvedOpen} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild>
        {trigger ?? <span aria-hidden="true" data-testid="chapter-edit-trigger-fallback" />}
      </PopoverTrigger>
      {anchorRef && (
        <PopoverAnchor asChild>
          <span
            ref={anchorRef}
            className={cn("block h-1 w-1", anchorClassName)}
            aria-hidden="true"
          />
        </PopoverAnchor>
      )}
      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        forceMount
        className="w-80 space-y-3 rounded-md border bg-background/95 p-3 shadow-sm data-[state=closed]:hidden"
      >
        <div className="space-y-2">
          <Label htmlFor={`chapter-title-${chapter.id}`}>Title</Label>
          <Input
            id={`chapter-title-${chapter.id}`}
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={handleTitleCommit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleTitleCommit();
              }
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`chapter-summary-${chapter.id}`}>Summary</Label>
          <Textarea
            id={`chapter-summary-${chapter.id}`}
            value={summaryDraft}
            onChange={(event) => setSummaryDraft(event.target.value)}
            onBlur={handleSummaryCommit}
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`chapter-notes-${chapter.id}`}>Notes</Label>
          <Textarea
            id={`chapter-notes-${chapter.id}`}
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            onBlur={handleNotesCommit}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="space-y-2">
            {tags.length === 0 && (
              <p className="text-xs text-muted-foreground">No tags available.</p>
            )}
            {tags.map((tag) => {
              const checked = selectedTags.has(tag.id);
              return (
                <label
                  key={tag.id}
                  className="flex items-center gap-2 text-sm"
                  htmlFor={`chapter-tag-${chapter.id}-${tag.id}`}
                >
                  <Checkbox
                    id={`chapter-tag-${chapter.id}-${tag.id}`}
                    checked={checked}
                    onCheckedChange={() => handleToggleTag(tag.id)}
                  />
                  <span>{tag.name}</span>
                </label>
              );
            })}
          </div>
        </div>
        <Separator />
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            onDeleteChapter(chapter.id);
            handleOpenChange(false);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Chapter
        </Button>
      </PopoverContent>
    </Popover>
  );
}
