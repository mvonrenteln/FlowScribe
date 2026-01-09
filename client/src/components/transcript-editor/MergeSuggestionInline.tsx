import { Check, GitMerge, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Segment } from "@/lib/store";
import type { AISegmentMergeSuggestion } from "@/lib/store/types";

interface MergeSuggestionInlineProps {
  suggestion: AISegmentMergeSuggestion;
  firstSegment: Segment;
  secondSegment: Segment;
  onAccept: () => void;
  onReject: () => void;
}

export function MergeSuggestionInline({
  suggestion,
  firstSegment,
  secondSegment,
  onAccept,
  onReject,
}: MergeSuggestionInlineProps) {
  const mergedText = suggestion.smoothedText ?? suggestion.mergedText;
  const hasSmoothing =
    Boolean(suggestion.smoothedText) && suggestion.smoothedText !== suggestion.mergedText;

  return (
    <div
      className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-900/20"
      data-testid={`merge-suggestion-${suggestion.id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
          <GitMerge className="h-3.5 w-3.5" />
          Merge suggestion
          <span className="text-muted-foreground">
            Gap {suggestion.timeGap.toFixed(2)}s • {Math.round(suggestion.confidenceScore * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={(event) => {
              event.stopPropagation();
              onAccept();
            }}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={(event) => {
              event.stopPropagation();
              onReject();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        {firstSegment.speaker} → {secondSegment.speaker} • {firstSegment.start.toFixed(2)}s -{" "}
        {secondSegment.end.toFixed(2)}s
      </div>

      <div className="mt-2 space-y-2">
        <div className="text-xs text-muted-foreground">
          Before: “{firstSegment.text}” + “{secondSegment.text}”
        </div>
        <div className="font-medium text-amber-900 dark:text-amber-100">
          {hasSmoothing ? "Smoothed merge" : "Merged text"}: “{mergedText}”
        </div>
        {hasSmoothing && suggestion.smoothingChanges && (
          <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
            <Sparkles className="h-3 w-3" />
            {suggestion.smoothingChanges}
          </div>
        )}
        {suggestion.reason && (
          <div className="text-xs text-muted-foreground italic">{suggestion.reason}</div>
        )}
      </div>
    </div>
  );
}
