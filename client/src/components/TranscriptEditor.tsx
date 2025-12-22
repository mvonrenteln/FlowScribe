import { Download, Keyboard, PanelLeft, PanelLeftClose, Redo2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useTranscriptStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ExportDialog } from "./ExportDialog";
import { FileUpload } from "./FileUpload";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { PlaybackControls } from "./PlaybackControls";
import { SpeakerSidebar } from "./SpeakerSidebar";
import { ThemeToggle } from "./ThemeToggle";
import { TranscriptSegment } from "./TranscriptSegment";
import { WaveformPlayer } from "./WaveformPlayer";

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
    clearSeekRequest,
    updateSegmentText,
    updateSegmentSpeaker,
    splitSegment,
    mergeSegments,
    updateSegmentTiming,
    deleteSegment,
    renameSpeaker,
    addSpeaker,
    mergeSpeakers,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useTranscriptStore();

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterSpeakerId, setFilterSpeakerId] = useState<string | undefined>();
  const transcriptListRef = useRef<HTMLDivElement>(null);

  const handleAudioUpload = useCallback(
    (file: File) => {
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
    },
    [setAudioFile, setAudioUrl],
  );

  const handleTranscriptUpload = useCallback(
    (data: unknown) => {
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
        return Array.isArray(d) && d.length > 0 && "timestamp" in d[0];
      };

      const checkIsWhisperXFormat = (d: unknown): d is { segments: WhisperXSegment[] } => {
        return typeof d === "object" && d !== null && "segments" in d;
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
          const wordsArray = text.split(/\s+/).filter((w) => w.length > 0);
          const segDuration = end - start;
          const wordDuration =
            wordsArray.length > 0 ? segDuration / wordsArray.length : segDuration;

          return {
            id: `seg-${idx}`,
            speaker: "SPEAKER_00",
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
          speaker: seg.speaker || "SPEAKER_00",
          start: seg.start,
          end: seg.end,
          text: seg.text.trim(),
          words:
            seg.words ||
            seg.text
              .trim()
              .split(/\s+/)
              .filter((w) => w.length > 0)
              .map((word, i, arr) => {
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
        console.error("Unknown transcript format. Expected Whisper or WhisperX format.");
        return;
      }

      if (processedSegments.length > 0) {
        loadTranscript({ segments: processedSegments, isWhisperXFormat: detectedWhisperXFormat });
      }
    },
    [loadTranscript],
  );

  const handleRenameSpeaker = useCallback(
    (oldName: string, newName: string) => {
      renameSpeaker(oldName, newName);
    },
    [renameSpeaker],
  );

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying, setIsPlaying]);

  const handleSeek = useCallback(
    (time: number) => {
      setCurrentTime(time);
      requestSeek(time);
    },
    [requestSeek, setCurrentTime],
  );

  const handleSkipBack = useCallback(() => {
    requestSeek(Math.max(0, currentTime - 5));
  }, [currentTime, requestSeek]);

  const handleSkipForward = useCallback(() => {
    requestSeek(Math.min(duration, currentTime + 5));
  }, [currentTime, duration, requestSeek]);

  const activeSpeakerName = filterSpeakerId
    ? speakers.find((speaker) => speaker.id === filterSpeakerId)?.name
    : undefined;
  const filteredSegments = activeSpeakerName
    ? segments.filter((s) => s.speaker === activeSpeakerName)
    : segments;

  const getSelectedSegmentIndex = useCallback(() => {
    return filteredSegments.findIndex((s) => s.id === selectedSegmentId);
  }, [filteredSegments, selectedSegmentId]);

  const selectPreviousSegment = useCallback(() => {
    const currentIndex = getSelectedSegmentIndex();
    if (currentIndex > 0) {
      const segment = filteredSegments[currentIndex - 1];
      setSelectedSegmentId(segment.id);
      handleSeek(segment.start);
    } else if (currentIndex === -1 && filteredSegments.length > 0) {
      const segment = filteredSegments[filteredSegments.length - 1];
      setSelectedSegmentId(segment.id);
      handleSeek(segment.start);
    }
  }, [getSelectedSegmentIndex, filteredSegments, setSelectedSegmentId, handleSeek]);

  const selectNextSegment = useCallback(() => {
    const currentIndex = getSelectedSegmentIndex();
    if (currentIndex < filteredSegments.length - 1) {
      const segment = filteredSegments[currentIndex + 1];
      setSelectedSegmentId(segment.id);
      handleSeek(segment.start);
    } else if (currentIndex === -1 && filteredSegments.length > 0) {
      const segment = filteredSegments[0];
      setSelectedSegmentId(segment.id);
      handleSeek(segment.start);
    }
  }, [getSelectedSegmentIndex, filteredSegments, setSelectedSegmentId, handleSeek]);

  useEffect(() => {
    const handleGlobalSpace = (event: KeyboardEvent) => {
      if (event.key !== " ") return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        const isFormElement = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
        if (isFormElement || target.isContentEditable) return;
      }
      event.preventDefault();
      handlePlayPause();
    };

    window.addEventListener("keydown", handleGlobalSpace, { capture: true });
    return () => window.removeEventListener("keydown", handleGlobalSpace, { capture: true });
  }, [handlePlayPause]);
  useHotkeys("j", handleSkipBack, { enableOnFormTags: false });
  useHotkeys("l", handleSkipForward, { enableOnFormTags: false });
  useHotkeys("left", () => handleSeek(Math.max(0, currentTime - 1)), { enableOnFormTags: false });
  useHotkeys("right", () => handleSeek(Math.min(duration, currentTime + 1)), {
    enableOnFormTags: false,
  });
  useHotkeys("home", () => handleSeek(0), { enableOnFormTags: false });
  useHotkeys("end", () => handleSeek(duration), { enableOnFormTags: false });
  useHotkeys("escape", () => {
    setSelectedSegmentId(null);
    setFilterSpeakerId(undefined);
  });
  useHotkeys(
    "mod+z",
    () => {
      if (canUndo()) undo();
    },
    { enableOnFormTags: true, enableOnContentEditable: true, preventDefault: true },
  );
  useHotkeys(
    "mod+shift+z",
    () => {
      if (canRedo()) redo();
    },
    { enableOnFormTags: true, enableOnContentEditable: true, preventDefault: true },
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const isEditable = target.isContentEditable;
      const tagName = target.tagName;
      const isFormElement = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";

      if (isEditable || isFormElement) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

      if (event.key.toLowerCase() === "z") {
        if (canUndo()) {
          event.preventDefault();
          undo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, undo]);
  useHotkeys("mod+e", () => setShowExport(true));
  useHotkeys("shift+/", () => setShowShortcuts(true));
  useHotkeys(
    "enter",
    () => {
      if (!selectedSegmentId) return;
      const segment = segments.find((s) => s.id === selectedSegmentId);
      if (!segment) return;
      requestSeek(segment.start);
      setIsPlaying(true);
    },
    { enableOnFormTags: false, enableOnContentEditable: false, preventDefault: true },
  );

  useHotkeys(
    "m",
    () => {
      if (selectedSegmentId) {
        const index = getSelectedSegmentIndex();
        if (index < segments.length - 1) {
          const mergedId = mergeSegments(selectedSegmentId, segments[index + 1].id);
          if (mergedId) {
            setSelectedSegmentId(mergedId);
          }
        }
      }
    },
    { enableOnFormTags: true, enableOnContentEditable: true, preventDefault: true },
  );

  useHotkeys(
    "delete",
    () => {
      if (selectedSegmentId) {
        deleteSegment(selectedSegmentId);
        setSelectedSegmentId(null);
      }
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "1,2,3,4,5,6,7,8,9",
    (event) => {
      const speakerIndex = Number(event.key) - 1;
      if (!Number.isInteger(speakerIndex)) return;
      if (selectedSegmentId && speakers[speakerIndex]) {
        updateSegmentSpeaker(selectedSegmentId, speakers[speakerIndex].name);
      }
    },
    { enableOnFormTags: false },
  );

  const activeSegment = segments.find((s) => currentTime >= s.start && currentTime <= s.end);
  const isActiveSegmentVisible = useMemo(() => {
    if (!activeSegment) return false;
    if (!activeSpeakerName) return true;
    return filteredSegments.some((segment) => segment.id === activeSegment.id);
  }, [activeSegment, activeSpeakerName, filteredSegments]);

  const getSplitWordIndex = useCallback(() => {
    if (!activeSegment) return null;
    const { words } = activeSegment;
    if (words.length < 2) return null;
    let index = words.findIndex((word) => currentTime >= word.start && currentTime <= word.end);
    if (index === -1) {
      index = words.findIndex((word) => currentTime < word.start);
      if (index === -1) {
        index = words.length - 1;
      }
    }
    if (index <= 0) {
      return words.length > 1 ? 1 : null;
    }
    if (index >= words.length) return null;
    return index;
  }, [activeSegment, currentTime]);

  const handleSplitSegment = useCallback(
    (segmentId: string, wordIndex: number) => {
      const wasPlaying = isPlaying;
      const resumeTime = currentTime;
      splitSegment(segmentId, wordIndex);
      if (wasPlaying) {
        setCurrentTime(resumeTime);
        clearSeekRequest();
      }
    },
    [clearSeekRequest, currentTime, isPlaying, setCurrentTime, splitSegment],
  );

  const handleSplitAtCurrentWord = useCallback(() => {
    const index = getSplitWordIndex();
    if (index === null || !activeSegment) return;
    handleSplitSegment(activeSegment.id, index);
  }, [activeSegment, getSplitWordIndex, handleSplitSegment]);

  const splitWordIndex = getSplitWordIndex();
  const canSplitAtCurrentWord = splitWordIndex !== null;

  useHotkeys("s", handleSplitAtCurrentWord, {
    enableOnFormTags: false,
    enableOnContentEditable: false,
    preventDefault: true,
  });
  const activeSegmentId = activeSegment?.id ?? null;
  const activeWordIndex = useMemo(() => {
    if (!activeSegment) return -1;
    return activeSegment.words.findIndex((w) => currentTime >= w.start && currentTime <= w.end);
  }, [activeSegment, currentTime]);

  useEffect(() => {
    if (!activeSegment || !isActiveSegmentVisible) return;
    if (activeSegment.id !== selectedSegmentId) {
      setSelectedSegmentId(activeSegment.id);
    }
  }, [activeSegment, isActiveSegmentVisible, selectedSegmentId, setSelectedSegmentId]);

  useEffect(() => {
    if (!activeSegment) return;
    const container = transcriptListRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-segment-id="${activeSegment.id}"]`);
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [activeSegment]);

  useEffect(() => {
    if (!selectedSegmentId || isPlaying) return;
    const container = transcriptListRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-segment-id="${selectedSegmentId}"]`);
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [selectedSegmentId, isPlaying]);

  useEffect(() => {
    const handleGlobalArrowNav = (event: KeyboardEvent) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        const isFormElement = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
        if (isFormElement || target.isContentEditable) return;
      }
      event.preventDefault();
      if (event.key === "ArrowUp") {
        selectPreviousSegment();
      } else {
        selectNextSegment();
      }
    };

    window.addEventListener("keydown", handleGlobalArrowNav, { capture: true });
    return () => window.removeEventListener("keydown", handleGlobalArrowNav, { capture: true });
  }, [selectNextSegment, selectPreviousSegment]);

  const segmentHandlers = useMemo(
    () =>
      filteredSegments.map((segment, index) => {
        const onMergeWithPrevious =
          index > 0
            ? () => {
                const mergedId = mergeSegments(filteredSegments[index - 1].id, segment.id);
                if (mergedId) {
                  setSelectedSegmentId(mergedId);
                }
              }
            : undefined;

        const onMergeWithNext =
          index < filteredSegments.length - 1
            ? () => {
                const mergedId = mergeSegments(segment.id, filteredSegments[index + 1].id);
                if (mergedId) {
                  setSelectedSegmentId(mergedId);
                }
              }
            : undefined;

        return {
          onSelect: () => {
            setSelectedSegmentId(segment.id);
            handleSeek(segment.start);
          },
          onTextChange: (text: string) => updateSegmentText(segment.id, text),
          onSpeakerChange: (speaker: string) => updateSegmentSpeaker(segment.id, speaker),
          onSplit: (wordIndex: number) => handleSplitSegment(segment.id, wordIndex),
          onMergeWithPrevious,
          onMergeWithNext,
          onDelete: () => deleteSegment(segment.id),
        };
      }),
    [
      filteredSegments,
      handleSeek,
      mergeSegments,
      setSelectedSegmentId,
      updateSegmentSpeaker,
      updateSegmentText,
      splitSegment,
      deleteSegment,
    ],
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between gap-4 h-14 px-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="button-toggle-sidebar"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-sm font-semibold tracking-tight">TranscriptEditor</h1>
          {audioFile && (
            <span className="text-xs text-muted-foreground ml-2">{audioFile.name}</span>
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
            !sidebarOpen && "w-0 overflow-hidden border-0",
          )}
        >
          <SpeakerSidebar
            speakers={speakers}
            segments={segments}
            onRenameSpeaker={handleRenameSpeaker}
            onAddSpeaker={addSpeaker}
            onMergeSpeakers={mergeSpeakers}
            onSpeakerSelect={(id) =>
              setFilterSpeakerId((current) => (current === id ? undefined : id))
            }
            onClearFilter={() => setFilterSpeakerId(undefined)}
            selectedSpeakerId={filterSpeakerId}
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
              onSplitAtCurrentWord={handleSplitAtCurrentWord}
              canSplitAtCurrentWord={canSplitAtCurrentWord}
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
                      <p className="text-sm">
                        Upload an audio file and its Whisper or WhisperX JSON transcript to get
                        started.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium mb-2">No segments for this speaker</p>
                      <p className="text-sm">Click the speaker again to show all segments.</p>
                    </>
                  )}
                </div>
              ) : (
                filteredSegments.map((segment, index) => {
                  const handlers = segmentHandlers[index];
                  const resolvedSplitWordIndex =
                    activeSegmentId === segment.id ? splitWordIndex : null;
                  return (
                    <TranscriptSegment
                      key={segment.id}
                      segment={segment}
                      speakers={speakers}
                      isSelected={segment.id === selectedSegmentId}
                      isActive={activeSegmentId === segment.id}
                      activeWordIndex={activeSegmentId === segment.id ? activeWordIndex : undefined}
                      splitWordIndex={resolvedSplitWordIndex ?? undefined}
                      onSelect={handlers.onSelect}
                      onTextChange={handlers.onTextChange}
                      onSpeakerChange={handlers.onSpeakerChange}
                      onSplit={handlers.onSplit}
                      onMergeWithPrevious={handlers.onMergeWithPrevious}
                      onMergeWithNext={handlers.onMergeWithNext}
                      onDelete={handlers.onDelete}
                      onSeek={handleSeek}
                    />
                  );
                })
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
        fileName={audioFile?.name?.replace(/\.[^/.]+$/, "") || "transcript"}
      />
    </div>
  );
}
