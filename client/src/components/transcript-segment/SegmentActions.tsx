import {
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
  Edit,
  Merge,
  MoreVertical,
  Scissors,
  Trash2,
} from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AIRevisionPopover } from "../transcript-editor/AIRevisionPopover";

interface SegmentActionsProps {
  readonly segmentId: string;
  readonly isConfirmed: boolean;
  readonly isBookmarked: boolean;
  readonly canSplitAtCurrentWord: boolean;
  readonly resolvedSplitWordIndex: number;
  readonly selectedWordIndex: number | null;
  readonly hasSelectionForSplit: boolean;
  readonly showConfirmAction: boolean;
  readonly isEditing: boolean;
  readonly onConfirm: () => void;
  readonly onToggleBookmark: () => void;
  readonly onSplit?: (wordIndex: number) => void;
  readonly onMergeWithPrevious?: () => void;
  readonly onMergeWithNext?: () => void;
  readonly onDelete: () => void;
  readonly onStartEdit: () => void;
  readonly onClearSelection: () => void;
}

export function SegmentActions({
  segmentId,
  isConfirmed,
  isBookmarked,
  canSplitAtCurrentWord,
  resolvedSplitWordIndex,
  selectedWordIndex,
  hasSelectionForSplit,
  showConfirmAction,
  isEditing,
  onConfirm,
  onToggleBookmark,
  onSplit,
  onMergeWithPrevious,
  onMergeWithNext,
  onDelete,
  onStartEdit,
  onClearSelection,
}: SegmentActionsProps) {
  const restoreSegmentFocus = useCallback(() => {
    const segmentElement = document.querySelector(
      `[data-segment-id="${segmentId}"]`,
    ) as HTMLElement | null;
    if (!segmentElement) return;
    requestAnimationFrame(() => segmentElement.focus());
  }, [segmentId]);

  return (
    <div className="flex items-center gap-1">
      {showConfirmAction && (
        <Button
          size="icon"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            if (!isConfirmed) {
              onConfirm();
            }
          }}
          data-testid={`button-confirm-${segmentId}`}
          aria-label={isConfirmed ? "Segment confirmed" : "Confirm segment"}
          disabled={isConfirmed}
        >
          {isConfirmed ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        onClick={(event) => {
          event.stopPropagation();
          onToggleBookmark();
        }}
        data-testid={`button-bookmark-${segmentId}`}
        aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
      >
        {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      </Button>
      {onSplit && hasSelectionForSplit && selectedWordIndex !== null && (
        <Button
          size="icon"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            onSplit(selectedWordIndex);
            onClearSelection();
          }}
          data-testid={`button-split-${segmentId}`}
          aria-label="Split segment at selected word"
        >
          <Scissors className="h-4 w-4" />
        </Button>
      )}

      <AIRevisionPopover segmentId={segmentId} disabled={isEditing} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            onClick={(event) => event.stopPropagation()}
            data-testid={`button-segment-menu-${segmentId}`}
            aria-label="Segment options"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              onStartEdit();
              restoreSegmentFocus();
            }}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit text
            <span className="menu-shortcut-badge ml-auto">E</span>
          </DropdownMenuItem>
          {onSplit && (
            <DropdownMenuItem
              onSelect={() => {
                if (!canSplitAtCurrentWord) return;
                onSplit(resolvedSplitWordIndex);
                onClearSelection();
                restoreSegmentFocus();
              }}
              disabled={!canSplitAtCurrentWord}
            >
              <Scissors className="h-4 w-4 mr-2" />
              Split at current word
              <span className="menu-shortcut-badge ml-auto">S</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              if (isConfirmed) return;
              onConfirm();
              restoreSegmentFocus();
            }}
            disabled={isConfirmed}
          >
            <Check className="h-4 w-4 mr-2" />
            {isConfirmed ? "Confirmed" : "Confirm block"}
            <span className="menu-shortcut-badge ml-auto">C</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {onMergeWithPrevious && (
            <DropdownMenuItem
              onSelect={() => {
                onMergeWithPrevious();
                restoreSegmentFocus();
              }}
            >
              <Merge className="h-4 w-4 mr-2" />
              Merge with previous
              <span className="menu-shortcut-badge ml-auto">P</span>
            </DropdownMenuItem>
          )}
          {onMergeWithNext && (
            <DropdownMenuItem
              onSelect={() => {
                onMergeWithNext();
                restoreSegmentFocus();
              }}
            >
              <Merge className="h-4 w-4 mr-2" />
              Merge with next
              <span className="menu-shortcut-badge ml-auto">M</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              onDelete();
              restoreSegmentFocus();
            }}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete segment
            <span className="menu-shortcut-badge ml-auto">Del</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
