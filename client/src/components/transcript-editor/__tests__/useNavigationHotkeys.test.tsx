import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNavigationHotkeys } from "../useNavigationHotkeys";

const hotkeyHandlers = new Map<string, (event: KeyboardEvent) => void>();

vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: (keys: string, handler: (event: KeyboardEvent) => void) => {
    hotkeyHandlers.set(keys, handler);
  },
}));

describe("useNavigationHotkeys", () => {
  const setSelectedSegmentId = vi.fn();
  const updateSegmentSpeaker = vi.fn();
  const mergeSegments = vi.fn();
  const toggleSegmentBookmark = vi.fn();
  const confirmSegment = vi.fn();
  const deleteSegment = vi.fn();
  const setEditRequestId = vi.fn();
  const handleSplitAtCurrentWord = vi.fn();
  const selectPreviousSegment = vi.fn();
  const selectNextSegment = vi.fn();
  const handlePlayPause = vi.fn();

  const baseOptions = {
    isTranscriptEditing: () => false,
    handleSkipBack: vi.fn(),
    handleSkipForward: vi.fn(),
    handleSeek: vi.fn(),
    duration: 10,
    currentTime: 2,
    handlePlayPause,
    setSelectedSegmentId,
    clearSpeakerFilter: vi.fn(),
    selectedSegmentId: "segment-1",
    segments: [
      { id: "segment-1", speaker: "SPEAKER_00", start: 0, end: 1, text: "", words: [], tags: [] },
      { id: "segment-2", speaker: "SPEAKER_01", start: 2, end: 3, text: "", words: [], tags: [] },
    ],
    speakers: [
      { id: "speaker-0", name: "SPEAKER_00", color: "red" },
      { id: "speaker-1", name: "SPEAKER_01", color: "blue" },
    ],
    tags: [],
    updateSegmentSpeaker,
    getSelectedSegmentIndex: () => 0,
    mergeSegments,
    toggleSegmentBookmark,
    toggleTagOnSegment: vi.fn(),
    confirmSegment,
    deleteSegment,
    setEditRequestId,
    handleSplitAtCurrentWord,
    canUndo: () => true,
    canRedo: () => true,
    undo: vi.fn(),
    redo: vi.fn(),
    selectPreviousSegment,
    selectNextSegment,
    onShowExport: vi.fn(),
    onShowShortcuts: vi.fn(),
    onShowSettings: vi.fn(),
  };

  beforeEach(() => {
    hotkeyHandlers.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("assigns speakers with numeric hotkeys", () => {
    renderHook(() => useNavigationHotkeys(baseOptions));
    const handler = hotkeyHandlers.get("1,2,3,4,5,6,7,8,9");
    expect(handler).toBeDefined();
    handler?.(new KeyboardEvent("keydown", { key: "2" }));
    expect(updateSegmentSpeaker).toHaveBeenCalledWith("segment-1", "SPEAKER_01");
  });

  it("handles split, merge, bookmark, confirm, and delete hotkeys", () => {
    renderHook(() =>
      useNavigationHotkeys({
        ...baseOptions,
        mergeSegments: mergeSegments.mockReturnValue("merged-id"),
        segments: [
          ...baseOptions.segments,
          {
            id: "segment-3",
            speaker: "SPEAKER_00",
            start: 4,
            end: 5,
            text: "",
            words: [],
            tags: [],
          },
        ],
        selectedSegmentId: "segment-2",
        getSelectedSegmentIndex: () => 1,
      }),
    );

    hotkeyHandlers.get("s")?.(new KeyboardEvent("keydown", { key: "s" }));
    expect(handleSplitAtCurrentWord).toHaveBeenCalled();

    hotkeyHandlers.get("p")?.(new KeyboardEvent("keydown", { key: "p" }));
    expect(setSelectedSegmentId).toHaveBeenCalledWith("merged-id");

    hotkeyHandlers.get("m")?.(new KeyboardEvent("keydown", { key: "m" }));
    expect(mergeSegments).toHaveBeenCalledWith("segment-2", "segment-3");

    hotkeyHandlers.get("b")?.(new KeyboardEvent("keydown", { key: "b" }));
    expect(toggleSegmentBookmark).toHaveBeenCalledWith("segment-2");

    hotkeyHandlers.get("c")?.(new KeyboardEvent("keydown", { key: "c" }));
    expect(confirmSegment).toHaveBeenCalledWith("segment-2");

    hotkeyHandlers.get("delete")?.(new KeyboardEvent("keydown", { key: "Delete" }));
    expect(deleteSegment).toHaveBeenCalledWith("segment-2");
    expect(setSelectedSegmentId).toHaveBeenCalledWith(null);
  });

  it("starts editing with the edit hotkey", () => {
    renderHook(() => useNavigationHotkeys(baseOptions));
    hotkeyHandlers.get("e")?.(new KeyboardEvent("keydown", { key: "e" }));
    expect(setEditRequestId).toHaveBeenCalledWith("segment-1");
  });

  it("toggles play/pause with the space key when not editing", () => {
    renderHook(() => useNavigationHotkeys(baseOptions));
    const event = new KeyboardEvent("keydown", { key: " ", bubbles: true });
    window.dispatchEvent(event);
    expect(handlePlayPause).toHaveBeenCalled();
  });

  it("does not register the enter hotkey", () => {
    renderHook(() => useNavigationHotkeys(baseOptions));
    expect(hotkeyHandlers.has("enter")).toBe(false);
  });

  it("ignores arrow navigation while a menu item is focused", () => {
    renderHook(() => useNavigationHotkeys(baseOptions));
    const menuItem = document.createElement("div");
    menuItem.setAttribute("role", "menuitem");
    document.body.appendChild(menuItem);

    menuItem.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

    expect(selectNextSegment).not.toHaveBeenCalled();
    document.body.removeChild(menuItem);
  });

  it("ignores hotkeys while editing", () => {
    renderHook(() =>
      useNavigationHotkeys({
        ...baseOptions,
        isTranscriptEditing: () => true,
      }),
    );

    hotkeyHandlers.forEach((handler) => {
      handler(new KeyboardEvent("keydown", { key: "b" }));
    });
    expect(toggleSegmentBookmark).not.toHaveBeenCalled();
  });
});
