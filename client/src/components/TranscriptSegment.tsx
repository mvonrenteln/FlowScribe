import { Check, Sparkles, X } from "lucide-react";
import { memo, useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CHAPTER_DRAG_TYPE } from "@/lib/dragTypes";
import { mark } from "@/lib/logging";
import type { SearchMatch, Segment, Speaker, Tag } from "@/lib/store";
import type { SeekMeta } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { SegmentDiffView } from "./transcript-editor/SegmentDiffView";
import { SegmentActions } from "./transcript-segment/SegmentActions";
import { SegmentHeader } from "./transcript-segment/SegmentHeader";
import { SegmentStatusBar } from "./transcript-segment/SegmentStatusBar";
import { useSegmentEditing } from "./transcript-segment/useSegmentEditing";
import { WordList } from "./transcript-segment/WordList";

interface TranscriptSegmentProps {
  readonly segment: Segment;
  readonly speakers: Speaker[];
  readonly tags?: Tag[];
  readonly isSelected: boolean;
  readonly isActive: boolean;
  readonly activeWordIndex?: number;
  readonly splitWordIndex?: number;
  readonly highlightLowConfidence?: boolean;
  readonly lowConfidenceThreshold?: number | null;
  readonly lexiconMatches?: Map<number, { term: string; score: number; partIndex?: number }>;
  readonly showLexiconMatches?: boolean;
  readonly lexiconHighlightUnderline?: boolean;
  readonly lexiconHighlightBackground?: boolean;
  readonly spellcheckMatches?: Map<number, { suggestions: string[]; partIndex?: number }>;
  readonly showSpellcheckMatches?: boolean;
  readonly currentMatch?: SearchMatch;
  readonly editRequested?: boolean;
  readonly onEditRequestHandled?: () => void;
  readonly onSelect: () => void;
  readonly onSelectOnly?: () => void;
  readonly onTextChange: (text: string) => void;
  readonly onSpeakerChange: (speaker: string) => void;
  readonly onSplit: (wordIndex: number) => void;
  readonly onConfirm: () => void;
  readonly onToggleBookmark: () => void;
  readonly onRemoveTag?: (tagId: string) => void;
  readonly onAddTag?: (tagId: string) => void;
  readonly onIgnoreLexiconMatch?: (term: string, value: string) => void;
  readonly onIgnoreSpellcheckMatch?: (value: string) => void;
  readonly onAddSpellcheckToGlossary?: (value: string) => void;
  readonly showConfirmAction?: boolean;
  readonly onMergeWithPrevious?: () => void;
  readonly onMergeWithNext?: () => void;
  readonly onDelete: () => void;
  readonly onStartChapterHere?: (segmentId: string) => void;
  readonly onSeek: (time: number, meta: SeekMeta) => void;
  readonly searchQuery?: string;
  readonly isRegexSearch?: boolean;
  readonly replaceQuery?: string;
  readonly onReplaceCurrent?: () => void;
  readonly onMatchClick?: (index: number) => void;
  readonly findMatchIndex?: (segmentId: string, startIndex: number) => number;
  readonly onChapterDrop?: (chapterId: string, targetSegmentId: string) => void;
  /** Pending AI revision for this segment */
  readonly pendingRevision?: {
    revisedText: string;
    changeSummary?: string;
  };
  readonly onAcceptRevision?: () => void;
  readonly onRejectRevision?: () => void;
  /** Last AI revision result for inline feedback */
  readonly lastRevisionResult?: {
    status: "success" | "no-changes" | "error";
    message?: string;
    timestamp: number;
  } | null;
  /** Pending AI speaker suggestion for this segment */
  readonly pendingSpeakerSuggestion?: {
    suggestedSpeaker: string;
    confidence?: number;
    reason?: string;
  };
  readonly onAcceptSpeakerSuggestion?: () => void;
  readonly onRejectSpeakerSuggestion?: () => void;
}

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(",");

