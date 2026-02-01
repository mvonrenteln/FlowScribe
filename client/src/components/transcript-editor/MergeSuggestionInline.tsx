import { Check, CheckCheck, GitMerge, Sparkles, X } from "lucide-react";
import { MergeSuggestionDiff } from "@/components/merge/MergeSuggestionDiff";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDurationMs } from "@/lib/formatting";
import type { Segment } from "@/lib/store";
import type { AISegmentMergeSuggestion } from "@/lib/store/types";

interface MergeSuggestionInlineProps {
  suggestion: AISegmentMergeSuggestion;
  firstSegment: Segment;
  secondSegment: Segment;
  onAccept: () => void;
  onAcceptWithoutSmoothing: () => void;
  onReject: () => void;
}

export function MergeSuggestionInline({
  suggestion,
  firstSegment,
  secondSegment,
  onAccept,
  onAcceptWithoutSmoothing,
  onReject,
}: MergeSuggestionInlineProps) {
  const mergedText = suggestion.smoothedText ?? suggestion.mergedText;
  const hasSmoothing =
    Boolean(suggestion.smoothedText) && suggestion.smoothedText !== suggestion.mergedText;
  const combinedText = `${firstSegment.text} ${secondSegment.text}`.trim();
  const boundaryIndex = firstSegment.text.length;
  const AcceptIcon = hasSmoothing ? CheckCheck : Check;

  return (
    <div
      className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-900/20"
      data-testid={`merge-suggestion-${suggestion.id}`}
      data-merge-suggestion="true"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
          <GitMerge className="h-3.5 w-3.5" />
          Merge suggestion
          <span className="text-muted-foreground">
            Gap {formatDurationMs(Math.round(suggestion.timeGap * 1000))} •{" "}
            {Math.round(suggestion.confidenceScore * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>
                <p>Reject this merge suggestion</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {hasSmoothing && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAcceptWithoutSmoothing();
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Accept the merge without smoothing</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className="h-7 px-2"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAccept();
                  }}
                >
                  <AcceptIcon className="mr-1 h-3.5 w-3.5" />
                  Accept
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{hasSmoothing ? "Accept the smoothed merge text" : "Accept this merge"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        {firstSegment.speaker} → {secondSegment.speaker} •{" "}
        {formatDurationMs(Math.round(firstSegment.start * 1000))} -{" "}
        {formatDurationMs(Math.round(secondSegment.end * 1000))}
      </div>

      <div className="mt-2 space-y-2">
        <MergeSuggestionDiff
          originalText={combinedText}
          suggestedText={mergedText}
          originalLabel="Original"
          suggestedLabel={hasSmoothing ? "Smoothed" : "Merged"}
          boundaryIndex={boundaryIndex}
          allowSideBySide={hasSmoothing}
        />
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
