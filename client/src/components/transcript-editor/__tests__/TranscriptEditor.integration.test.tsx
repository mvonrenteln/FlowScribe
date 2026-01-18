import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    setPlaybackRate: vi.fn(),
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

vi.mock("@/components/SpellcheckDialog", () => ({
  SpellcheckDialog: () => null,
}));

vi.mock("@/components/CustomDictionariesDialog", () => ({
  CustomDictionariesDialog: () => null,
}));

vi.mock("@/lib/spellcheck", async () => {
  const actual = await vi.importActual<typeof import("@/lib/spellcheck")>("@/lib/spellcheck");
  return {
    ...actual,
    loadSpellcheckers: vi.fn().mockResolvedValue([
      {
        language: "en",
        checker: {
          correct: () => false,
          suggest: () => ["Word"],
        },
      },
    ]),
    getSpellcheckMatch: (word: string) => (word === "Wrd" ? { suggestions: ["Word"] } : null),
  };
});

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
    sessionKind: "current",
    sessionLabel: null,
    baseSessionKey: null,
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
    spellcheckEnabled: false,
    spellcheckLanguages: ["de"],
    spellcheckIgnoreWords: [],
    spellcheckCustomEnabled: false,
    spellcheckCustomDictionaries: [],
    spellcheckCustomDictionariesLoaded: false,
    recentSessions: [],
    // AI Speaker state
    aiSpeakerSuggestions: [],
    aiSpeakerIsProcessing: false,
    aiSpeakerProcessedCount: 0,
    aiSpeakerTotalToProcess: 0,
    aiSpeakerConfig: {
      ollamaUrl: "http://localhost:11434",
      model: "llama3.2",
      batchSize: 10,
      prompts: [],
      activePromptId: "default",
    },
    aiSpeakerError: null,
    aiSpeakerAbortController: null,
  });
};

