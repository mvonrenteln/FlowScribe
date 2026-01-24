import { ChevronDown, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Chapter, ChapterUpdate, Tag } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ChapterEditMenu } from "./ChapterEditMenu";

interface ChapterHeaderProps {
  chapter: Chapter;
  tags: Tag[];
  isSelected: boolean;
  onOpen: () => void;
  onUpdateChapter: (id: string, updates: ChapterUpdate) => void;
  onDeleteChapter: (id: string) => void;
  editOpen?: boolean;
  onEditOpenChange?: (open: boolean) => void;
}

/**
 * Collapsible inline header that reveals chapter summary/notes when expanded.
 */
export function ChapterHeader({
  chapter,
  tags,
  isSelected,
  onOpen,
  onUpdateChapter,
  onDeleteChapter,
  editOpen,
  onEditOpenChange,
}: ChapterHeaderProps) {
  const [expanded, setExpanded] = useState(false);
  const [internalEditOpen, setInternalEditOpen] = useState(false);
  const resolvedEditOpen = editOpen ?? internalEditOpen;
  const handleEditOpenChange = onEditOpenChange ?? setInternalEditOpen;
  const tagLookup = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const chapterTags = useMemo(
    () => (chapter.tags ?? []).map((id) => tagLookup.get(id)?.name ?? id),
    [chapter.tags, tagLookup],
  );

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        className={cn(
          "group relative mt-6 mb-2 flex items-start gap-3 py-3",
          isSelected && "text-primary",
        )}
        data-testid={`chapter-header-${chapter.id}`}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            className="flex flex-1 items-start gap-3 text-left"
          >
            <ChevronDown
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 transition-transform",
                expanded && "rotate-180",
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold leading-tight tracking-tight truncate">
                {chapter.title}
              </div>
              {chapterTags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 text-muted-foreground">
                  {chapterTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0.5">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <ChapterEditMenu
          chapter={chapter}
          tags={tags}
          onUpdateChapter={onUpdateChapter}
          onDeleteChapter={onDeleteChapter}
          open={resolvedEditOpen}
          onOpenChange={handleEditOpenChange}
          align="end"
          side="bottom"
          trigger={
            <Button
              variant="ghost"
              size="icon"
              onClick={(event) => event.stopPropagation()}
              aria-label={`Edit chapter ${chapter.title}`}
              className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          }
        />
      </div>
      <CollapsibleContent>
        <div className="pl-7 pb-4 space-y-2 text-sm">
          {chapter.summary && (
            <p className="text-foreground" data-testid={`chapter-summary-${chapter.id}`}>
              {chapter.summary}
            </p>
          )}
          {chapter.notes && (
            <p className="text-muted-foreground" data-testid={`chapter-notes-${chapter.id}`}>
              {chapter.notes}
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
