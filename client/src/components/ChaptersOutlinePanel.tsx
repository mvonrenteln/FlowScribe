import { X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
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
  const chapterButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const sortedChapters = useMemo(
    () => sortChaptersByStart(chapters, indexById),
    [chapters, indexById],
  );
  const tagsById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

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

  useEffect(() => {
    if (!open || !selectedChapterId) return;
    const selectedButton = chapterButtonRefs.current.get(selectedChapterId);
    selectedButton?.scrollIntoView({ block: "nearest" });
  }, [open, selectedChapterId]);

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
            const summary = chapter.summary ? renderSummary(chapter) : "";
            const chapterTags = (chapter.tags ?? [])
              .map((tagId) => tagsById.get(tagId))
              .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
            return (
              <button
                key={chapter.id}
                ref={(element) => {
                  if (element) {
                    chapterButtonRefs.current.set(chapter.id, element);
                    return;
                  }
                  chapterButtonRefs.current.delete(chapter.id);
                }}
                type="button"
                onClick={() => onJumpToChapter(chapter.id)}
                title={summary || undefined}
                aria-current={chapter.id === selectedChapterId ? "true" : undefined}
                className={cn(
                  "block w-full min-w-0 max-w-full rounded-md border px-2 py-2 text-left transition-colors",
                  chapter.id === selectedChapterId
                    ? "border-primary/40 bg-primary/15 shadow-sm ring-1 ring-primary/40"
                    : "border-transparent hover:bg-muted/40",
                )}
              >
                {/**
                 * IMPORTANT LAYOUT NOTE
                 *
                 * ⚠️ DO NOT SIMPLIFY THIS LAYOUT ⚠️
                 * Removing this will reintroduce a hard-to-debug visual clipping bug.
                 *
                 * Title + summary MUST live in the left grid column (minmax(0, 1fr)),
                 * metadata (segment count / rewritten marker) MUST live in the right auto column.
                 *
                 * Reason:
                 * - The summary uses `truncate` (white-space: nowrap).
                 * - Radix ScrollArea clips content aggressively on the right.
                 * - If metadata is part of the same flow as title/summary, it gets clipped
                 *   or pushed out of view as soon as the summary is present.
                 *
                 * This grid split is intentional and prevents a subtle overflow/clip bug.
                 * Do NOT merge columns or move metadata into the text flow.
                 */}
                <div
                  data-testid="chapter-row-grid"
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold leading-snug whitespace-normal [overflow-wrap:anywhere]">
                      {chapter.title}
                    </div>

                    {summary ? (
                      <div
                        className="mt-0.5 min-w-0 text-[11px] text-muted-foreground truncate [overflow-wrap:anywhere]"
                        title={summary}
                      >
                        {summary}
                      </div>
                    ) : null}
                  </div>

                  <div className="self-start shrink-0 whitespace-nowrap text-[11px] font-normal text-muted-foreground">
                    ({segmentCount})
                    {chapter.rewrittenText ? (
                      <span className="ml-1 text-amber-500" title="AI rewritten">
                        *
                      </span>
                    ) : null}
                  </div>
                </div>

                {chapterTags.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {chapterTags.map((tag) => (
                      <Badge key={tag.id} variant="secondary" className="text-[10px] px-1.5 py-0.5">
                        {tag.name}
                      </Badge>
                    ))}
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
