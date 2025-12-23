import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptEditor } from "@/components/TranscriptEditor";
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
  create: vi.fn(() => ({ destroy: vi.fn() })),
}));

const regionsMock = vi.hoisted(() => ({
  create: vi.fn(() => ({
    clearRegions: vi.fn(),
    addRegion: vi.fn(() => ({
      element: document.createElement("div"),
      on: vi.fn(),
    })),
  })),
}));

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

vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: () => {},
}));

vi.mock("@/components/FileUpload", () => ({
  FileUpload: () => <div data-testid="mock-upload" />,
}));

vi.mock("@/components/PlaybackControls", () => ({
  PlaybackControls: () => <div data-testid="mock-playback" />,
}));

vi.mock("@/components/ExportDialog", () => ({
  ExportDialog: () => null,
}));

vi.mock("@/components/KeyboardShortcuts", () => ({
  KeyboardShortcuts: () => null,
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="mock-theme" />,
}));

vi.mock("@/components/GlossaryDialog", () => ({
  GlossaryDialog: () => null,
}));

vi.mock("@/lib/audioHandleStorage", () => ({
  loadAudioHandle: vi.fn().mockResolvedValue(null),
  queryAudioHandlePermission: vi.fn().mockResolvedValue(false),
}));

const resetStore = () => {
  useTranscriptStore.setState({
    audioFile: null,
    audioUrl: null,
    audioRef: null,
    transcriptRef: null,
    sessionKey: "audio:none|transcript:none",
    segments: [],
    speakers: [],
    selectedSegmentId: null,
    currentTime: 0,
    isPlaying: false,
    duration: 0,
    seekRequestTime: null,
    history: [],
    historyIndex: -1,
    isWhisperXFormat: false,
    lexiconEntries: [],
    lexiconThreshold: 0.82,
    lexiconHighlightUnderline: false,
    lexiconHighlightBackground: false,
  });
};

describe("TranscriptEditor integration", () => {
  beforeEach(() => {
    resetStore();
    waveSurferMock.handlers.clear();
  });

  it("updates selected segment after wave interaction while paused", async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    useTranscriptStore.setState({
      audioUrl: "audio.mp3",
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 1,
          text: "Hallo",
          words: [{ word: "Hallo", start: 0, end: 1 }],
        },
        {
          id: "segment-2",
          speaker: "SPEAKER_00",
          start: 2,
          end: 3,
          text: "Servus",
          words: [{ word: "Servus", start: 2, end: 3 }],
        },
      ],
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
      selectedSegmentId: "segment-1",
      currentTime: 0.5,
      isPlaying: false,
    });

    render(<TranscriptEditor />);

    act(() => {
      waveSurferMock.handlers.get("interaction")?.(2.5);
    });

    expect(useTranscriptStore.getState().selectedSegmentId).toBe("segment-2");
    expect(screen.getByTestId("segment-segment-2")).toHaveAttribute("aria-pressed", "true");

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("scrolls to the next segment when using arrow navigation while paused", async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    useTranscriptStore.setState({
      audioUrl: "audio.mp3",
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 1,
          text: "Hallo",
          words: [{ word: "Hallo", start: 0, end: 1 }],
        },
        {
          id: "segment-2",
          speaker: "SPEAKER_00",
          start: 2,
          end: 3,
          text: "Servus",
          words: [{ word: "Servus", start: 2, end: 3 }],
        },
      ],
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
      selectedSegmentId: "segment-1",
      currentTime: 0.5,
      isPlaying: false,
    });

    render(<TranscriptEditor />);

    fireEvent.keyDown(window, { key: "ArrowDown" });

    await waitFor(() => {
      expect(useTranscriptStore.getState().selectedSegmentId).toBe("segment-2");
      expect(scrollIntoView).toHaveBeenCalled();
    });

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });
});
