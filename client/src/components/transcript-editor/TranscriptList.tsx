import { ScrollArea } from "@/components/ui/scroll-area";
import { TranscriptSegment } from "../TranscriptSegment";
import type { TranscriptEditorState } from "./useTranscriptEditor";

type TranscriptListProps = TranscriptEditorState["transcriptListProps"];

export function TranscriptList({
  containerRef,
  filteredSegments,
  speakers,
  activeSegmentId,
  selectedSegmentId,
  activeWordIndex,
  splitWordIndex,
  showLexiconMatches,
  lexiconHighlightUnderline,
  lexiconHighlightBackground,
  lexiconMatchesBySegment,
  showSpellcheckMatches,
  spellcheckMatchesBySegment,
  highlightLowConfidence,
  lowConfidenceThreshold,
  editRequestId,
  onClearEditRequest,
  segmentHandlers,
  onSeek,
  onIgnoreSpellcheckMatch,
  onAddSpellcheckToGlossary,
  emptyState,
  searchQuery,
  isRegexSearch,
}: TranscriptListProps) {
  return (
    <ScrollArea className="flex-1">
      <div ref={containerRef} className="max-w-4xl mx-auto p-4 space-y-2">
        {filteredSegments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium mb-2">{emptyState.title}</p>
            <p className="text-sm">{emptyState.description}</p>
          </div>
        ) : (
          filteredSegments.map((segment, index) => {
            const handlers = segmentHandlers[index];
            const resolvedSplitWordIndex = activeSegmentId === segment.id ? splitWordIndex : null;
            return (
              <TranscriptSegment
                key={segment.id}
                segment={segment}
                speakers={speakers}
                isSelected={segment.id === selectedSegmentId}
                isActive={activeSegmentId === segment.id}
                activeWordIndex={activeSegmentId === segment.id ? activeWordIndex : undefined}
                splitWordIndex={resolvedSplitWordIndex ?? undefined}
                highlightLowConfidence={highlightLowConfidence}
                lowConfidenceThreshold={lowConfidenceThreshold}
                lexiconMatches={lexiconMatchesBySegment.get(segment.id)}
                showLexiconMatches={showLexiconMatches}
                lexiconHighlightUnderline={lexiconHighlightUnderline}
                lexiconHighlightBackground={lexiconHighlightBackground}
                spellcheckMatches={spellcheckMatchesBySegment.get(segment.id)}
                showSpellcheckMatches={showSpellcheckMatches}
                editRequested={editRequestId === segment.id}
                onEditRequestHandled={editRequestId === segment.id ? onClearEditRequest : undefined}
                onSelect={handlers.onSelect}
                onTextChange={handlers.onTextChange}
                onSpeakerChange={handlers.onSpeakerChange}
                onSplit={handlers.onSplit}
                onConfirm={handlers.onConfirm}
                onToggleBookmark={handlers.onToggleBookmark}
                onIgnoreLexiconMatch={handlers.onIgnoreLexiconMatch}
                onIgnoreSpellcheckMatch={onIgnoreSpellcheckMatch}
                onAddSpellcheckToGlossary={onAddSpellcheckToGlossary}
                onMergeWithPrevious={handlers.onMergeWithPrevious}
                onMergeWithNext={handlers.onMergeWithNext}
                onDelete={handlers.onDelete}
                onSeek={onSeek}
                searchQuery={searchQuery}
                isRegexSearch={isRegexSearch}
              />
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}
