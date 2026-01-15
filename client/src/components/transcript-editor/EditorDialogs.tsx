import { memo } from "react";
import { AISegmentMergeDialog } from "../AISegmentMergeDialog";
import { ExportDialog } from "../ExportDialog";
import { KeyboardShortcuts } from "../KeyboardShortcuts";
import { RevisionDialog } from "../RevisionDialog";
import { SpellcheckDialog } from "../SpellcheckDialog";
import { SettingsSheet } from "../settings";
import type { TranscriptEditorState } from "./useTranscriptEditor";

type DialogProps = TranscriptEditorState["dialogProps"];

const EditorDialogsComponent = ({
  showShortcuts,
  onShortcutsChange,
  showExport,
  onExportChange,
  segments,
  filteredSegments,
  tags,
  audioFileName,
  showLexicon: _showLexicon,
  onLexiconChange: _onLexiconChange,
  showSpellcheckDialog,
  onSpellcheckDialogChange,
  showRevisionDialog,
  onRevisionDialogChange,
  onCreateRevision,
  canCreateRevision,
  activeSessionName,
  activeSessionKind,
  existingRevisionNames,
  defaultRevisionName,
  showAISegmentMerge,
  onAISegmentMergeChange,
  showSettings,
  onSettingsChange,
  onOpenSettings,
  settingsInitialSection,
  setSettingsInitialSection: _setSettingsInitialSection,
}: DialogProps) => {
  return (
    <>
      <KeyboardShortcuts open={showShortcuts} onOpenChange={onShortcutsChange} />
      <ExportDialog
        open={showExport}
        onOpenChange={onExportChange}
        segments={segments}
        filteredSegments={filteredSegments}
        tags={tags}
        fileName={audioFileName?.replace(/\.[^/.]+$/, "") || "transcript"}
      />
      {/* GlossaryDialog removed — use Settings -> Glossary for management */}
      <SpellcheckDialog open={showSpellcheckDialog} onOpenChange={onSpellcheckDialogChange} />
      <RevisionDialog
        open={showRevisionDialog}
        onOpenChange={onRevisionDialogChange}
        onCreateRevision={onCreateRevision}
        canCreateRevision={canCreateRevision}
        activeSessionName={activeSessionName}
        activeSessionKind={activeSessionKind}
        existingRevisionNames={existingRevisionNames}
        defaultRevisionName={defaultRevisionName}
      />
      <AISegmentMergeDialog
        open={showAISegmentMerge}
        onOpenChange={onAISegmentMergeChange}
        onOpenSettings={onOpenSettings}
      />
      <SettingsSheet
        open={showSettings}
        onOpenChange={onSettingsChange}
        initialSection={settingsInitialSection}
        showTrigger={false}
      />
    </>
  );
};

// Memoize to prevent re-renders when unrelated dialogProps change
export const EditorDialogs = memo(EditorDialogsComponent);
