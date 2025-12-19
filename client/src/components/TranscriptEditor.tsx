import { useCallback, useState, useEffect, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranscriptStore } from '@/lib/store';
import { FileUpload } from './FileUpload';
import { WaveformPlayer } from './WaveformPlayer';
import { PlaybackControls } from './PlaybackControls';
import { TranscriptSegment } from './TranscriptSegment';
import { SpeakerSidebar } from './SpeakerSidebar';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { ExportDialog } from './ExportDialog';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  Keyboard, 
  Undo2, 
  Redo2,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function TranscriptEditor() {
  const {
    audioFile,
    audioUrl,
    segments,
    speakers,
    selectedSegmentId,
    currentTime,
    isPlaying,
    duration,
    isWhisperXFormat,
    setAudioFile,
    setAudioUrl,
    loadTranscript,
    setSelectedSegmentId,
    setCurrentTime,
    setIsPlaying,
    setDuration,
    requestSeek,
    updateSegmentText,
    updateSegmentSpeaker,
    splitSegment,
    mergeSegments,
    updateSegmentTiming,
    deleteSegment,
    renameSpeaker,
    addSpeaker,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useTranscriptStore();

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterSpeaker, setFilterSpeaker] = useState<string | undefined>();
  const transcriptListRef = useRef<HTMLDivElement>(null);

  const handleAudioUpload = useCallback((file: File) => {
    setAudioFile(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
  }, [setAudioFile, setAudioUrl]);

  const handleTranscriptUpload = useCallback((data: unknown) => {
    interface WhisperSegment {
      timestamp: [number, number];
      text: string;
    }
    
    interface WhisperXSegment {
      speaker?: string;
      start: number;
      end: number;
      text: string;
      words?: Array<{ word: string; start: number; end: number }>;
    }
    
    const checkIsWhisperFormat = (d: unknown): d is WhisperSegment[] => {
      return Array.isArray(d) && d.length > 0 && 'timestamp' in d[0];
    };
    
    const checkIsWhisperXFormat = (d: unknown): d is { segments: WhisperXSegment[] } => {
      return typeof d === 'object' && d !== null && 'segments' in d;
    };
    
    let processedSegments: Array<{
      id: string;
      speaker: string;
      start: number;
      end: number;
      text: string;
      words: Array<{ word: string; start: number; end: number }>;
    }> = [];
    
    let detectedWhisperXFormat = false;
    
    if (checkIsWhisperFormat(data)) {
      processedSegments = data.map((seg, idx) => {
        const start = seg.timestamp[0];
        const end = seg.timestamp[1];
        const text = seg.text.trim();
        const wordsArray = text.split(/\s+/).filter(w => w.length > 0);
        const segDuration = end - start;
        const wordDuration = wordsArray.length > 0 ? segDuration / wordsArray.length : segDuration;
        
        return {
          id: `seg-${idx}`,
          speaker: 'SPEAKER_00',
          start,
          end,
          text,
          words: wordsArray.map((word, i) => ({
            word,
            start: start + i * wordDuration,
            end: start + (i + 1) * wordDuration,
          })),
        };
      });
      detectedWhisperXFormat = false;
    } else if (checkIsWhisperXFormat(data)) {
      processedSegments = data.segments.map((seg, idx) => ({
        id: `seg-${idx}`,
        speaker: seg.speaker || 'SPEAKER_00',
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
        words: seg.words || seg.text.trim().split(/\s+/).filter(w => w.length > 0).map((word, i, arr) => {
          const segDuration = seg.end - seg.start;
          const wordDuration = arr.length > 0 ? segDuration / arr.length : segDuration;
          return {
            word,
            start: seg.start + i * wordDuration,
            end: seg.start + (i + 1) * wordDuration,
          };
        }),
      }));
      detectedWhisperXFormat = true;
    } else {
      console.error('Unknown transcript format. Expected Whisper or WhisperX format.');
      return;
    }
    
    if (processedSegments.length > 0) {
      loadTranscript({ segments: processedSegments, isWhisperXFormat: detectedWhisperXFormat });
    }
  }, [loadTranscript]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying, setIsPlaying]);

  const handleSeek = useCallback((time: number) => {
    requestSeek(time);
  }, [requestSeek]);

  const handleSkipBack = useCallback(() => {
    requestSeek(Math.max(0, currentTime - 5));
  }, [currentTime, requestSeek]);

  const handleSkipForward = useCallback(() => {
    requestSeek(Math.min(duration, currentTime + 5));
  }, [currentTime, duration, requestSeek]);

  const getSelectedSegmentIndex = useCallback(() => {
    return segments.findIndex(s => s.id === selectedSegmentId);
  }, [segments, selectedSegmentId]);

  const selectPreviousSegment = useCallback(() => {
    const currentIndex = getSelectedSegmentIndex();
    if (currentIndex > 0) {
      setSelectedSegmentId(segments[currentIndex - 1].id);
    } else if (currentIndex === -1 && segments.length > 0) {
      setSelectedSegmentId(segments[segments.length - 1].id);
    }
  }, [getSelectedSegmentIndex, segments, setSelectedSegmentId]);

  const selectNextSegment = useCallback(() => {
    const currentIndex = getSelectedSegmentIndex();
    if (currentIndex < segments.length - 1) {
      setSelectedSegmentId(segments[currentIndex + 1].id);
    } else if (currentIndex === -1 && segments.length > 0) {
      setSelectedSegmentId(segments[0].id);
    }
  }, [getSelectedSegmentIndex, segments, setSelectedSegmentId]);

  useHotkeys('space', (e) => { e.preventDefault(); handlePlayPause(); }, { enableOnFormTags: false });
  useHotkeys('j', handleSkipBack, { enableOnFormTags: false });
  useHotkeys('l', handleSkipForward, { enableOnFormTags: false });
  useHotkeys('left', () => handleSeek(Math.max(0, currentTime - 1)), { enableOnFormTags: false });
  useHotkeys('right', () => handleSeek(Math.min(duration, currentTime + 1)), { enableOnFormTags: false });
  useHotkeys('home', () => handleSeek(0), { enableOnFormTags: false });
  useHotkeys('end', () => handleSeek(duration), { enableOnFormTags: false });
  useHotkeys('up', selectPreviousSegment, { enableOnFormTags: false });
  useHotkeys('down', selectNextSegment, { enableOnFormTags: false });
  useHotkeys('escape', () => setSelectedSegmentId(null));
  useHotkeys('mod+z', () => { if (canUndo()) undo(); });
  useHotkeys('mod+shift+z', () => { if (canRedo()) redo(); });
  useHotkeys('mod+e', () => setShowExport(true));
  useHotkeys('shift+/', () => setShowShortcuts(true));

  useHotkeys('m', () => {
    if (selectedSegmentId) {
      const index = getSelectedSegmentIndex();
      if (index < segments.length - 1) {
        mergeSegments(selectedSegmentId, segments[index + 1].id);
      }
    }
  }, { enableOnFormTags: false });

  useHotkeys('delete', () => {
    if (selectedSegmentId) {
      deleteSegment(selectedSegmentId);
      setSelectedSegmentId(null);
    }
  }, { enableOnFormTags: false });

  ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((key, index) => {
    useHotkeys(key, () => {
      if (selectedSegmentId && speakers[index]) {
        updateSegmentSpeaker(selectedSegmentId, speakers[index].name);
      }
    }, { enableOnFormTags: false });
  });

  const activeSegment = segments.find(
    s => currentTime >= s.start && currentTime <= s.end
  );

  useEffect(() => {
    if (!activeSegment) return;
    if (isPlaying || !selectedSegmentId) {
      if (activeSegment.id !== selectedSegmentId) {
        setSelectedSegmentId(activeSegment.id);
      }
    }
  }, [activeSegment, isPlaying, selectedSegmentId, setSelectedSegmentId]);

  useEffect(() => {
    if (!isPlaying || !activeSegment) return;
    const container = transcriptListRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(
      `[data-segment-id="${activeSegment.id}"]`,
    );
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [activeSegment?.id, isPlaying]);

  const filteredSegments = filterSpeaker
    ? segments.filter(s => s.speaker === filterSpeaker)
    : segments;

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between gap-4 h-14 px-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="button-toggle-sidebar"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-sm font-semibold tracking-tight">TranscriptEditor</h1>
          {audioFile && (
            <span className="text-xs text-muted-foreground ml-2">
              {audioFile.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={undo}
            disabled={!canUndo()}
            data-testid="button-undo"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={redo}
            disabled={!canRedo()}
            data-testid="button-redo"
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowShortcuts(true)}
            data-testid="button-show-shortcuts"
            aria-label="Keyboard shortcuts"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            onClick={() => setShowExport(true)}
            disabled={segments.length === 0}
            data-testid="button-export"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside 
          className={cn(
            "w-64 border-r bg-sidebar flex-shrink-0 transition-all duration-200",
            !sidebarOpen && "w-0 overflow-hidden border-0"
          )}
        >
          <SpeakerSidebar
            speakers={speakers}
            segments={segments}
            onRenameSpeaker={renameSpeaker}
            onAddSpeaker={addSpeaker}
            onSpeakerSelect={(name) => setFilterSpeaker(filterSpeaker === name ? undefined : name)}
            selectedSpeaker={filterSpeaker}
          />
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 space-y-4 border-b bg-card">
            <FileUpload
              onAudioUpload={handleAudioUpload}
              onTranscriptUpload={handleTranscriptUpload}
              audioFileName={audioFile?.name}
              transcriptLoaded={segments.length > 0}
            />

            <WaveformPlayer
              audioUrl={audioUrl}
              segments={segments}
              speakers={speakers}
              currentTime={currentTime}
              isPlaying={isPlaying}
              showSpeakerRegions={isWhisperXFormat}
              onTimeUpdate={setCurrentTime}
              onPlayPause={setIsPlaying}
              onDurationChange={setDuration}
              onSeek={setCurrentTime}
              onSegmentBoundaryChange={updateSegmentTiming}
            />

            <PlaybackControls
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
              onSkipBack={handleSkipBack}
              onSkipForward={handleSkipForward}
              disabled={!audioUrl}
            />
          </div>

          <ScrollArea className="flex-1">
            <div ref={transcriptListRef} className="max-w-4xl mx-auto p-4 space-y-2">
              {filteredSegments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {segments.length === 0 ? (
                    <>
                      <p className="text-lg font-medium mb-2">No transcript loaded</p>
                      <p className="text-sm">Upload an audio file and its Whisper or WhisperX JSON transcript to get started.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium mb-2">No segments for this speaker</p>
                      <p className="text-sm">Click the speaker again to show all segments.</p>
                    </>
                  )}
                </div>
              ) : (
                filteredSegments.map((segment, index) => (
                  <TranscriptSegment
                    key={segment.id}
                    segment={segment}
                    speakers={speakers}
                    isSelected={segment.id === selectedSegmentId}
                    isActive={activeSegment?.id === segment.id}
                    currentTime={currentTime}
                    onSelect={() => setSelectedSegmentId(segment.id)}
                    onTextChange={(text) => updateSegmentText(segment.id, text)}
                    onSpeakerChange={(speaker) => updateSegmentSpeaker(segment.id, speaker)}
                    onSplit={(wordIndex) => splitSegment(segment.id, wordIndex)}
                    onMergeWithPrevious={
                      index > 0 
                        ? () => mergeSegments(filteredSegments[index - 1].id, segment.id)
                        : undefined
                    }
                    onMergeWithNext={
                      index < filteredSegments.length - 1
                        ? () => mergeSegments(segment.id, filteredSegments[index + 1].id)
                        : undefined
                    }
                    onDelete={() => deleteSegment(segment.id)}
                    onSeek={handleSeek}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </main>
      </div>

      <KeyboardShortcuts open={showShortcuts} onOpenChange={setShowShortcuts} />
      <ExportDialog 
        open={showExport} 
        onOpenChange={setShowExport} 
        segments={segments}
        fileName={audioFile?.name?.replace(/\.[^/.]+$/, '') || 'transcript'}
      />
    </div>
  );
}