describe("TranscriptEditor integration", () => {
  beforeEach(() => {
    resetStore();
    waveSurferMock.handlers.clear();
  });

  it("renders segments from the store", async () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 2,
          text: "Hallo Welt",
          words: [
            { word: "Hallo", start: 0, end: 1 },
            { word: "Welt", start: 1, end: 2 },
          ],
          tags: [],
        },
      ],
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
    });

    render(<TranscriptEditor />);

    await waitFor(() => {
      expect(screen.getByText("Hallo")).toBeInTheDocument();
      expect(screen.getByText("Welt")).toBeInTheDocument();
    });
  });

  it("renders inline merge suggestions between segments", async () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 1,
          text: "Hello there",
          words: [],
          tags: [],
        },
        {
          id: "segment-2",
          speaker: "SPEAKER_00",
          start: 1,
          end: 2,
          text: "general kenobi",
          words: [],
          tags: [],
        },
      ],
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
      aiSegmentMergeSuggestions: [
        {
          id: "merge-1",
          segmentIds: ["segment-1", "segment-2"],
          confidence: "high",
          confidenceScore: 0.95,
          reason: "Continuation",
          status: "pending",
          mergedText: "Hello there general kenobi",
          timeRange: { start: 0, end: 2 },
          speaker: "SPEAKER_00",
          timeGap: 0.12,
        },
      ],
      aiSegmentMergeConfig: {
        ...useTranscriptStore.getState().aiSegmentMergeConfig,
        showInlineHints: true,
      },
    });

    render(<TranscriptEditor />);

    await waitFor(() => {
      expect(screen.getByTestId("merge-suggestion-merge-1")).toBeInTheDocument();
    });
  });

  it("keeps inline merge suggestions visible when the list is sliced", async () => {
    const segments = Array.from({ length: 60 }, (_, index) => {
      const start = index;
      return {
        id: `segment-${index + 1}`,
        speaker: "SPEAKER_00",
        start,
        end: start + 1,
        text: `Segment ${index + 1}`,
        words: [],
        tags: [],
      };
    });

    useTranscriptStore.setState({
      segments,
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
      selectedSegmentId: "segment-30",
      currentTime: 29,
      aiSegmentMergeSuggestions: [
        {
          id: "merge-30-31",
          segmentIds: ["segment-30", "segment-31"],
          confidence: "high",
          confidenceScore: 0.9,
          reason: "Continuation",
          status: "pending",
          mergedText: "Segment 30 Segment 31",
          timeRange: { start: 29, end: 31 },
          speaker: "SPEAKER_00",
          timeGap: 0.1,
        },
      ],
      aiSegmentMergeConfig: {
        ...useTranscriptStore.getState().aiSegmentMergeConfig,
        showInlineHints: true,
      },
    });

    render(<TranscriptEditor />);

    await waitFor(() => {
      expect(screen.getByTestId("merge-suggestion-merge-30-31")).toBeInTheDocument();
    });
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
          tags: [],
        },
        {
          id: "segment-2",
          speaker: "SPEAKER_00",
          start: 2,
          end: 3,
          text: "Servus",
          words: [{ word: "Servus", start: 2, end: 3 }],
          tags: [],
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
    expect(screen.getByTestId("segment-segment-2")).toHaveAttribute("aria-current", "true");

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("selects the next segment when wave interaction lands in a gap while paused", async () => {
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
          tags: [],
        },
        {
          id: "segment-2",
          speaker: "SPEAKER_00",
          start: 2,
          end: 3,
          text: "Servus",
          words: [{ word: "Servus", start: 2, end: 3 }],
          tags: [],
        },
      ],
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
      selectedSegmentId: "segment-1",
      currentTime: 0.5,
      isPlaying: false,
    });

    render(<TranscriptEditor />);

    act(() => {
      waveSurferMock.handlers.get("interaction")?.(1.5);
    });

    expect(useTranscriptStore.getState().selectedSegmentId).toBe("segment-2");
    expect(screen.getByTestId("segment-segment-2")).toHaveAttribute("aria-current", "true");
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
          tags: [],
        },
        {
          id: "segment-2",
          speaker: "SPEAKER_00",
          start: 2,
          end: 3,
          text: "Servus",
          words: [{ word: "Servus", start: 2, end: 3 }],
          tags: [],
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

  it("filters segments with spellcheck issues", async () => {
    useTranscriptStore.setState({
      audioUrl: "audio.mp3",
      spellcheckEnabled: true,
      spellcheckLanguages: ["en"],
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 1,
          text: "Wrd",
          words: [{ word: "Wrd", start: 0, end: 1 }],
          tags: [],
        },
        {
          id: "segment-2",
          speaker: "SPEAKER_00",
          start: 2,
          end: 3,
          text: "Word",
          words: [{ word: "Word", start: 2, end: 3 }],
          tags: [],
        },
      ],
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
      selectedSegmentId: "segment-1",
      currentTime: 0,
      isPlaying: false,
    });

    render(<TranscriptEditor />);

    act(() => {
      waveSurferMock.handlers.get("ready")?.();
    });

    await waitFor(() => {
      expect(screen.getByTestId("button-filter-spellcheck").textContent).toContain("1");
    });

    await userEvent.click(screen.getByTestId("button-filter-spellcheck"));

    expect(screen.getByTestId("segment-segment-1")).toBeInTheDocument();
    expect(screen.queryByTestId("segment-segment-2")).toBeNull();
  });

  it("only offers merges for adjacent segments when filtered", async () => {
    useTranscriptStore.setState({
      audioUrl: "audio.mp3",
      segments: [
        {
          id: "segment-1",
          speaker: "Speaker A",
          start: 0,
          end: 1,
          text: "First",
          words: [{ word: "First", start: 0, end: 1 }],
          tags: [],
        },
        {
          id: "segment-2",
          speaker: "Speaker B",
          start: 1,
          end: 2,
          text: "Second",
          words: [{ word: "Second", start: 1, end: 2 }],
          tags: [],
        },
        {
          id: "segment-3",
          speaker: "Speaker A",
          start: 2,
          end: 3,
          text: "Third",
          words: [{ word: "Third", start: 2, end: 3 }],
          tags: [],
        },
        {
          id: "segment-4",
          speaker: "Speaker A",
          start: 3,
          end: 4,
          text: "Fourth",
          words: [{ word: "Fourth", start: 3, end: 4 }],
          tags: [],
        },
      ],
      speakers: [
        { id: "speaker-a", name: "Speaker A", color: "red" },
        { id: "speaker-b", name: "Speaker B", color: "blue" },
      ],
      selectedSegmentId: null,
      currentTime: 0,
      isPlaying: false,
    });

    render(<TranscriptEditor />);

    await userEvent.click(screen.getByTestId("speaker-card-speaker-a"));

    expect(screen.getByTestId("segment-segment-1")).toBeInTheDocument();
    expect(screen.queryByTestId("segment-segment-2")).toBeNull();

    await userEvent.click(screen.getByTestId("button-segment-menu-segment-1"));
    expect(screen.getByText("Split at current word")).toBeInTheDocument();
    expect(screen.queryByText("Merge with next")).toBeNull();

    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByTestId("button-segment-menu-segment-3"));
    const mergeWithNext = screen.getByText("Merge with next");
    expect(mergeWithNext).toBeInTheDocument();

    await userEvent.click(mergeWithNext);

    await waitFor(() => {
      const updatedSegments = useTranscriptStore.getState().segments;
      expect(updatedSegments).toHaveLength(3);
      expect(updatedSegments.some((segment) => segment.text === "Third Fourth")).toBe(true);
    });
  });
});
