import { useState } from "react";
import {
  computeDiff,
  type DiffSegment,
  getOriginalDiffSegments,
  getRevisedDiffSegments,
} from "@/lib/diffUtils";
import { cn } from "@/lib/utils";

interface MergeSuggestionDiffProps {
  originalText: string;
  suggestedText: string;
  originalLabel?: string;
  suggestedLabel?: string;
  boundaryIndex?: number;
  allowSideBySide?: boolean;
  className?: string;
}

export function MergeSuggestionDiff({
  originalText,
  suggestedText,
  originalLabel = "Original",
  suggestedLabel = "Proposed",
  boundaryIndex,
  allowSideBySide = true,
  className,
}: MergeSuggestionDiffProps) {
  const [showSideBySide, setShowSideBySide] = useState(true);
  const originalSegments = getOriginalDiffSegments(originalText, suggestedText);
  const revisedSegments = getRevisedDiffSegments(originalText, suggestedText);
  const compactSegments = computeDiff(originalText, suggestedText);
  const canToggle = allowSideBySide;
  const useSideBySide = allowSideBySide && showSideBySide;

  return (
    <div className={cn("border rounded-lg overflow-hidden bg-muted/30", className)}>
      {canToggle && (
        <div className="flex items-center justify-end px-3 py-2 border-b bg-muted/40">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowSideBySide((prev) => !prev)}
          >
            {useSideBySide ? "Compact view" : "Side-by-side view"}
          </button>
        </div>
      )}

      {useSideBySide ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
          <div className="p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              {originalLabel}
            </div>
            <div className="text-sm leading-relaxed">
              <DiffText segments={originalSegments} type="original" boundaryIndex={boundaryIndex} />
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
      ) : (
        <div className="p-3 text-sm leading-relaxed">
          {allowSideBySide ? (
            <InlineDiffText segments={compactSegments} boundaryIndex={boundaryIndex} />
          ) : (
            <BoundaryText text={originalText} boundaryIndex={boundaryIndex} />
          )}
        </div>
      )}
    </div>
  );
}

interface DiffTextProps {
  segments: DiffSegment[];
  type: "original" | "revised";
  boundaryIndex?: number;
}

function DiffText({ segments, type, boundaryIndex }: DiffTextProps) {
  return <>{renderDiffSegments(segments, type, boundaryIndex)}</>;
}

interface InlineDiffTextProps {
  segments: DiffSegment[];
  boundaryIndex?: number;
}

function InlineDiffText({ segments, boundaryIndex }: InlineDiffTextProps) {
  return <>{renderInlineSegments(segments, boundaryIndex)}</>;
}

interface BoundaryTextProps {
  text: string;
  boundaryIndex?: number;
}

function BoundaryText({ text, boundaryIndex }: BoundaryTextProps) {
  const split = splitByBoundary(text, boundaryIndex);
  if (!split) return <span>{text}</span>;

  return (
    <>
      <span>{split.before}</span>
      <BoundaryMarker />
      <span>{split.after}</span>
    </>
  );
}

function BoundaryMarker() {
  return (
    <span className="mx-1 text-muted-foreground" aria-hidden="true">
      |
    </span>
  );
}

function splitByBoundary(text: string, boundaryIndex?: number) {
  if (!boundaryIndex || boundaryIndex <= 0 || boundaryIndex >= text.length) {
    return null;
  }
  return {
    before: text.slice(0, boundaryIndex).trimEnd(),
    after: text.slice(boundaryIndex).trimStart(),
  };
}

function renderSegmentText(segment: DiffSegment, type: "original" | "revised", key: string) {
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
}

function renderDiffSegments(
  segments: DiffSegment[],
  type: "original" | "revised",
  boundaryIndex?: number,
) {
  if (type !== "original" || boundaryIndex === undefined) {
    return segments.map((segment, index) =>
      renderSegmentText(segment, type, `${index}-${segment.type}`),
    );
  }

  const nodes: JSX.Element[] = [];
  let consumed = 0;
  let markerInserted = false;

  segments.forEach((segment, index) => {
    const keyBase = `${index}-${segment.type}`;
    const textLength = segment.text.length;

    if (!markerInserted && consumed >= boundaryIndex) {
      nodes.push(<BoundaryMarker key={`boundary-${keyBase}`} />);
      markerInserted = true;
    }

    if (!markerInserted && consumed + textLength >= boundaryIndex) {
      const splitIndex = boundaryIndex - consumed;
      const beforeText = segment.text.slice(0, Math.max(0, splitIndex));
      const afterText = segment.text.slice(Math.max(0, splitIndex));

      if (beforeText) {
        nodes.push(
          renderSegmentText({ ...segment, text: beforeText }, type, `${keyBase}-a`) as JSX.Element,
        );
      }

      nodes.push(<BoundaryMarker key={`boundary-${keyBase}`} />);
      markerInserted = true;

      if (afterText) {
        nodes.push(
          renderSegmentText({ ...segment, text: afterText }, type, `${keyBase}-b`) as JSX.Element,
        );
      }
    } else {
      const rendered = renderSegmentText(segment, type, keyBase);
      if (rendered) nodes.push(rendered);
    }

    consumed += textLength;
  });

  if (!markerInserted && boundaryIndex <= consumed) {
    nodes.push(<BoundaryMarker key="boundary-end" />);
  }

  return nodes;
}

function renderInlineSegments(segments: DiffSegment[], boundaryIndex?: number) {
  const nodes: JSX.Element[] = [];
  let consumed = 0;
  let markerInserted = false;

  segments.forEach((segment, index) => {
    const keyBase = `inline-${index}-${segment.type}`;
    const advance = segment.type === "insert" ? 0 : segment.text.length;

    if (!markerInserted && boundaryIndex !== undefined && consumed >= boundaryIndex) {
      nodes.push(<BoundaryMarker key={`boundary-${keyBase}`} />);
      markerInserted = true;
    }

    if (!markerInserted && boundaryIndex !== undefined && consumed + advance >= boundaryIndex) {
      const splitIndex = boundaryIndex - consumed;
      const beforeText = segment.type === "insert" ? "" : segment.text.slice(0, splitIndex);
      const afterText = segment.type === "insert" ? segment.text : segment.text.slice(splitIndex);

      if (beforeText) {
        nodes.push(
          renderInlineSegment({ ...segment, text: beforeText }, `${keyBase}-a`) as JSX.Element,
        );
      }

      nodes.push(<BoundaryMarker key={`boundary-${keyBase}`} />);
      markerInserted = true;

      if (afterText) {
        nodes.push(
          renderInlineSegment({ ...segment, text: afterText }, `${keyBase}-b`) as JSX.Element,
        );
      }
    } else {
      const rendered = renderInlineSegment(segment, keyBase);
      if (rendered) nodes.push(rendered);
    }

    consumed += advance;
  });

  if (!markerInserted && boundaryIndex !== undefined && boundaryIndex <= consumed) {
    nodes.push(<BoundaryMarker key="boundary-end" />);
  }

  return nodes;
}

function renderInlineSegment(segment: DiffSegment, key: string) {
  if (segment.type === "equal") {
    return <span key={key}>{segment.text}</span>;
  }

  if (segment.type === "delete") {
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

  if (segment.type === "insert") {
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
}
