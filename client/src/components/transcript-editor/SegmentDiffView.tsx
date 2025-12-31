/**
 * Segment Diff View
 *
 * Side-by-side comparison of original and revised text.
 * Shows changes with color highlighting.
 */

import { Check, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getOriginalDiffSegments, getRevisedDiffSegments, type DiffSegment } from "@/lib/diffUtils";
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
  const [showDiff, setShowDiff] = useState(true);

  const originalSegments = getOriginalDiffSegments(originalText, revisedText);
  const revisedSegments = getRevisedDiffSegments(originalText, revisedText);

  return (
    <div className="border rounded-lg overflow-hidden bg-muted/30">
      {/* Header with actions */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowDiff(!showDiff)}
        >
          {showDiff ? "Kompakt anzeigen" : "Diff anzeigen"}
        </button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onReject}
          >
            <X className="h-4 w-4 mr-1" />
            Ablehnen
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-7 px-2"
            onClick={onAccept}
          >
            <Check className="h-4 w-4 mr-1" />
            Übernehmen
          </Button>
        </div>
      </div>

      {showDiff ? (
        /* Side-by-side diff view */
        <div className="grid grid-cols-2 divide-x">
          {/* Original */}
          <div className="p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Original
            </div>
            <div className="text-sm leading-relaxed">
              <DiffText segments={originalSegments} type="original" />
            </div>
          </div>

          {/* Revised */}
          <div className="p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Überarbeitet
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
      ✨ {changeSummary ?? "Änderung vorgeschlagen"}
    </button>
  );
}

