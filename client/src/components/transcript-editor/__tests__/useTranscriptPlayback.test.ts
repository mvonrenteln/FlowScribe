import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTranscriptPlayback } from "../useTranscriptPlayback";

const useNavigationHotkeysMock = vi.fn();

vi.mock("../useNavigationHotkeys", () => ({
  useNavigationHotkeys: (...args: unknown[]) => useNavigationHotkeysMock(...args),
}));

describe("useTranscriptPlayback", () => {
  const setIsPlaying = vi.fn();
  const seekToTime = vi.fn();
  const setSelectedSegmentId = vi.fn();
  const setEditRequestId = vi.fn();
  const segments = [
    { id: "s1", speaker: "A", tags: [], start: 0, end: 5, text: "hello", words: [] },
    { id: "s2", speaker: "A", tags: [], start: 6, end: 10, text: "world", words: [] },
  ];

  beforeEach(() => {
    useNavigationHotkeysMock.mockReset();
    setIsPlaying.mockReset();
    seekToTime.mockReset();
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
    segments,
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
    setIsPlaying,
    seekToTime,
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

    expect(seekToTime).toHaveBeenCalledWith(12.5, { source: "transcript", action: "controls" });
  });

  it("forwards waveform seeks through the shared handler", () => {
    const { result } = renderHook(() => useTranscriptPlayback(defaultParams));

    act(() => {
      result.current.handleWaveformSeek(7);
    });

    expect(seekToTime).toHaveBeenCalledWith(7, { source: "waveform" });
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
