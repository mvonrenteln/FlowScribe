import { type DiffSegment, getOriginalDiffSegments, getRevisedDiffSegments } from "@/lib/diffUtils";
import { cn } from "@/lib/utils";

interface MergeSuggestionDiffProps {
  originalText: string;
  suggestedText: string;
  originalLabel?: string;
  suggestedLabel?: string;
  className?: string;
}

export function MergeSuggestionDiff({
  originalText,
  suggestedText,
  originalLabel = "Original",
  suggestedLabel = "Proposed",
  className,
}: MergeSuggestionDiffProps) {
  const originalSegments = getOriginalDiffSegments(originalText, suggestedText);
  const revisedSegments = getRevisedDiffSegments(originalText, suggestedText);

  return (
    <div className={cn("border rounded-lg overflow-hidden bg-muted/30", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
        <div className="p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            {originalLabel}
          </div>
          <div className="text-sm leading-relaxed">
            <DiffText segments={originalSegments} type="original" />
          </div>
        </div>
        <div className="p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            {suggestedLabel}
          </div>
          <div className="text-sm leading-relaxed">
            <DiffText segments={revisedSegments} type="revised" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface DiffTextProps {
  segments: DiffSegment[];
  type: "original" | "revised";
}

function DiffText({ segments, type }: DiffTextProps) {
  return (
    <>
      {segments.map((segment, index) => {
        const key = `${index}-${segment.type}`;

        if (segment.type === "equal") {
          return <span key={key}>{segment.text}</span>;
        }

        if (segment.type === "delete" && type === "original") {
          return (
            <span
              key={key}
              className={cn(
                "bg-red-100 dark:bg-red-900/30",
                "text-red-800 dark:text-red-200",
                "line-through decoration-red-500/50",
                "px-0.5 rounded-sm",
              )}
            >
              {segment.text}
            </span>
          );
        }

        if (segment.type === "insert" && type === "revised") {
          return (
            <span
              key={key}
              className={cn(
                "bg-green-100 dark:bg-green-900/30",
                "text-green-800 dark:text-green-200",
                "px-0.5 rounded-sm",
              )}
            >
              {segment.text}
            </span>
          );
        }

        return null;
      })}
    </>
  );
}
