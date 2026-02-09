/**
 * RewrittenParagraph Component
 *
 * Displays a single paragraph of rewritten text with edit capability.
 * Follows the same UX pattern as TranscriptSegment (double-click to edit).
 */

import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RewrittenParagraphProps {
  /** Paragraph text content */
  text: string;
  /** Called when text is changed */
  onTextChange: (text: string) => void;
  /** Whether this paragraph is currently selected */
  isSelected?: boolean;
  /** Called when paragraph is selected */
  onSelect?: () => void;
  /** Search matches to highlight */
  searchMatches?: Array<{ start: number; end: number; match: string }>;
  /** Called when paragraph should be refined */
  onRefine?: () => void;
  /** Whether this paragraph is currently refining */
  isRefining?: boolean;
  /** Disable refine action */
  refineDisabled?: boolean;
}

/**
 * Renders text with search highlights
 */
function renderTextWithHighlights(
  text: string,
  matches: Array<{ start: number; end: number; match: string }>,
) {
  if (matches.length === 0) {
    return text;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    // Add text before match
    if (match.start > lastIndex) {
      parts.push(text.substring(lastIndex, match.start));
    }
    // Add highlighted match
    parts.push(
      <mark key={`match-${match.start}`} className="bg-yellow-200 dark:bg-yellow-900/50">
        {match.match}
      </mark>,
    );
    lastIndex = match.end;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

export function RewrittenParagraph({
  text,
  onTextChange,
  isSelected = false,
  onSelect,
  searchMatches = [],
  onRefine,
  isRefining = false,
  refineDisabled = false,
}: RewrittenParagraphProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(text);
  const [editHeight, setEditHeight] = useState<number | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  // Sync draft text when not editing
  useEffect(() => {
    if (!isEditing) {
      setDraftText(text);
    }
  }, [isEditing, text]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
    }
  }, [isEditing]);

  // Set textarea height to match view height
  useLayoutEffect(() => {
    if (!isEditing) return;
    const textarea = editInputRef.current;
    if (!textarea) return;
    if (editHeight) {
      textarea.style.height = `${editHeight}px`;
    }
  }, [editHeight, isEditing]);

  // Clear edit height when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditHeight(null);
    }
  }, [isEditing]);

  // Mark body as editing (for global shortcuts)
  useEffect(() => {
    if (!isEditing) return;
    const body = document.body;
    const previousValue = body.dataset.transcriptEditing;
    body.dataset.transcriptEditing = "true";
    return () => {
      if (previousValue === undefined) {
        delete body.dataset.transcriptEditing;
      } else {
        body.dataset.transcriptEditing = previousValue;
      }
    };
  }, [isEditing]);

  const handleStartEdit = useCallback(() => {
    setDraftText(text);
    const measuredHeight = viewRef.current?.offsetHeight ?? null;
    setEditHeight(measuredHeight && measuredHeight > 0 ? measuredHeight : null);
    setIsEditing(true);
  }, [text]);

  const handleSaveEdit = useCallback(() => {
    setIsEditing(false);
    onTextChange(draftText);
  }, [draftText, onTextChange]);

  const handleDraftChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftText(event.target.value);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraftText(text);
  }, [text]);

  const handleEditKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSaveEdit();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancelEdit();
      }
    },
    [handleCancelEdit, handleSaveEdit],
  );

  const clickTimeoutRef = useRef<number | null>(null);

  const handleParagraphClick = useCallback(() => {
    if (isEditing) return;

    // Clear any pending timeout from a previous click
    if (clickTimeoutRef.current !== null) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    // Delay the selection to allow double-click to cancel it
    clickTimeoutRef.current = window.setTimeout(() => {
      clickTimeoutRef.current = null;
      onSelect?.();
    }, 200);
  }, [isEditing, onSelect]);

  const handleParagraphDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (isEditing) return;

      // Cancel pending single-click action
      if (clickTimeoutRef.current !== null) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }

      event.preventDefault();
      event.stopPropagation();

      handleStartEdit();
    },
    [isEditing, handleStartEdit],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current !== null) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  if (isEditing) {
    return (
      <div className="group relative rounded border border-border bg-muted/50 p-3">
        <textarea
          ref={editInputRef}
          value={draftText}
          onChange={handleDraftChange}
          onKeyDown={handleEditKeyDown}
          className={cn(
            "w-full resize-none overflow-hidden rounded border-none bg-transparent",
            "font-sans text-sm leading-relaxed text-foreground",
            "focus:outline-none focus:ring-0",
          )}
          style={{
            minHeight: editHeight ? `${editHeight}px` : undefined,
          }}
        />

        <div className="mt-2 flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 px-2 text-xs">
            <X className="mr-1 h-3 w-3" />
            {t("rewrite.actions.cancel")}
          </Button>
          <Button size="sm" variant="default" onClick={handleSaveEdit} className="h-7 px-2 text-xs">
            <Check className="mr-1 h-3 w-3" />
            {t("rewrite.actions.save")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={viewRef}
      role="button"
      tabIndex={0}
      onClick={handleParagraphClick}
      onDoubleClick={handleParagraphDoubleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleParagraphClick();
        }
      }}
      className={cn(
        "group cursor-pointer rounded p-3 transition-colors",
        "hover:bg-muted/30",
        isSelected && "bg-muted/50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
          {searchMatches.length > 0 ? renderTextWithHighlights(text, searchMatches) : text}
        </p>
        {onRefine && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRefine();
            }}
            disabled={refineDisabled || isRefining}
            aria-label={t("rewrite.actions.refine")}
          >
            {isRefining ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
