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
      <ScrollArea className="h-[60vh] no-scrollbar">
        <div className="space-y-1 p-2 overflow-hidden">
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
                  "w-full rounded-md px-2 py-2 text-left transition-colors",
                  chapter.id === selectedChapterId ? "bg-accent/40" : "hover:bg-muted/40",
                )}
              >
                <div className="relative text-xs">
  {/* Right-side markers that must never overflow */}
  <div className="absolute right-0 top-0 flex items-baseline gap-1">
    <span className="text-[11px] font-normal text-muted-foreground">
      ({segmentCount})
    </span>

    {chapter.rewrittenText ? (
      <span className="text-[11px] text-amber-500" title="AI rewritten" aria-label="AI rewritten">
        *
      </span>
    ) : null}
  </div>

  {/* Title: reserve space on the right so it never goes underneath markers */}
  <div className="pr-10 font-semibold whitespace-normal break-words [overflow-wrap:anywhere] leading-snug">
    {chapter.title}
  </div>
</div>

                {chapter.summary ? (
                  <div
                    className="text-[11px] text-muted-foreground truncate"
                    title={renderSummary(chapter)}
                  >
                    {renderSummary(chapter)}
                  </div>
                ) : null}
                {chapter.tags && chapter.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {chapter.tags.map((tagId) => {
                      const label = tagsById.get(tagId) ?? tagId;
                      return (
                        <span
                          key={tagId}
                          className="rounded-full border border-border/80 bg-muted/60 px-1 py-0.5 text-[8px] text-muted-foreground"
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
