import { AISegmentMergeDialog } from "../AISegmentMergeDialog";
import { AISpeakerDialog } from "../AISpeakerDialog";
import { ExportDialog } from "../ExportDialog";
import { GlossaryDialog } from "../GlossaryDialog";
import { KeyboardShortcuts } from "../KeyboardShortcuts";
import { RevisionDialog } from "../RevisionDialog";
import { SpellcheckDialog } from "../SpellcheckDialog";
import { SettingsSheet } from "../settings";
import type { TranscriptEditorState } from "./useTranscriptEditor";

type DialogProps = TranscriptEditorState["dialogProps"];

export function EditorDialogs({
  showShortcuts,
  onShortcutsChange,
  showExport,
  onExportChange,
  segments,
  audioFileName,
  showLexicon,
  onLexiconChange,
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
  showAISpeaker,
  onAISpeakerChange,
  showAISegmentMerge,
  onAISegmentMergeChange,
  showSettings,
  onSettingsChange,
  onOpenSettings,
}: DialogProps) {
  return (
    <>
      <KeyboardShortcuts open={showShortcuts} onOpenChange={onShortcutsChange} />
      <ExportDialog
        open={showExport}
        onOpenChange={onExportChange}
        segments={segments}
        fileName={audioFileName?.replace(/\.[^/.]+$/, "") || "transcript"}
      />
      <GlossaryDialog open={showLexicon} onOpenChange={onLexiconChange} />
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
      <AISpeakerDialog
        open={showAISpeaker}
        onOpenChange={onAISpeakerChange}
        onOpenSettings={onOpenSettings}
      />
      <AISegmentMergeDialog
        open={showAISegmentMerge}
        onOpenChange={onAISegmentMergeChange}
        onOpenSettings={onOpenSettings}
      />
      <SettingsSheet open={showSettings} onOpenChange={onSettingsChange} showTrigger={false} />
    </>
  );
}
