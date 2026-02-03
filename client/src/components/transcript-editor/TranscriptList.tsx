import { Fragment, useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { indexById, mapById } from "@/lib/arrayUtils";
import { useTranscriptStore } from "@/lib/store";
import { sortChaptersByStart } from "@/lib/store/utils/chapters";
import { useSegmentIndexById } from "../../lib/store";
import { ChapterHeader } from "../ChapterHeader";
import { ChapterRewriteDialog } from "../rewrite/ChapterRewriteDialog";
import { ChapterRewriteView } from "../rewrite/ChapterRewriteView";
import { RewrittenTextDisplay } from "../rewrite/RewrittenTextDisplay";
import { TranscriptSegment } from "../TranscriptSegment";
import { ChapterSuggestionInline } from "./ChapterSuggestionInline";
import { MergeSuggestionInline } from "./MergeSuggestionInline";
import type { TranscriptEditorState } from "./useTranscriptEditor";

type TranscriptListProps = TranscriptEditorState["transcriptListProps"];

function TranscriptListComponent({
  containerRef,
  filteredSegments,
  speakers,
  chapters,
  selectedChapterId,
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
  onStartChapterAtSegment,
  onSelectChapter,
  onUpdateChapter,
  onDeleteChapter,
  chapterFocusRequest,
  onChapterFocusRequestHandled,
  isTranscriptEditing,
}: TranscriptListProps) {
  // Get segments and tags from store
  const segments = useTranscriptStore((s) => s.segments);
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

  // Get chapter display modes for rewritten text
  const chapterDisplayModes = useTranscriptStore((s) => s.chapterDisplayModes);

  // Rewrite dialog and view state - consolidated into single state object
  const [rewriteState, setRewriteState] = useState<{
    dialogOpen: boolean;
    viewOpen: boolean;
    chapterId: string | null;
    triggerElement: HTMLElement | null;
  }>({
    dialogOpen: false,
    viewOpen: false,
    chapterId: null,
    triggerElement: null,
  });

  const handleRewriteChapter = (chapterId: string) => {
    setRewriteState({
      dialogOpen: true,
      viewOpen: false,
      chapterId,
      triggerElement: document.activeElement as HTMLElement,
    });
  };

  const handleStartRewrite = () => {
    setRewriteState((prev) => ({
      ...prev,
      dialogOpen: false,
      viewOpen: true,
    }));
  };

  const handleCloseRewriteView = () => {
    setRewriteState({
      dialogOpen: false,
      viewOpen: false,
      chapterId: null,
      triggerElement: null,
    });
  };

  // AI Chapter Detection
  const chapterSuggestions = useTranscriptStore((s) => s.aiChapterDetectionSuggestions);
  const acceptChapterSuggestion = useTranscriptStore((s) => s.acceptChapterSuggestion);
  const rejectChapterSuggestion = useTranscriptStore((s) => s.rejectChapterSuggestion);
  const allSegments = useTranscriptStore((s) => s.segments);

  // Create a map for fast lookup of pending revisions/suggestions
  const pendingRevisionBySegmentId = useMemo(
    () =>
      mapById(
        pendingRevisions
          .filter((r) => r.status === "pending")
          .map((r) => ({ id: r.segmentId, ...r })),
      ),
    [pendingRevisions],
  );

  // Create a map for speaker suggestions
  const pendingSpeakerSuggestionBySegmentId = useMemo(
    () =>
      mapById(
        pendingSpeakerSuggestions
          .filter((s) => s.status === "pending")
          .map((s) => ({ id: s.segmentId, ...s })),
      ),
    [pendingSpeakerSuggestions],
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

  const pendingChapterSuggestionsByStart = useMemo(() => {
    const map = new Map<string, typeof chapterSuggestions>();
    for (const suggestion of chapterSuggestions) {
      if (suggestion.status !== "pending") continue;
      const existing = map.get(suggestion.startSegmentId);
      if (existing) {
        existing.push(suggestion);
      } else {
        map.set(suggestion.startSegmentId, [suggestion]);
      }
    }
    return map;
  }, [chapterSuggestions]);

  const segmentIndexById = useSegmentIndexById();
  const filteredIndexById = useMemo(() => indexById(filteredSegments), [filteredSegments]);
  const segmentById = useMemo(() => mapById(allSegments), [allSegments]);

  const chapterByStartId = useMemo(() => {
    const sortedChapters = sortChaptersByStart(chapters, segmentIndexById);
    return new Map(sortedChapters.map((chapter) => [chapter.startSegmentId, chapter]));
  }, [chapters, segmentIndexById]);

  // Build a set of segment IDs that should be hidden (because they're in a rewritten chapter)
  // Optimized: filter chapters first to avoid processing all chapters on every render
  const rewrittenChapters = useMemo(
    () =>
      chapters.filter(
        (ch) => chapterDisplayModes[ch.id] === "rewritten" && ch.rewrittenText !== undefined,
      ),
    [chapters, chapterDisplayModes],
  );

  const hiddenSegmentIds = useMemo(() => {
    const hidden = new Set<string>();
    // Only process chapters that are actually rewritten and displayed as such
    for (const chapter of rewrittenChapters) {
      const startIndex = segmentIndexById.get(chapter.startSegmentId);
      const endIndex = segmentIndexById.get(chapter.endSegmentId);
      if (startIndex !== undefined && endIndex !== undefined) {
        // Build segment IDs from indices without accessing segments array
        // All segments except the first one (where rewritten text is shown)
        for (let i = startIndex + 1; i <= endIndex; i++) {
          const segment = segments[i];
          if (segment) hidden.add(segment.id);
        }
      }
    }
    return hidden;
  }, [rewrittenChapters, segmentIndexById, segments]);

  // Render a sliding window of N segments centered on the active/selected/last segment
  const DEV_SLICE_SIZE = 50;
  let segmentsToRender = filteredSegments;
  // Determine anchor: prefer activeSegmentId, then selectedSegmentId, then last visible segment
  const anchorId =
    (activeSegmentId as string | undefined) ??
    (selectedSegmentId as string | undefined) ??
    (filteredSegments.length > 0 ? filteredSegments[filteredSegments.length - 1].id : undefined);

  const activeIndex = anchorId ? (filteredIndexById.get(anchorId) ?? -1) : -1;
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
          segmentsToRender.map((segment, _index) => {
            // segmentHandlers corresponds to filteredSegments indices; when using a slice
            // we need to resolve the original index for the handler lookup.
            const originalIndex = filteredIndexById.get(segment.id) ?? -1;
            const handlers = originalIndex >= 0 ? segmentHandlers[originalIndex] : undefined;
            if (!handlers) return null; // Safety check

            const resolvedSplitWordIndex = activeSegmentId === segment.id ? splitWordIndex : null;
            const pendingRevision = pendingRevisionBySegmentId.get(segment.id);
            const pendingSpeakerSugg = pendingSpeakerSuggestionBySegmentId.get(segment.id);
            // FIX: Only show merge suggestion if both segments are in the current render slice
            const nextSegment = segmentsToRender[_index + 1];
            const mergeSuggestion = nextSegment
              ? pendingMergeSuggestionByPair.get(`${segment.id}::${nextSegment.id}`)
              : undefined;
            const chapterSuggestionsForSegment = pendingChapterSuggestionsByStart.get(segment.id);
            const chapter = chapterByStartId.get(segment.id);
            const isChapterFocusTarget = chapter ? chapterFocusRequest === chapter.id : false;

            // Check if this segment should be hidden (part of rewritten chapter)
            if (hiddenSegmentIds.has(segment.id)) {
              return null;
            }

            // Check if we should show rewritten text for this chapter
            const displayMode = chapter
              ? chapterDisplayModes[chapter.id] || "original"
              : "original";
            const showRewritten = displayMode === "rewritten" && chapter?.rewrittenText;

            return (
              <Fragment key={segment.id}>
                {chapterSuggestionsForSegment?.map((suggestion) => (
                  <ChapterSuggestionInline
                    key={suggestion.id}
                    suggestion={suggestion}
                    startSegment={segmentById.get(suggestion.startSegmentId)}
                    endSegment={segmentById.get(suggestion.endSegmentId)}
                    tags={tags}
                    onAccept={() => acceptChapterSuggestion(suggestion.id)}
                    onReject={() => rejectChapterSuggestion(suggestion.id)}
                  />
                ))}
                {chapter && (
                  <ChapterHeader
                    chapter={chapter}
                    tags={tags}
                    isSelected={chapter.id === selectedChapterId}
                    onOpen={() => onSelectChapter?.(chapter.id)}
                    onUpdateChapter={onUpdateChapter}
                    onDeleteChapter={onDeleteChapter}
                    isTranscriptEditing={isTranscriptEditing}
                    autoFocus={isChapterFocusTarget}
                    onAutoFocusHandled={onChapterFocusRequestHandled}
                    onRewriteChapter={handleRewriteChapter}
                  />
                )}

                {showRewritten && chapter?.rewrittenText ? (
                  <RewrittenTextDisplay
                    chapterId={chapter.id}
                    text={chapter.rewrittenText}
                    searchQuery={searchQuery}
                    isRegexSearch={isRegexSearch}
                  />
                ) : (
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
                    onStartChapterHere={onStartChapterAtSegment}
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
                    onAcceptRevision={
                      pendingRevision ? () => acceptRevision(segment.id) : undefined
                    }
                    onRejectRevision={
                      pendingRevision ? () => rejectRevision(segment.id) : undefined
                    }
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
                )}

                {!showRewritten && mergeSuggestion && nextSegment && (
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

      {/* Rewrite Dialog */}
      {rewriteState.dialogOpen && rewriteState.chapterId && (
        <ChapterRewriteDialog
          open={rewriteState.dialogOpen}
          onOpenChange={(open) => setRewriteState((prev) => ({ ...prev, dialogOpen: open }))}
          chapterId={rewriteState.chapterId}
          onStartRewrite={handleStartRewrite}
        />
      )}

      {/* Rewrite View */}
      {rewriteState.viewOpen && rewriteState.chapterId && (
        <ChapterRewriteView
          chapterId={rewriteState.chapterId}
          onClose={handleCloseRewriteView}
          triggerElement={rewriteState.triggerElement}
        />
      )}
    </ScrollArea>
  );
}

export const TranscriptList = TranscriptListComponent;
