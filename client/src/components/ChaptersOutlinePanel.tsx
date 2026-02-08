import { X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Chapter } from "@/lib/store";
import { useSegmentIndexById, useTranscriptStore } from "@/lib/store";
import { sortChaptersByStart } from "@/lib/store/utils/chapters";
import { cn } from "@/lib/utils";

interface ChaptersOutlinePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: Chapter[];
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
  selectedChapterId,
  onJumpToChapter,
}: ChaptersOutlinePanelProps) {
  const indexById = useSegmentIndexById();
  const tags = useTranscriptStore((state) => state.tags);
  const sortedChapters = useMemo(
    () => sortChaptersByStart(chapters, indexById),
    [chapters, indexById],
  );
  const tagsById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag.name])), [tags]);

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

  const renderSummary = (chapter: Chapter) => {
    const summary = chapter.summary;
    if (!summary) return "";
    return String(summary);
  };

  if (!open) return null;

  return (
    <aside
      className="absolute right-6 top-4 z-30 w-64 max-w-[280px] rounded-md border bg-background/95 shadow-sm"
      aria-label="Chapter outline panel"
      data-testid="chapters-outline-panel"
    >
      <div className="group flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Chapters</h3>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          aria-label="Close chapters outline"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="h-[60vh] overflow-y-auto overflow-x-hidden">
        <div className="space-y-1 p-2">
          {sortedChapters.length === 0 && (
            <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              No chapters yet. Start with "Start Chapter Here" in a segment menu.
            </div>
          )}
          {sortedChapters.map((chapter) => {
            const segmentCount = Number.isFinite(chapter.segmentCount) ? chapter.segmentCount : 0;
            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => onJumpToChapter(chapter.id)}
                title={chapter.summary ? renderSummary(chapter) : undefined}
                className={cn(
                  "block w-full min-w-0 max-w-full rounded-md px-2 py-2 text-left transition-colors",
                  chapter.id === selectedChapterId ? "bg-accent/40" : "hover:bg-muted/40",
                )}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold leading-snug whitespace-normal [overflow-wrap:anywhere]">
                      {chapter.title}
                    </div>

                    {chapter.summary ? (
                      <div
                        className="mt-0.5 text-[11px] text-muted-foreground truncate"
                        title={renderSummary(chapter)}
                      >
                        {renderSummary(chapter)}
                      </div>
                    ) : null}
                  </div>

                  <div className="self-start shrink-0 whitespace-nowrap text-[11px] font-normal text-muted-foreground">
                    ({segmentCount})
                    {chapter.rewrittenText ? <span className="ml-1 text-amber-500">*</span> : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
