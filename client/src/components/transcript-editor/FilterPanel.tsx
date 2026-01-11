import { cn } from "@/lib/utils";
import { SpeakerSidebar } from "../SpeakerSidebar";
import type { TranscriptEditorState } from "./useTranscriptEditor";

type FilterPanelProps = TranscriptEditorState["filterPanelProps"] & { open: boolean };

export function FilterPanel({ open, ...props }: FilterPanelProps) {
  return (
    <aside
      className={cn(
        "w-64 border-r bg-sidebar flex-shrink-0 transition-all duration-200",
        !open && "w-0 overflow-hidden border-0",
      )}
    >
      <SpeakerSidebar
        speakers={props.speakers}
        segments={props.segments}
        tags={props.tags}
        onRenameSpeaker={props.onRenameSpeaker}
        onAddSpeaker={props.onAddSpeaker}
        onMergeSpeakers={props.onMergeSpeakers}
        onSpeakerSelect={props.onSpeakerSelect}
        onClearFilter={props.onClearFilters}
        selectedSpeakerId={props.selectedSpeakerId}
        onAddTag={props.onAddTag}
        onRenameTag={props.onRenameTag}
        onTagSelect={props.onTagSelect}
        selectedTagIds={props.selectedTagIds}
        lowConfidenceFilterActive={props.lowConfidenceFilterActive}
        onToggleLowConfidenceFilter={props.onToggleLowConfidenceFilter}
        lowConfidenceThreshold={props.lowConfidenceThreshold}
        onLowConfidenceThresholdChange={props.onLowConfidenceThresholdChange}
        bookmarkFilterActive={props.bookmarkFilterActive}
        onToggleBookmarkFilter={props.onToggleBookmarkFilter}
        lexiconFilterActive={props.lexiconFilterActive}
        onToggleLexiconFilter={props.onToggleLexiconFilter}
        lexiconMatchCount={props.lexiconMatchCount}
        lexiconLowScoreMatchCount={props.lexiconLowScoreMatchCount}
        lexiconLowScoreFilterActive={props.lexiconLowScoreFilterActive}
        onToggleLexiconLowScoreFilter={props.onToggleLexiconLowScoreFilter}
        spellcheckMatchCount={props.spellcheckMatchCount}
        spellcheckFilterActive={props.spellcheckFilterActive}
        onToggleSpellcheckFilter={props.onToggleSpellcheckFilter}
        spellcheckEnabled={props.spellcheckEnabled}
        spellcheckMatchLimitReached={props.spellcheckMatchLimitReached}
        searchQuery={props.searchQuery}
        onSearchQueryChange={props.onSearchQueryChange}
        isRegexSearch={props.isRegexSearch}
        onToggleRegexSearch={props.onToggleRegexSearch}
        replaceQuery={props.replaceQuery}
        onReplaceQueryChange={props.onReplaceQueryChange}
        currentMatchIndex={props.currentMatchIndex}
        totalMatches={props.totalMatches}
        goToNextMatch={props.goToNextMatch}
        goToPrevMatch={props.goToPrevMatch}
        onReplaceCurrent={props.onReplaceCurrent}
        onReplaceAll={props.onReplaceAll}
      />
    </aside>
  );
}
