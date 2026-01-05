import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTranscriptPlayback } from "../useTranscriptPlayback";

const useNavigationHotkeysMock = vi.fn();

vi.mock("../useNavigationHotkeys", () => ({
  useNavigationHotkeys: (...args: unknown[]) => useNavigationHotkeysMock(...args),
}));

describe("useTranscriptPlayback", () => {
  const setIsPlaying = vi.fn();
  const setCurrentTime = vi.fn();
  const requestSeek = vi.fn();
  const setSelectedSegmentId = vi.fn();
  const setEditRequestId = vi.fn();

  beforeEach(() => {
    useNavigationHotkeysMock.mockReset();
    setIsPlaying.mockReset();
    setCurrentTime.mockReset();
    requestSeek.mockReset();
    setSelectedSegmentId.mockReset();
    setEditRequestId.mockReset();
  });

  const defaultParams = {
    isTranscriptEditing: () => false,
    isPlaying: false,
    currentTime: 0,
    duration: 20,
    filteredSegments: [],
    selectedSegmentId: null as string | null,
    segments: [],
    speakers: [],
    canUndo: () => false,
    canRedo: () => false,
    undo: vi.fn(),
    redo: vi.fn(),
    handleSplitAtCurrentWord: vi.fn(),
    canSplitAtCurrentWord: false,
    selectPreviousSegment: vi.fn(),
    selectNextSegment: vi.fn(),
    mergeSegments: vi.fn(),
    toggleSegmentBookmark: vi.fn(),
    confirmSegment: vi.fn(),
    deleteSegment: vi.fn(),
    updateSegmentSpeaker: vi.fn(),
    setSelectedSegmentId,
    setCurrentTime,
    setIsPlaying,
    requestSeek,
    onShowExport: vi.fn(),
    onShowShortcuts: vi.fn(),
    onShowSettings: vi.fn(),
    onRunDefaultAIRevision: vi.fn(),
    onOpenAIRevisionMenu: vi.fn(),
    onOpenAISegmentMerge: vi.fn(),
    setEditRequestId,
    onClearSpeakerFilter: vi.fn(),
    hasAudioSource: true,
  };

  it("toggles playback state", () => {
    const { result, rerender } = renderHook((props) => useTranscriptPlayback(props), {
      initialProps: defaultParams,
    });

    act(() => {
      result.current.playbackControlsProps.onPlayPause();
    });
    expect(setIsPlaying).toHaveBeenCalledWith(true);

    rerender({ ...defaultParams, isPlaying: true });
    act(() => {
      result.current.playbackControlsProps.onPlayPause();
    });
    expect(setIsPlaying).toHaveBeenCalledWith(false);
  });

  it("seeks to requested time", () => {
    const { result } = renderHook(() => useTranscriptPlayback(defaultParams));

    act(() => {
      result.current.handleSeekInternal(12.5);
    });

    expect(setCurrentTime).toHaveBeenCalledWith(12.5);
    expect(requestSeek).toHaveBeenCalledWith(12.5);
  });

  it("wires hotkeys with the provided callbacks", () => {
    renderHook(() => useTranscriptPlayback(defaultParams));

    expect(useNavigationHotkeysMock).toHaveBeenCalledWith(
      expect.objectContaining({
        handlePlayPause: expect.any(Function),
        onShowExport: defaultParams.onShowExport,
        onOpenAISegmentMerge: defaultParams.onOpenAISegmentMerge,
        setEditRequestId: expect.any(Function),
      }),
    );
  });

  it("disables controls when no audio is available", () => {
    const { result } = renderHook(() =>
      useTranscriptPlayback({
        ...defaultParams,
        hasAudioSource: false,
      }),
    );

    expect(result.current.playbackControlsProps.disabled).toBe(true);
  });
});
