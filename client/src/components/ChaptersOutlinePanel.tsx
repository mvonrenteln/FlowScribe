import { X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Chapter, Segment } from "@/lib/store";
import { buildSegmentIndexMap, sortChaptersByStart } from "@/lib/store/utils/chapters";
import { cn } from "@/lib/utils";

interface ChaptersOutlinePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: Chapter[];
  segments: Segment[];
  selectedChapterId: string | null;
  onJumpToChapter: (chapterId: string) => void;
}

/**
 * Non-modal floating outline panel for chapter navigation.
 */
export function ChaptersOutlinePanel({
  open,
  onOpenChange,
  chapters,
  segments,
  selectedChapterId,
  onJumpToChapter,
}: ChaptersOutlinePanelProps) {
  const indexById = useMemo(() => buildSegmentIndexMap(segments), [segments]);
  const sortedChapters = useMemo(
    () => sortChaptersByStart(chapters, indexById),
    [chapters, indexById],
  );

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onOpenChange(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  const renderRange = (chapter: Chapter) => {
    const startIndex = indexById.get(chapter.startSegmentId);
    const endIndex = indexById.get(chapter.endSegmentId);
    if (startIndex === undefined || endIndex === undefined) return "Range unavailable";
    return `Segments ${startIndex + 1}–${endIndex + 1}`;
  };

  if (!open) return null;

  return (
    <aside
      className="absolute right-6 top-4 z-30 w-64 max-w-[280px] rounded-md border bg-background/95 shadow-sm"
      aria-label="Chapter outline panel"
      data-testid="chapters-outline-panel"
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold text-foreground">Chapters</h3>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          aria-label="Close chapters outline"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="max-h-[60vh]">
        <div className="space-y-1 p-2">
          {sortedChapters.length === 0 && (
            <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              No chapters yet. Start with "Start Chapter Here" in a segment menu.
            </div>
          )}
          {sortedChapters.map((chapter) => (
            <button
              key={chapter.id}
              type="button"
              onClick={() => onJumpToChapter(chapter.id)}
              className={cn(
                "w-full rounded-md px-2 py-2 text-left transition-colors",
                chapter.id === selectedChapterId ? "bg-accent/40" : "hover:bg-muted/40",
              )}
            >
              <div className="text-xs font-semibold truncate">{chapter.title}</div>
              <div className="text-[11px] text-muted-foreground">{renderRange(chapter)}</div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
