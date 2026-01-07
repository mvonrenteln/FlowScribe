import { AICommandPanel } from "./AICommandPanel/AICommandPanel";
import { EditorDialogs } from "./transcript-editor/EditorDialogs";
import { FilterPanel } from "./transcript-editor/FilterPanel";
import { PlaybackPane } from "./transcript-editor/PlaybackPane";
import { Toolbar } from "./transcript-editor/Toolbar";
import { TranscriptList } from "./transcript-editor/TranscriptList";
import { useTranscriptEditor } from "./transcript-editor/useTranscriptEditor";

export function TranscriptEditor() {
  const {
    sidebarOpen,
    toolbarProps,
    filterPanelProps,
    playbackPaneProps,
    transcriptListProps,
    dialogProps,
    aiCommandPanelProps,
  } = useTranscriptEditor();

  return (
    <div className="flex flex-col h-screen bg-background">
      <Toolbar {...toolbarProps} />
      <div className="flex flex-1 overflow-hidden">
        <FilterPanel open={sidebarOpen} {...filterPanelProps} />
        <main className="flex-1 flex flex-col overflow-hidden">
          <PlaybackPane {...playbackPaneProps} />
          <TranscriptList {...transcriptListProps} />
        </main>
        <AICommandPanel {...aiCommandPanelProps} />
      </div>
      <EditorDialogs {...dialogProps} />
    </div>
  );
}
