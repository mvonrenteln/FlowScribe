import { AICommandPanel } from "./AICommandPanel/AICommandPanel";
import { ChaptersOutlinePanel } from "./ChaptersOutlinePanel";
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
    chaptersOutlinePanelProps,
  } = useTranscriptEditor();

  return (
    <div className="flex flex-col h-screen bg-background">
      <Toolbar {...toolbarProps} />
      <div className="flex flex-1 overflow-hidden">
        <FilterPanel open={sidebarOpen} {...filterPanelProps} />
        <main className="relative flex flex-1 min-h-0 flex-col overflow-hidden">
          <PlaybackPane {...playbackPaneProps} />
          <div className="relative flex-1 min-h-0 flex flex-col">
            <ChaptersOutlinePanel {...chaptersOutlinePanelProps} />
            <TranscriptList {...transcriptListProps} />
          </div>
        </main>
        <AICommandPanel {...aiCommandPanelProps} />
      </div>
      <EditorDialogs {...dialogProps} />
    </div>
  );
}
