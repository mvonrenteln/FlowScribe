import { Check, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDurationMs } from "@/lib/formatting";
import type { Segment, Tag } from "@/lib/store";
import type { AIChapterSuggestion } from "@/lib/store/types";

interface ChapterSuggestionInlineProps {
  suggestion: AIChapterSuggestion;
  startSegment?: Segment;
  endSegment?: Segment;
  tags: Tag[];
  onAccept: () => void;
  onReject: () => void;
}

/**
 * Inline preview card for AI chapter suggestions with accept/reject controls.
 */
export function ChapterSuggestionInline({
  suggestion,
  startSegment,
  endSegment,
  tags,
  onAccept,
  onReject,
}: ChapterSuggestionInlineProps) {
  const tagLookup = new Map(tags.map((tag) => [tag.id, tag]));
  const suggestionTags = (suggestion.tags ?? []).map((tagId) => {
    const tag = tagLookup.get(tagId);
    return { id: tagId, label: tag?.name ?? tagId, color: tag?.color };
  });

  const timeRangeLabel =
    startSegment && endSegment
      ? `${formatDurationMs(Math.round(startSegment.start * 1000))} - ${formatDurationMs(
          Math.round(endSegment.end * 1000),
        )}`
      : undefined;

  return (
    <div
      className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-900/20"
      data-testid={`chapter-suggestion-${suggestion.id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
          <Sparkles className="h-3.5 w-3.5" />
          Chapter suggestion
          {timeRangeLabel && (
            <span className="text-muted-foreground">
              {timeRangeLabel} • {suggestion.segmentCount} segments
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(event) => {
              event.stopPropagation();
              onReject();
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Reject
          </Button>
          <Button
            size="sm"
            className="h-7 px-2"
            onClick={(event) => {
              event.stopPropagation();
              onAccept();
            }}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            Accept
          </Button>
        </div>
      </div>

      <div className="mt-2 space-y-2">
        <div className="text-sm font-medium">{suggestion.title || "Untitled chapter"}</div>
        {suggestion.summary && (
          <div className="text-xs text-muted-foreground">{suggestion.summary}</div>
        )}
        {suggestionTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {suggestionTags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="h-5 px-2 text-[11px]"
                style={
                  tag.color ? { borderLeftWidth: "3px", borderLeftColor: tag.color } : undefined
                }
              >
                {tag.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
