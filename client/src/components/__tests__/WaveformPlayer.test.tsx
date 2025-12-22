import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WaveformPlayer } from "@/components/WaveformPlayer";
import { useTranscriptStore } from "@/lib/store";

const waveSurferMock = vi.hoisted(() => {
  const handlers = new Map<string, (arg?: number) => void>();
  const instance = {
    on: vi.fn((event: string, callback: (arg?: number) => void) => {
      handlers.set(event, callback);
    }),
    load: vi.fn(),
    destroy: vi.fn(),
    setOptions: vi.fn(),
    registerPlugin: vi.fn(),
    zoom: vi.fn(),
    getDuration: vi.fn(() => 120),
    getWrapper: vi.fn(() => ({ clientWidth: 480 })),
    getCurrentTime: vi.fn(() => 0),
    isPlaying: vi.fn(() => false),
    play: vi.fn(),
    pause: vi.fn(),
    setTime: vi.fn(),
  };

  return {
    handlers,
    instance,
    create: vi.fn(() => instance),
  };
});

const minimapMock = vi.hoisted(() => ({
  instance: {
    destroy: vi.fn(),
  },
  create: vi.fn(() => ({ destroy: vi.fn() })),
}));

const regionsMock = vi.hoisted(() => {
  const instance = {
    clearRegions: vi.fn(),
    addRegion: vi.fn((config: { start: number; end: number }) => {
      const element = document.createElement("div");
      const handle = document.createElement("div");
      handle.className = "wavesurfer-handle";
      element.appendChild(handle);

      return {
        ...config,
        element,
        on: vi.fn(),
      };
    }),
  };

  return {
    instance,
    create: vi.fn(() => instance),
  };
});

vi.mock("wavesurfer.js", () => ({
  default: {
    create: waveSurferMock.create,
  },
}));

vi.mock("wavesurfer.js/dist/plugins/minimap.js", () => ({
  default: {
    create: minimapMock.create,
  },
}));

vi.mock("wavesurfer.js/dist/plugins/regions.js", () => ({
  default: {
    create: regionsMock.create,
  },
}));

const baseProps = {
  segments: [],
  speakers: [],
  currentTime: 0,
  isPlaying: false,
  showSpeakerRegions: false,
  onTimeUpdate: vi.fn(),
  onPlayPause: vi.fn(),
  onDurationChange: vi.fn(),
  onSeek: vi.fn(),
  onSegmentBoundaryChange: vi.fn(),
};

describe("WaveformPlayer", () => {
  beforeEach(() => {
    waveSurferMock.handlers.clear();
    vi.clearAllMocks();
    useTranscriptStore.setState({ seekRequestTime: null });
  });

  it("renders the placeholder when no audio is loaded", () => {
    render(<WaveformPlayer {...baseProps} audioUrl={null} />);

    expect(screen.getByText("Load an audio file to view the waveform")).toBeInTheDocument();
    expect(waveSurferMock.create).not.toHaveBeenCalled();
  });

  it("initializes WaveSurfer, zooms, and renders speaker regions", async () => {
    const onDurationChange = vi.fn();
    const onPlayPause = vi.fn();
    const onSegmentBoundaryChange = vi.fn();

    render(
      <WaveformPlayer
        {...baseProps}
        audioUrl="audio.mp3"
        isPlaying
        showSpeakerRegions
        segments={[
          {
            id: "seg-1",
            speaker: "Speaker 1",
            start: 0,
            end: 2,
            text: "Hello",
            words: [],
          },
        ]}
        speakers={[
          {
            id: "spk-1",
            name: "Speaker 1",
            color: "hsl(200, 50%, 40%)",
          },
        ]}
        onDurationChange={onDurationChange}
        onPlayPause={onPlayPause}
        onSegmentBoundaryChange={onSegmentBoundaryChange}
      />,
    );

    expect(waveSurferMock.create).toHaveBeenCalled();
    act(() => {
      waveSurferMock.handlers.get("ready")?.();
    });

    await waitFor(() => {
      expect(onDurationChange).toHaveBeenCalledWith(120);
    });

    expect(waveSurferMock.instance.zoom).toHaveBeenCalledWith(2);
    expect(waveSurferMock.instance.play).toHaveBeenCalled();
    expect(regionsMock.instance.clearRegions).toHaveBeenCalled();
    expect(regionsMock.instance.addRegion).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "seg-1",
        start: 0,
        end: 2,
        color: "hsla(200, 50%, 40%, 0.2)",
      }),
    );

    fireEvent.click(screen.getByTestId("button-zoom-in"));
  });

  it("seeks to the provided currentTime after the audio is ready", async () => {
    render(<WaveformPlayer {...baseProps} audioUrl="audio.mp3" currentTime={42} />);

    act(() => {
      waveSurferMock.handlers.get("ready")?.();
    });

    await waitFor(() => {
      expect(waveSurferMock.instance.setTime).toHaveBeenCalledWith(42);
    });
  });

  it("forwards seek interactions to onSeek", () => {
    const onSeek = vi.fn();

    render(<WaveformPlayer {...baseProps} audioUrl="audio.mp3" onSeek={onSeek} />);

    act(() => {
      waveSurferMock.handlers.get("seeking")?.(12);
    });
    act(() => {
      waveSurferMock.handlers.get("interaction")?.(18);
    });

    expect(onSeek).toHaveBeenCalledWith(12);
    expect(onSeek).toHaveBeenCalledWith(18);
  });

  it("handles seek requests from the store", async () => {
    render(<WaveformPlayer {...baseProps} audioUrl="audio.mp3" />);

    act(() => {
      waveSurferMock.handlers.get("ready")?.();
    });

    act(() => {
      useTranscriptStore.setState({ seekRequestTime: 80 });
    });

    await waitFor(() => {
      expect(waveSurferMock.instance.setTime).toHaveBeenCalledWith(80);
    });

    expect(useTranscriptStore.getState().seekRequestTime).toBeNull();
  });
});