/**
 * Collect focusable elements within a segment to allow cycling Tab focus locally.
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => {
      if (element.tabIndex < 0) return false;
      if (element.getAttribute("aria-hidden") === "true") return false;
      return !element.hasAttribute("disabled");
    },
  );
  if (container.tabIndex >= 0 && !container.hasAttribute("disabled")) {
    elements.unshift(container);
  }
  return elements;
}

function TranscriptSegmentComponent({
  segment,
  speakers,
  tags = [],
  isSelected,
  isActive,
  activeWordIndex,
  splitWordIndex,
  highlightLowConfidence = false,
  lowConfidenceThreshold = null,
  lexiconMatches,
  showLexiconMatches = false,
  lexiconHighlightUnderline = false,
  lexiconHighlightBackground = false,
  spellcheckMatches,
  showSpellcheckMatches = false,
  currentMatch,
  editRequested = false,
  onEditRequestHandled,
  onSelect,
  onSelectOnly,
  onTextChange,
  onSpeakerChange,
  onSplit,
  onConfirm,
  onToggleBookmark,
  onRemoveTag,
  onAddTag,
  onIgnoreLexiconMatch,
  onIgnoreSpellcheckMatch,
  onAddSpellcheckToGlossary,
  showConfirmAction = true,
  onMergeWithPrevious,
  onMergeWithNext,
  onDelete,
  onStartChapterHere,
  onSeek,
  searchQuery,
  isRegexSearch,
  replaceQuery,
  onReplaceCurrent,
  onMatchClick,
  findMatchIndex,
  onChapterDrop,
  pendingRevision,
  onAcceptRevision,
  onRejectRevision,
  lastRevisionResult,
  pendingSpeakerSuggestion,
  onAcceptSpeakerSuggestion,
  onRejectSpeakerSuggestion,
}: TranscriptSegmentProps) {
  // Ensure `onSelectOnly` is recognized as used by linters (it's forwarded to
  // `WordList` below). This no-op reference prevents "unused parameter" warnings.
  void onSelectOnly;
  const segmentRef = useRef<HTMLElement>(null);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [isChapterDragOver, setIsChapterDragOver] = useState(false);
  if (import.meta.env.DEV) {
    try {
      const key = `render-segment-${segment.id}`;
      const w = window as Window & { __renderCounts?: Record<string, number> };
      w.__renderCounts = w.__renderCounts || {};
      w.__renderCounts[key] = (w.__renderCounts[key] || 0) + 1;
      // mark every 50 renders for visibility
      if (w.__renderCounts[key] % 50 === 0) {
        mark("segment-render", { segmentId: segment.id, count: w.__renderCounts[key] });
      }
    } catch {}
  }
  const [spellcheckExpandedIndex, setSpellcheckExpandedIndex] = useState<number | null>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);

  const {
    draftText,
    editInputRef,
    handleCancelEdit,
    handleEditKeyDown,
    handleSaveEdit,
    handleSegmentClick,
    handleSegmentDoubleClick,
    handleSelectKeyDown,
    handleStartEdit,
    handleDraftChange,
    editHeight,
    isEditing,
  } = useSegmentEditing({
    segment,
    editRequested,
    onEditRequestHandled,
    onTextChange,
    onSelect,
    getViewHeight: () => textDisplayRef.current?.getBoundingClientRect().height ?? null,
  });

  const speaker = speakers.find((s) => s.name === segment.speaker);
  const speakerColor = speaker?.color || "hsl(217, 91%, 48%)";

  const resolvedActiveWordIndex = isActive ? (activeWordIndex ?? -1) : -1;
  const resolvedSplitWordIndex = isActive ? (splitWordIndex ?? -1) : -1;
  const canSplitAtCurrentWord = resolvedSplitWordIndex > 0;
  const hasSelectionForSplit = selectedWordIndex !== null && selectedWordIndex > 0;
  const isConfirmed = segment.confirmed === true;
  const isBookmarked = segment.bookmarked === true;
  const handleSegmentKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Tab") {
        const container = segmentRef.current;
        if (!container) return;
        const focusableElements = getFocusableElements(container);
        if (focusableElements.length === 0) return;
        const activeElement = document.activeElement as HTMLElement | null;
        const currentIndex = activeElement ? focusableElements.indexOf(activeElement) : -1;
        const lastIndex = focusableElements.length - 1;
        const nextIndex = event.shiftKey
          ? currentIndex <= 0
            ? lastIndex
            : currentIndex - 1
          : currentIndex === -1 || currentIndex === lastIndex
            ? 0
            : currentIndex + 1;
        event.preventDefault();
        focusableElements[nextIndex]?.focus();
        return;
      }
      handleSelectKeyDown(event);
    },
    [handleSelectKeyDown],
  );

  return (
    <article // NOSONAR
      ref={segmentRef}
      className={cn(
        "group relative p-3 rounded-md border transition-colors cursor-pointer",
        isSelected && "ring-2 ring-ring",
        isActive && "bg-accent/50",
        isChapterDragOver && "ring-2 ring-primary/60",
        !isSelected && !isActive && "hover-elevate",
      )}
      onDragOver={(event) => {
        if (!onChapterDrop) return;
        if (!event.dataTransfer.types.includes(CHAPTER_DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setIsChapterDragOver(true);
      }}
      onDragLeave={() => {
        if (!onChapterDrop) return;
        setIsChapterDragOver(false);
      }}
      onDrop={(event) => {
        if (!onChapterDrop) return;
        if (!event.dataTransfer.types.includes(CHAPTER_DRAG_TYPE)) return;
        event.preventDefault();
        const chapterId = event.dataTransfer.getData(CHAPTER_DRAG_TYPE);
        setIsChapterDragOver(false);
        if (chapterId) {
          onChapterDrop(chapterId, segment.id);
        }
      }}
      onClick={(event) => {
        // Only trigger the single-click selection path for primary single clicks.
        if (event.button === 0 && event.detail === 1) {
          handleSegmentClick();
        }
      }}
      onDoubleClick={handleSegmentDoubleClick}
      onKeyDown={handleSegmentKeyDown}
      data-testid={`segment-${segment.id}`}
      data-segment-id={segment.id}
      aria-label={`Segment by ${segment.speaker}`}
      aria-current={isSelected ? "true" : undefined}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Segment needs to be focusable for keyboard navigation
      tabIndex={0} // NOSONAR
    >
      {isChapterDragOver && (
        <div
          className="absolute left-3 right-3 top-0 h-0.5 rounded-full bg-primary shadow-sm"
          aria-hidden="true"
        />
      )}
      <div className="flex items-start gap-3">
        <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: speakerColor }} />

        <div className="flex-1 min-w-0">
          <SegmentHeader
            segment={segment}
            speakers={speakers}
            speakerColor={speakerColor}
            onSpeakerChange={onSpeakerChange}
            tags={tags}
            onRemoveTag={onRemoveTag}
            onAddTag={onAddTag}
          />

          {/* Speaker Suggestion (if present, shown ABOVE segment content) */}
          {pendingSpeakerSuggestion && onAcceptSpeakerSuggestion && onRejectSpeakerSuggestion && (
            <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-900/20">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>
                    {segment.speaker} → {pendingSpeakerSuggestion.suggestedSpeaker}
                  </span>
                  {pendingSpeakerSuggestion.confidence !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {(pendingSpeakerSuggestion.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                {pendingSpeakerSuggestion.reason && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {pendingSpeakerSuggestion.reason}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAcceptSpeakerSuggestion();
                  }}
                  className="h-7 px-2"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRejectSpeakerSuggestion();
                  }}
                  className="h-7 px-2"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {isEditing ? (
            <div className="flex items-start gap-3">
              <Textarea
                ref={editInputRef}
                value={draftText}
                onChange={handleDraftChange}
                onKeyDown={handleEditKeyDown}
                className="text-base md:text-base leading-relaxed min-h-0 resize-none overflow-auto border-0 p-0 rounded-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0"
                style={editHeight ? { height: `${editHeight}px` } : undefined}
                data-testid={`textarea-segment-${segment.id}`}
              />
              <div className="flex flex-col gap-2 pt-0.5">
                <Button
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSaveEdit();
                  }}
                  data-testid={`button-save-segment-${segment.id}`}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCancelEdit();
                  }}
                  data-testid={`button-cancel-segment-${segment.id}`}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : pendingRevision && onAcceptRevision && onRejectRevision ? (
            <SegmentDiffView
              originalText={segment.text}
              revisedText={pendingRevision.revisedText}
              changeSummary={pendingRevision.changeSummary}
              onAccept={onAcceptRevision}
              onReject={onRejectRevision}
            />
          ) : (
            <div
              ref={textDisplayRef}
              onMouseDown={(event) => {
                // Only prevent default for single clicks, not double clicks
                if (event.detail === 1) {
                  event.preventDefault();
                }
              }}
              className="text-base leading-relaxed outline-none"
              role="textbox"
              aria-readonly="true"
              tabIndex={-1}
            >
              <WordList
                segment={segment}
                resolvedActiveWordIndex={resolvedActiveWordIndex}
                selectedWordIndex={selectedWordIndex}
                setSelectedWordIndex={setSelectedWordIndex}
                spellcheckExpandedIndex={spellcheckExpandedIndex}
                setSpellcheckExpandedIndex={setSpellcheckExpandedIndex}
                highlightLowConfidence={highlightLowConfidence}
                lowConfidenceThreshold={lowConfidenceThreshold}
                lexiconMatches={lexiconMatches}
                showLexiconMatches={showLexiconMatches}
                lexiconHighlightUnderline={lexiconHighlightUnderline}
                lexiconHighlightBackground={lexiconHighlightBackground}
                spellcheckMatches={spellcheckMatches}
                showSpellcheckMatches={showSpellcheckMatches}
                searchQuery={searchQuery}
                isRegexSearch={isRegexSearch}
                replaceQuery={replaceQuery}
                currentMatch={currentMatch}
                onTextChange={onTextChange}
                onSeek={onSeek}
                onSelectOnly={onSelectOnly}
                onIgnoreLexiconMatch={onIgnoreLexiconMatch}
                onIgnoreSpellcheckMatch={onIgnoreSpellcheckMatch}
                onAddSpellcheckToGlossary={onAddSpellcheckToGlossary}
                onReplaceCurrent={onReplaceCurrent}
                onMatchClick={onMatchClick}
                findMatchIndex={findMatchIndex}
              />
            </div>
          )}

          <SegmentStatusBar
            lastRevisionResult={lastRevisionResult ?? undefined}
            hasPendingRevision={Boolean(pendingRevision)}
          />
        </div>

        <SegmentActions
          segmentId={segment.id}
          isConfirmed={isConfirmed}
          isBookmarked={isBookmarked}
          canSplitAtCurrentWord={canSplitAtCurrentWord}
          resolvedSplitWordIndex={resolvedSplitWordIndex}
          selectedWordIndex={selectedWordIndex}
          hasSelectionForSplit={hasSelectionForSplit}
          showConfirmAction={showConfirmAction}
          isEditing={isEditing}
          onConfirm={onConfirm}
          onToggleBookmark={onToggleBookmark}
          onSplit={onSplit}
          onMergeWithPrevious={onMergeWithPrevious}
          onMergeWithNext={onMergeWithNext}
          onDelete={onDelete}
          onStartChapterHere={onStartChapterHere}
          onStartEdit={handleStartEdit}
          onClearSelection={() => setSelectedWordIndex(null)}
        />
      </div>
    </article>
  );
}

