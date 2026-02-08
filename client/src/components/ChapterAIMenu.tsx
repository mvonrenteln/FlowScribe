import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ChapterAIMenuProps {
  readonly chapterId: string;
  readonly onRewriteChapter: (chapterId: string) => void;
  readonly className?: string;
}

/**
 * ChapterAIMenu
 *
 * Quick-access AI actions for a chapter header.
 */
export function ChapterAIMenu({
  chapterId,
  onRewriteChapter,
  className,
}: Readonly<ChapterAIMenuProps>) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-6 w-6 transition-opacity focus-visible:ring-0", className)}
          onClick={(event) => event.stopPropagation()}
          aria-label="Chapter AI actions"
          data-testid={`button-chapter-ai-${chapterId}`}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent focus-visible:outline-none"
          onClick={(event) => {
            event.stopPropagation();
            onRewriteChapter(chapterId);
            setOpen(false);
          }}
          data-testid={`menu-rewrite-chapter-${chapterId}`}
        >
          <Sparkles className="h-3 w-3" />
          Rewrite chapter
        </button>
      </PopoverContent>
    </Popover>
  );
}
