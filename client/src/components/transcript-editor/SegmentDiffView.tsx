/**
 * Segment Diff View
 *
 * Side-by-side comparison of original and revised text.
 * Shows changes with color highlighting and animations.
 */

import { Check, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { type DiffSegment, getOriginalDiffSegments, getRevisedDiffSegments } from "@/lib/diffUtils";
import { cn } from "@/lib/utils";

interface SegmentDiffViewProps {
  originalText: string;
  revisedText: string;
  changeSummary?: string;
  onAccept: () => void;
  onReject: () => void;
}

export function SegmentDiffView({
  originalText,
  revisedText,
  changeSummary,
  onAccept,
  onReject,
}: SegmentDiffViewProps) {
  const { t } = useTranslation();
  const [showDiff, setShowDiff] = useState(true);
  const [animationState, setAnimationState] = useState<"idle" | "accepting">("idle");

  const originalSegments = getOriginalDiffSegments(originalText, revisedText);
  const revisedSegments = getRevisedDiffSegments(originalText, revisedText);

  const handleAccept = useCallback(() => {
    setAnimationState("accepting");
    // Small delay for animation before calling the actual handler
    setTimeout(() => {
      onAccept();
    }, 200);
  }, [onAccept]);

  const handleReject = useCallback(() => {
    // Call reject immediately - no animation delay needed
    onReject();
  }, [onReject]);

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden bg-muted/30 transition-all duration-200",
        animationState === "accepting" &&
          "scale-[0.98] opacity-0 border-green-500 bg-green-50 dark:bg-green-950/20",
      )}
    >
      {/* Header with actions */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowDiff(!showDiff)}
        >
          {showDiff ? t("diffView.showCompact") : t("diffView.showDiff")}
        </button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
            onClick={handleReject}
            disabled={animationState !== "idle"}
          >
            <X className="h-4 w-4 mr-1" />
            {t("diffView.reject")}
          </Button>
          <Button
            variant="default"
            size="sm"
            className={cn(
              "h-7 px-2 transition-all",
              animationState === "accepting" && "scale-110 bg-green-600",
            )}
            onClick={handleAccept}
            disabled={animationState !== "idle"}
          >
            <Check className="h-4 w-4 mr-1" />
            {t("diffView.accept")}
          </Button>
        </div>
      </div>

      {showDiff ? (
        /* Side-by-side diff view */
        <div className="grid grid-cols-2 divide-x">
          {/* Original */}
          <div
            className={cn("p-3 transition-opacity", animationState === "accepting" && "opacity-50")}
          >
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              {t("diffView.original")}
            </div>
            <div className="text-sm leading-relaxed">
              <DiffText segments={originalSegments} type="original" />
            </div>
          </div>

          {/* Revised */}
          <div
            className={cn(
              "p-3 transition-all",
              animationState === "accepting" && "bg-green-50 dark:bg-green-950/20",
            )}
          >
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              {t("diffView.revised")}
            </div>
            <div className="text-sm leading-relaxed">
              <DiffText segments={revisedSegments} type="revised" />
            </div>
          </div>
        </div>
      ) : (
        /* Compact view - just show revised text with summary */
        <div className="p-3">
          <p className="text-sm leading-relaxed">{revisedText}</p>
          {changeSummary && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted">
                💡 {changeSummary}
              </span>
            </div>
          )}
        </div>
      )}
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

/**
 * Compact revision indicator for segment header
 */
interface RevisionIndicatorProps {
  hasPendingRevision: boolean;
  changeSummary?: string;
  onClick?: () => void;
}

export function RevisionIndicator({
  hasPendingRevision,
  changeSummary,
  onClick,
}: RevisionIndicatorProps) {
  if (!hasPendingRevision) return null;

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
        "bg-amber-100 dark:bg-amber-900/30",
        "text-amber-800 dark:text-amber-200",
        "hover:bg-amber-200 dark:hover:bg-amber-900/50",
        "transition-colors",
      )}
      onClick={onClick}
    >
      ✨ {changeSummary ?? t("diffView.changeSuggested")}
    </button>
  );
}
