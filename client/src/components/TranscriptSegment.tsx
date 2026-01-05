import type { KeyboardEvent } from "react";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SearchMatch, Segment, Speaker } from "@/lib/store";
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
  readonly onTextChange: (text: string) => void;
  readonly onSpeakerChange: (speaker: string) => void;
  readonly onSplit: (wordIndex: number) => void;
  readonly onConfirm: () => void;
  readonly onToggleBookmark: () => void;
  readonly onIgnoreLexiconMatch?: (term: string, value: string) => void;
  readonly onIgnoreSpellcheckMatch?: (value: string) => void;
  readonly onAddSpellcheckToGlossary?: (value: string) => void;
  readonly showConfirmAction?: boolean;
  readonly onMergeWithPrevious?: () => void;
  readonly onMergeWithNext?: () => void;
  readonly onDelete: () => void;
  readonly onSeek: (time: number) => void;
  readonly searchQuery?: string;
  readonly isRegexSearch?: boolean;
  readonly replaceQuery?: string;
  readonly onReplaceCurrent?: () => void;
  readonly onMatchClick?: (index: number) => void;
  readonly findMatchIndex?: (segmentId: string, startIndex: number) => number;
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
}

function TranscriptSegmentComponent({
  segment,
  speakers,
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
  onTextChange,
  onSpeakerChange,
  onSplit,
  onConfirm,
  onToggleBookmark,
  onIgnoreLexiconMatch,
  onIgnoreSpellcheckMatch,
  onAddSpellcheckToGlossary,
  showConfirmAction = true,
  onMergeWithPrevious,
  onMergeWithNext,
  onDelete,
  onSeek,
  searchQuery,
  isRegexSearch,
  replaceQuery,
  onReplaceCurrent,
  onMatchClick,
  findMatchIndex,
  pendingRevision,
  onAcceptRevision,
  onRejectRevision,
  lastRevisionResult,
}: TranscriptSegmentProps) {
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [spellcheckExpandedIndex, setSpellcheckExpandedIndex] = useState<number | null>(null);

  const {
    draftText,
    editInputRef,
    handleCancelEdit,
    handleEditKeyDown,
    handleSaveEdit,
    handleSegmentClick,
    handleSelectKeyDown,
    handleStartEdit,
    isEditing,
    setDraftText,
  } = useSegmentEditing({
    segment,
    editRequested,
    onEditRequestHandled,
    onTextChange,
    onSelect,
  });

  const speaker = speakers.find((s) => s.name === segment.speaker);
  const speakerColor = speaker?.color || "hsl(217, 91%, 48%)";

  const resolvedActiveWordIndex = isActive ? (activeWordIndex ?? -1) : -1;
  const resolvedSplitWordIndex = isActive ? (splitWordIndex ?? -1) : -1;
  const canSplitAtCurrentWord = resolvedSplitWordIndex > 0;
  const hasSelectionForSplit = selectedWordIndex !== null && selectedWordIndex > 0;
  const isConfirmed = segment.confirmed === true;
  const isBookmarked = segment.bookmarked === true;

  const handleStartEditKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleStartEdit();
    }
  };

  return (
    <article // NOSONAR
      className={cn(
        "group relative p-3 rounded-md border transition-colors cursor-pointer",
        isSelected && "ring-2 ring-ring",
        isActive && "bg-accent/50",
        !isSelected && !isActive && "hover-elevate",
      )}
      onClick={handleSegmentClick}
      onKeyDown={handleSelectKeyDown}
      data-testid={`segment-${segment.id}`}
      data-segment-id={segment.id}
      aria-label={`Segment by ${segment.speaker}`}
      aria-current={isSelected ? "true" : undefined}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Segment needs to be focusable for keyboard navigation
      tabIndex={0} // NOSONAR
    >
      <div className="flex items-start gap-3">
        <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: speakerColor }} />

        <div className="flex-1 min-w-0">
          <SegmentHeader
            segment={segment}
            speakers={speakers}
            speakerColor={speakerColor}
            onSpeakerChange={onSpeakerChange}
          />

          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                ref={editInputRef}
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                onKeyDown={handleEditKeyDown}
                className="text-base leading-relaxed"
                data-testid={`textarea-segment-${segment.id}`}
              />
              <div className="flex items-center gap-2">
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
              onDoubleClick={handleStartEdit}
              onKeyDown={handleStartEditKeyDown}
              role="button"
              tabIndex={0}
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
    prev.onIgnoreLexiconMatch === next.onIgnoreLexiconMatch &&
    prev.onIgnoreSpellcheckMatch === next.onIgnoreSpellcheckMatch &&
    prev.onAddSpellcheckToGlossary === next.onAddSpellcheckToGlossary &&
    prev.showConfirmAction === next.showConfirmAction &&
    prev.onMergeWithPrevious === next.onMergeWithPrevious &&
    prev.onMergeWithNext === next.onMergeWithNext &&
    prev.onDelete === next.onDelete &&
    prev.onSeek === next.onSeek &&
    prev.searchQuery === next.searchQuery &&
    prev.isRegexSearch === next.isRegexSearch &&
    prev.replaceQuery === next.replaceQuery &&
    prev.currentMatch === next.currentMatch &&
    prev.pendingRevision === next.pendingRevision &&
    prev.lastRevisionResult?.timestamp === next.lastRevisionResult?.timestamp
  );
};

export const TranscriptSegment = memo(TranscriptSegmentComponent, arePropsEqual);
