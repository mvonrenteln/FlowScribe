import { useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { Segment, Speaker } from "@/lib/store";

interface UseNavigationHotkeysOptions {
  isTranscriptEditing: () => boolean;
  handleSkipBack: () => void;
  handleSkipForward: () => void;
  handleSeek: (time: number) => void;
  duration: number;
  currentTime: number;
  handlePlayPause: () => void;
  setSelectedSegmentId: (id: string | null) => void;
  clearSpeakerFilter: () => void;
  selectedSegmentId: string | null;
  segments: Segment[];
  speakers: Speaker[];
  updateSegmentSpeaker: (id: string, speaker: string) => void;
  getSelectedSegmentIndex: () => number;
  mergeSegments: (id1: string, id2: string) => string | null;
  toggleSegmentBookmark: (id: string) => void;
  confirmSegment: (id: string) => void;
  deleteSegment: (id: string) => void;
  setEditRequestId: (id: string) => void;
  requestSeek: (time: number) => void;
  setIsPlaying: (value: boolean) => void;
  handleSplitAtCurrentWord: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
  selectPreviousSegment: () => void;
  selectNextSegment: () => void;
  onShowExport: () => void;
  onShowShortcuts: () => void;
  onShowSettings: () => void;
  // AI Revision
  onRunDefaultAIRevision?: () => void;
  onOpenAIRevisionMenu?: () => void;
}

export function useNavigationHotkeys({
  isTranscriptEditing,
  handleSkipBack,
  handleSkipForward,
  handleSeek,
  duration,
  currentTime,
  handlePlayPause,
  setSelectedSegmentId,
  clearSpeakerFilter,
  selectedSegmentId,
  segments,
  speakers,
  updateSegmentSpeaker,
  getSelectedSegmentIndex,
  mergeSegments,
  toggleSegmentBookmark,
  confirmSegment,
  deleteSegment,
  setEditRequestId,
  requestSeek,
  setIsPlaying,
  handleSplitAtCurrentWord,
  canUndo,
  canRedo,
  undo,
  redo,
  selectPreviousSegment,
  selectNextSegment,
  onShowExport,
  onShowShortcuts,
  onShowSettings,
  onRunDefaultAIRevision,
  onOpenAIRevisionMenu,
}: UseNavigationHotkeysOptions) {
  useEffect(() => {
    const handleGlobalSpace = (event: KeyboardEvent) => {
      if (isTranscriptEditing()) return;
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
  }, [handlePlayPause, isTranscriptEditing]);

  useHotkeys(
    "j",
    () => {
      if (isTranscriptEditing()) return;
      handleSkipBack();
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "l",
    () => {
      if (isTranscriptEditing()) return;
      handleSkipForward();
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "left",
    () => {
      if (isTranscriptEditing()) return;
      handleSeek(Math.max(0, currentTime - 1));
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "right",
    () => {
      if (isTranscriptEditing()) return;
      handleSeek(Math.min(duration, currentTime + 1));
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "home",
    () => {
      if (isTranscriptEditing()) return;
      handleSeek(0);
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "end",
    () => {
      if (isTranscriptEditing()) return;
      handleSeek(duration);
    },
    { enableOnFormTags: false },
  );

  useHotkeys("escape", () => {
    if (isTranscriptEditing()) return;
    setSelectedSegmentId(null);
    clearSpeakerFilter();
  });

  useHotkeys(
    "mod+z",
    () => {
      if (isTranscriptEditing()) return;
      if (canUndo()) undo();
    },
    { enableOnFormTags: true, enableOnContentEditable: true, preventDefault: true },
  );

  useHotkeys(
    "mod+shift+z",
    () => {
      if (isTranscriptEditing()) return;
      if (canRedo()) redo();
    },
    { enableOnFormTags: true, enableOnContentEditable: true, preventDefault: true },
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTranscriptEditing()) return;
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
  }, [canUndo, isTranscriptEditing, undo]);

  useHotkeys(
    "enter",
    () => {
      if (isTranscriptEditing()) return;
      if (!selectedSegmentId) return;
      const segment = segments.find((s) => s.id === selectedSegmentId);
      if (!segment) return;
      requestSeek(segment.start);
      setIsPlaying(true);
    },
    { enableOnFormTags: false, enableOnContentEditable: false, preventDefault: true },
  );

  useHotkeys(
    "e",
    () => {
      if (isTranscriptEditing()) return;
      if (selectedSegmentId) {
        setEditRequestId(selectedSegmentId);
      }
    },
    { enableOnFormTags: false, enableOnContentEditable: false, preventDefault: true },
  );

  useHotkeys(
    "p",
    () => {
      if (isTranscriptEditing()) return;
      if (selectedSegmentId) {
        const index = getSelectedSegmentIndex();
        if (index > 0) {
          const mergedId = mergeSegments(segments[index - 1].id, selectedSegmentId);
          if (mergedId) {
            setSelectedSegmentId(mergedId);
          }
        }
      }
    },
    { enableOnFormTags: false, enableOnContentEditable: false, preventDefault: true },
  );

  useHotkeys(
    "m",
    () => {
      if (isTranscriptEditing()) return;
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
    { enableOnFormTags: false, enableOnContentEditable: false, preventDefault: true },
  );

  useHotkeys("mod+e", () => {
    if (isTranscriptEditing()) return;
    onShowExport();
  });

  useHotkeys("mod+,", () => {
    if (isTranscriptEditing()) return;
    onShowSettings();
  });

  useHotkeys("shift+/", () => {
    if (isTranscriptEditing()) return;
    onShowShortcuts();
  });

  useHotkeys(
    "b",
    () => {
      if (isTranscriptEditing()) return;
      if (selectedSegmentId) {
        toggleSegmentBookmark(selectedSegmentId);
      }
    },
    { enableOnFormTags: false, enableOnContentEditable: false, preventDefault: true },
  );

  useHotkeys(
    "c",
    () => {
      if (isTranscriptEditing()) return;
      if (selectedSegmentId) {
        confirmSegment(selectedSegmentId);
      }
    },
    { enableOnFormTags: false, enableOnContentEditable: false, preventDefault: true },
  );

  useHotkeys(
    "delete",
    () => {
      if (isTranscriptEditing()) return;
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
      if (isTranscriptEditing()) return;
      const speakerIndex = Number(event.key) - 1;
      if (!Number.isInteger(speakerIndex)) return;
      if (selectedSegmentId && speakers[speakerIndex]) {
        updateSegmentSpeaker(selectedSegmentId, speakers[speakerIndex].name);
      }
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "s",
    () => {
      if (isTranscriptEditing()) return;
      handleSplitAtCurrentWord();
    },
    {
      enableOnFormTags: false,
      enableOnContentEditable: false,
      preventDefault: true,
    },
  );

  useEffect(() => {
    const handleGlobalArrowNav = (event: KeyboardEvent) => {
      if (isTranscriptEditing()) return;
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
  }, [selectNextSegment, selectPreviousSegment, isTranscriptEditing]);

  // AI Revision: Alt+R to run default template
  useHotkeys(
    "alt+r",
    () => {
      if (isTranscriptEditing()) return;
      if (!selectedSegmentId) return;
      onRunDefaultAIRevision?.();
    },
    { enableOnFormTags: false, preventDefault: true },
  );

  // AI Revision: Alt+Shift+R to open menu
  useHotkeys(
    "alt+shift+r",
    () => {
      if (isTranscriptEditing()) return;
      if (!selectedSegmentId) return;
      onOpenAIRevisionMenu?.();
    },
    { enableOnFormTags: false, preventDefault: true },
  );
}
