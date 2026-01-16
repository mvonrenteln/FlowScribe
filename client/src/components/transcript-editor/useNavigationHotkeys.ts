import { useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { Segment, Speaker, Tag } from "@/lib/store";

interface UseNavigationHotkeysOptions {
  isTranscriptEditing: () => boolean;
  handleSkipBack: () => void;
  handleSkipForward: () => void;
  handleSeek: (time: number, meta?: { source?: string }) => void;
  duration: number;
  currentTime: number;
  handlePlayPause: () => void;
  setSelectedSegmentId: (id: string | null) => void;
  clearSpeakerFilter: () => void;
  selectedSegmentId: string | null;
  segments: Segment[];
  speakers: Speaker[];
  tags: Tag[];
  updateSegmentSpeaker: (id: string, speaker: string) => void;
  toggleTagOnSegment: (segmentId: string, tagId: string) => void;
  getSelectedSegmentIndex: () => number;
  mergeSegments: (id1: string, id2: string) => string | null;
  toggleSegmentBookmark: (id: string) => void;
  confirmSegment: (id: string) => void;
  deleteSegment: (id: string) => void;
  setEditRequestId: (id: string) => void;
  seekToTime: (time: number) => void;
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
  // AI Segment Merge
  onOpenAISegmentMerge?: () => void;
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
  tags,
  updateSegmentSpeaker,
  toggleTagOnSegment,
  getSelectedSegmentIndex,
  mergeSegments,
  toggleSegmentBookmark,
  confirmSegment,
  deleteSegment,
  setEditRequestId,
  seekToTime,
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
  onOpenAISegmentMerge,
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
      handleSeek(Math.max(0, currentTime - 1), { source: "hotkey" });
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "right",
    () => {
      if (isTranscriptEditing()) return;
      handleSeek(Math.min(duration, currentTime + 1), { source: "hotkey" });
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "home",
    () => {
      if (isTranscriptEditing()) return;
      handleSeek(0, { source: "hotkey" });
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "end",
    () => {
      if (isTranscriptEditing()) return;
      handleSeek(duration, { source: "hotkey" });
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
      seekToTime(segment.start);
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

  // Track if T key was recently pressed to avoid speaker assignment when doing T+1
  const tKeyPressedRef = useRef(false);
  const tKeyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useHotkeys(
    "1,2,3,4,5,6,7,8,9",
    (event) => {
      // Don't assign speaker if T was just pressed (T+number for tags)
      if (tKeyPressedRef.current) {
        event.preventDefault();
        return;
      }
      if (isTranscriptEditing()) return;
      const speakerIndex = Number(event.key) - 1;
      if (!Number.isInteger(speakerIndex)) return;
      if (selectedSegmentId && speakers[speakerIndex]) {
        updateSegmentSpeaker(selectedSegmentId, speakers[speakerIndex].name);
      }
    },
    { enableOnFormTags: false },
  );

  // Alt/Option+1..0 -> toggle tags 1..10 on the selected segment
  // Use capture-phase listener that uses `event.code` (Digit1..Digit0) and `altKey`
  // to reliably detect Option/Alt+digit on macOS even when a segment is focused.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTranscriptEditing()) return;
      if (!selectedSegmentId) return;

      // Only react to Alt/Option + Digit keys
      if (!e.altKey) return;
      const code = e.code || "";
      if (!code.startsWith("Digit")) return;

      // Map Digit1..Digit9 -> 0..8, Digit0 -> 9
      const digit = code.replace("Digit", "");
      let tagIndex = -1;
      if (digit === "0") {
        tagIndex = 9;
      } else {
        const n = Number.parseInt(digit, 10);
        if (!Number.isNaN(n)) tagIndex = n - 1;
      }

      if (tagIndex < 0 || tagIndex >= tags.length) return;

      // Prevent default browser behavior and toggle tag
      e.preventDefault();
      e.stopPropagation();
      toggleTagOnSegment(selectedSegmentId, tags[tagIndex].id);
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [tags, selectedSegmentId, toggleTagOnSegment, isTranscriptEditing]);

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

      // Always prevent default and use arrow keys for segment navigation
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

  // AI Segment Merge: Alt+Shift+M to open dialog
  useHotkeys(
    "alt+shift+m",
    () => {
      if (isTranscriptEditing()) return;
      onOpenAISegmentMerge?.();
    },
    { enableOnFormTags: false, preventDefault: true },
  );

  // Tag Assignment: T+1...0 to toggle tags
  useEffect(() => {
    const handleTKey = (event: KeyboardEvent) => {
      if (isTranscriptEditing()) return;
      if (!selectedSegmentId) return;

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        const isFormElement = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
        if (isFormElement || target.isContentEditable) return;
      }

      // Handle T key press
      if (
        (event.key === "t" || event.key === "T") &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault(); // Prevent default T key behavior
        tKeyPressedRef.current = true;

        // Open tag menu dropdown on the selected segment
        const segmentEl = document.querySelector(`[data-segment-id="${selectedSegmentId}"]`);
        if (segmentEl) {
          // Try to find and click the Add Tag button in the segment header
          const addTagButton = segmentEl.querySelector(
            '[data-testid*="button-add-tag"], [data-testid*="button-add-first-tag"]',
          ) as HTMLButtonElement;
          if (addTagButton) {
            // Small delay to ensure T key press is processed first
            setTimeout(() => {
              addTagButton.click();
            }, 10);
          }
        }

        // Reset flag after timeout
        if (tKeyTimerRef.current) clearTimeout(tKeyTimerRef.current);
        tKeyTimerRef.current = setTimeout(() => {
          tKeyPressedRef.current = false;
        }, 500);
      }
    };

    const handleNumberKey = (event: KeyboardEvent) => {
      if (!tKeyPressedRef.current) return;
      if (isTranscriptEditing()) return;
      if (!selectedSegmentId) return;

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        const isFormElement = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
        if (isFormElement || target.isContentEditable) return;
      }

      const key = event.key;
      let tagIndex = -1;

      if (key >= "1" && key <= "9") {
        tagIndex = Number.parseInt(key, 10) - 1;
      } else if (key === "0") {
        tagIndex = 9; // Tag #10
      }

      if (tagIndex >= 0 && tagIndex < tags.length) {
        event.preventDefault();
        event.stopPropagation();
        toggleTagOnSegment(selectedSegmentId, tags[tagIndex].id);
        tKeyPressedRef.current = false; // Reset flag after successful tag toggle
        if (tKeyTimerRef.current) clearTimeout(tKeyTimerRef.current);
      }
    };

    window.addEventListener("keydown", handleTKey, { capture: true });
    window.addEventListener("keydown", handleNumberKey, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleTKey, { capture: true });
      window.removeEventListener("keydown", handleNumberKey, { capture: true });
      if (tKeyTimerRef.current) clearTimeout(tKeyTimerRef.current);
    };
  }, [isTranscriptEditing, selectedSegmentId, tags, toggleTagOnSegment]);
}
