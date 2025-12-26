import { CustomDictionariesDialog } from "../CustomDictionariesDialog";
import { ExportDialog } from "../ExportDialog";
import { GlossaryDialog } from "../GlossaryDialog";
import { KeyboardShortcuts } from "../KeyboardShortcuts";
import { RevisionDialog } from "../RevisionDialog";
import { SpellcheckDialog } from "../SpellcheckDialog";
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
  showCustomDictionariesDialog,
  onCustomDictionariesDialogChange,
  showRevisionDialog,
  onRevisionDialogChange,
  onCreateRevision,
  canCreateRevision,
  activeSessionName,
  activeSessionKind,
  existingRevisionNames,
  defaultRevisionName,
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
      <CustomDictionariesDialog
        open={showCustomDictionariesDialog}
        onOpenChange={onCustomDictionariesDialogChange}
      />
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
    </>
  );
}
