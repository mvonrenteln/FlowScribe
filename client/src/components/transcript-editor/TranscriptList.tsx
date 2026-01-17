import { Fragment, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranscriptStore } from "@/lib/store";
import { TranscriptSegment } from "../TranscriptSegment";
import { MergeSuggestionInline } from "./MergeSuggestionInline";
import type { TranscriptEditorState } from "./useTranscriptEditor";

type TranscriptListProps = TranscriptEditorState["transcriptListProps"];

function TranscriptListComponent({
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
  currentMatch,
  replaceQuery,
  onReplaceCurrent,
  onMatchClick,
  findMatchIndex,
}: TranscriptListProps) {
  // Get tags and tag operations from store
  const tags = useTranscriptStore((s) => s.tags);
  const removeTagFromSegment = useTranscriptStore((s) => s.removeTagFromSegment);
  const assignTagToSegment = useTranscriptStore((s) => s.assignTagToSegment);

  // Get pending revisions from store
  const pendingRevisions = useTranscriptStore((s) => s.aiRevisionSuggestions);
  const lastRevisionResult = useTranscriptStore((s) => s.aiRevisionLastResult);
  const acceptRevision = useTranscriptStore((s) => s.acceptRevision);
  const rejectRevision = useTranscriptStore((s) => s.rejectRevision);

  // Get pending speaker suggestions from store
  const pendingSpeakerSuggestions = useTranscriptStore((s) => s.aiSpeakerSuggestions);
  const acceptSpeakerSuggestion = useTranscriptStore((s) => s.acceptSuggestion);
  const rejectSpeakerSuggestion = useTranscriptStore((s) => s.rejectSuggestion);

  const pendingMergeSuggestions = useTranscriptStore((s) => s.aiSegmentMergeSuggestions);
  const acceptMergeSuggestion = useTranscriptStore((s) => s.acceptMergeSuggestion);
  const rejectMergeSuggestion = useTranscriptStore((s) => s.rejectMergeSuggestion);

  // Create a map for fast lookup
  const pendingRevisionBySegmentId = new Map(
    pendingRevisions.filter((r) => r.status === "pending").map((r) => [r.segmentId, r]),
  );

  // Create a map for speaker suggestions
  const pendingSpeakerSuggestionBySegmentId = new Map(
    pendingSpeakerSuggestions.filter((s) => s.status === "pending").map((s) => [s.segmentId, s]),
  );

  const pendingMergeSuggestionByPair = useMemo(() => {
    const map = new Map<string, (typeof pendingMergeSuggestions)[number]>();
    for (const suggestion of pendingMergeSuggestions) {
      if (suggestion.status !== "pending") continue;
      const [first, second] = suggestion.segmentIds;
      if (!first || !second) continue;
      map.set(`${first}::${second}`, suggestion);
    }
    return map;
  }, [pendingMergeSuggestions]);

  // Render a sliding window of N segments centered on the active/selected/last segment
  const DEV_SLICE_SIZE = 50;
  let segmentsToRender = filteredSegments;
  // Determine anchor: prefer activeSegmentId, then selectedSegmentId, then last visible segment
  const anchorId =
    (activeSegmentId as string | undefined) ??
    (selectedSegmentId as string | undefined) ??
    (filteredSegments.length > 0 ? filteredSegments[filteredSegments.length - 1].id : undefined);

  const activeIndex = anchorId ? filteredSegments.findIndex((s) => s.id === anchorId) : -1;
  if (activeIndex === -1) {
    // fallback: last N segments so user stays near the end instead of jumping elsewhere
    const start = Math.max(0, filteredSegments.length - DEV_SLICE_SIZE);
    segmentsToRender = filteredSegments.slice(start, filteredSegments.length);
  } else {
    const half = Math.floor(DEV_SLICE_SIZE / 2);
    const start = Math.max(0, activeIndex - half);
    const end = Math.min(filteredSegments.length, start + DEV_SLICE_SIZE);
    segmentsToRender = filteredSegments.slice(start, end);
  }

  // Simple "virtualization": If there are many segments, we could limit rendering.
  // But first, let's ensure memoization of the list itself and the segments works.

  return (
    <ScrollArea className="flex-1">
      <div ref={containerRef} className="max-w-4xl mx-auto p-4 space-y-2">
        {filteredSegments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium mb-2">{emptyState.title}</p>
            <p className="text-sm">{emptyState.description}</p>
          </div>
        ) : (
          segmentsToRender.map((segment, index) => {
            // segmentHandlers corresponds to filteredSegments indices; when using a slice
            // we need to resolve the original index for the handler lookup.
            const originalIndex = filteredSegments.findIndex((s) => s.id === segment.id);
            const handlers = segmentHandlers[originalIndex];
            if (!handlers) return null; // Safety check

            const resolvedSplitWordIndex = activeSegmentId === segment.id ? splitWordIndex : null;
            const pendingRevision = pendingRevisionBySegmentId.get(segment.id);
            const pendingSpeakerSugg = pendingSpeakerSuggestionBySegmentId.get(segment.id);
            const nextSegment = filteredSegments[index + 1];
            const mergeSuggestion = nextSegment
              ? pendingMergeSuggestionByPair.get(`${segment.id}::${nextSegment.id}`)
              : undefined;

            return (
              <Fragment key={segment.id}>
                <TranscriptSegment
                  segment={segment}
                  speakers={speakers}
                  tags={tags}
                  isSelected={segment.id === selectedSegmentId}
                  isActive={activeSegmentId === segment.id}
                  currentMatch={currentMatch?.segmentId === segment.id ? currentMatch : undefined}
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
                  onEditRequestHandled={
                    editRequestId === segment.id ? onClearEditRequest : undefined
                  }
                  onSelect={handlers.onSelect}
                  onSelectOnly={handlers.onSelectOnly}
                  onTextChange={handlers.onTextChange}
                  onSpeakerChange={handlers.onSpeakerChange}
                  onSplit={handlers.onSplit}
                  onConfirm={handlers.onConfirm}
                  onToggleBookmark={handlers.onToggleBookmark}
                  onRemoveTag={(tagId) => removeTagFromSegment(segment.id, tagId)}
                  onAddTag={(tagId) => assignTagToSegment(segment.id, tagId)}
                  onIgnoreLexiconMatch={handlers.onIgnoreLexiconMatch}
                  onIgnoreSpellcheckMatch={onIgnoreSpellcheckMatch}
                  onAddSpellcheckToGlossary={onAddSpellcheckToGlossary}
                  onMergeWithPrevious={handlers.onMergeWithPrevious}
                  onMergeWithNext={handlers.onMergeWithNext}
                  onDelete={handlers.onDelete}
                  onSeek={onSeek}
                  searchQuery={searchQuery}
                  isRegexSearch={isRegexSearch}
                  replaceQuery={replaceQuery}
                  onReplaceCurrent={onReplaceCurrent}
                  onMatchClick={onMatchClick}
                  findMatchIndex={findMatchIndex}
                  // AI Revision props
                  pendingRevision={
                    pendingRevision
                      ? {
                          revisedText: pendingRevision.revisedText,
                          changeSummary: pendingRevision.changeSummary,
                        }
                      : undefined
                  }
                  onAcceptRevision={pendingRevision ? () => acceptRevision(segment.id) : undefined}
                  onRejectRevision={pendingRevision ? () => rejectRevision(segment.id) : undefined}
                  lastRevisionResult={
                    lastRevisionResult?.segmentId === segment.id ? lastRevisionResult : undefined
                  }
                  // AI Speaker props
                  pendingSpeakerSuggestion={
                    pendingSpeakerSugg
                      ? {
                          suggestedSpeaker: pendingSpeakerSugg.suggestedSpeaker,
                          confidence: pendingSpeakerSugg.confidence,
                          reason: pendingSpeakerSugg.reason,
                        }
                      : undefined
                  }
                  onAcceptSpeakerSuggestion={
                    pendingSpeakerSugg ? () => acceptSpeakerSuggestion(segment.id) : undefined
                  }
                  onRejectSpeakerSuggestion={
                    pendingSpeakerSugg ? () => rejectSpeakerSuggestion(segment.id) : undefined
                  }
                />
                {mergeSuggestion && nextSegment && (
                  <MergeSuggestionInline
                    suggestion={mergeSuggestion}
                    firstSegment={segment}
                    secondSegment={nextSegment}
                    onAccept={() => acceptMergeSuggestion(mergeSuggestion.id)}
                    onAcceptWithoutSmoothing={() =>
                      acceptMergeSuggestion(mergeSuggestion.id, { applySmoothing: false })
                    }
                    onReject={() => rejectMergeSuggestion(mergeSuggestion.id)}
                  />
                )}
              </Fragment>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}

export const TranscriptList = TranscriptListComponent;