const arePropsEqual = (prev: TranscriptSegmentProps, next: TranscriptSegmentProps) => {
  return (
    prev.segment === next.segment &&
    prev.speakers === next.speakers &&
    prev.tags === next.tags &&
    prev.isSelected === next.isSelected &&
    prev.isActive === next.isActive &&
    prev.activeWordIndex === next.activeWordIndex &&
    prev.highlightLowConfidence === next.highlightLowConfidence &&
    prev.lowConfidenceThreshold === next.lowConfidenceThreshold &&
    prev.lexiconMatches === next.lexiconMatches &&
    prev.showLexiconMatches === next.showLexiconMatches &&
    prev.lexiconHighlightUnderline === next.lexiconHighlightUnderline &&
    prev.lexiconHighlightBackground === next.lexiconHighlightBackground &&
    prev.spellcheckMatches === next.spellcheckMatches &&
    prev.showSpellcheckMatches === next.showSpellcheckMatches &&
    prev.editRequested === next.editRequested &&
    prev.onEditRequestHandled === next.onEditRequestHandled &&
    prev.onSelect === next.onSelect &&
    prev.onTextChange === next.onTextChange &&
    prev.onSpeakerChange === next.onSpeakerChange &&
    prev.onSplit === next.onSplit &&
    prev.onConfirm === next.onConfirm &&
    prev.onToggleBookmark === next.onToggleBookmark &&
    prev.onRemoveTag === next.onRemoveTag &&
    prev.onIgnoreLexiconMatch === next.onIgnoreLexiconMatch &&
    prev.onIgnoreSpellcheckMatch === next.onIgnoreSpellcheckMatch &&
    prev.onAddSpellcheckToGlossary === next.onAddSpellcheckToGlossary &&
    prev.showConfirmAction === next.showConfirmAction &&
    prev.onMergeWithPrevious === next.onMergeWithPrevious &&
    prev.onMergeWithNext === next.onMergeWithNext &&
    prev.onDelete === next.onDelete &&
    prev.onStartChapterHere === next.onStartChapterHere &&
    prev.onSeek === next.onSeek &&
    prev.searchQuery === next.searchQuery &&
    prev.isRegexSearch === next.isRegexSearch &&
    prev.replaceQuery === next.replaceQuery &&
    prev.onChapterDrop === next.onChapterDrop &&
    prev.currentMatch === next.currentMatch &&
    prev.pendingRevision === next.pendingRevision &&
    prev.pendingSpeakerSuggestion === next.pendingSpeakerSuggestion &&
    prev.lastRevisionResult?.timestamp === next.lastRevisionResult?.timestamp
  );
};

export const TranscriptSegment = memo(TranscriptSegmentComponent, arePropsEqual);
