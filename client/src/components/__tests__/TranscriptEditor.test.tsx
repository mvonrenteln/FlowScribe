import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptEditor } from "@/components/TranscriptEditor";
import { useTranscriptStore } from "@/lib/store";

let mockTranscriptData: unknown;
const hotkeyHandlers = new Map<string, (event: KeyboardEvent) => void>();

vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: (keys: string, handler: (event: KeyboardEvent) => void) => {
    hotkeyHandlers.set(keys, handler);
  },
}));

vi.mock("@/components/FileUpload", () => ({
  FileUpload: ({ onTranscriptUpload }: { onTranscriptUpload: (data: unknown) => void }) => (
    <button
      type="button"
      data-testid="mock-upload"
      onClick={() => onTranscriptUpload(mockTranscriptData)}
    >
      Upload
    </button>
  ),
}));

vi.mock("@/components/WaveformPlayer", () => ({
  WaveformPlayer: () => <div data-testid="mock-waveform" />,
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

vi.mock("@/lib/audioHandleStorage", () => ({
  loadAudioHandle: vi.fn().mockResolvedValue(null),
  queryAudioHandlePermission: vi.fn().mockResolvedValue(false),
}));

const resetStore = () => {
  useTranscriptStore.setState({
    audioFile: null,
    audioUrl: null,
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
  });
};

describe("TranscriptEditor", () => {
  beforeEach(() => {
    resetStore();
    hotkeyHandlers.clear();
  });

  it("loads whisper transcripts and renders segments", async () => {
    mockTranscriptData = [
      { timestamp: [0, 2], text: "Hallo Welt" },
      { timestamp: [2, 4], text: "Guten Morgen" },
    ];

    render(<TranscriptEditor />);

    await userEvent.click(screen.getByTestId("mock-upload"));

    expect(screen.getByText("Hallo")).toBeInTheDocument();
    expect(screen.getByText("Welt")).toBeInTheDocument();
    expect(screen.getByText("Guten")).toBeInTheDocument();
    expect(screen.getByText("Morgen")).toBeInTheDocument();
    expect(screen.getAllByText("SPEAKER_00").length).toBeGreaterThanOrEqual(2);
  });

  it("filters segments by speaker from whisperx data", async () => {
    mockTranscriptData = {
      segments: [
        {
          speaker: "SPEAKER_00",
          start: 0,
          end: 1,
          text: "Hallo",
          words: [{ word: "Hallo", start: 0, end: 1 }],
        },
        {
          speaker: "SPEAKER_01",
          start: 1,
          end: 2,
          text: "Servus",
          words: [{ word: "Servus", start: 1, end: 2 }],
        },
      ],
    };

    render(<TranscriptEditor />);

    await userEvent.click(screen.getByTestId("mock-upload"));

    const state = useTranscriptStore.getState();
    const speaker = state.speakers.find((item) => item.name === "SPEAKER_01");
    const targetSegment = state.segments.find((segment) => segment.speaker === "SPEAKER_01");
    const otherSegment = state.segments.find((segment) => segment.speaker === "SPEAKER_00");

    if (!speaker || !targetSegment || !otherSegment) {
      throw new Error("Expected SPEAKER_01 and SPEAKER_00 data to exist.");
    }

    const speakerCard = await screen.findByTestId(`speaker-card-${speaker.id}`);
    await userEvent.click(speakerCard);

    expect(screen.queryByTestId(`text-segment-${otherSegment.id}`)).not.toBeInTheDocument();
    expect(await screen.findByTestId(`text-segment-${targetSegment.id}`)).toHaveTextContent(
      "Servus",
    );
  });

  it("keeps speaker filter after renaming the speaker", async () => {
    mockTranscriptData = {
      segments: [
        {
          speaker: "SPEAKER_00",
          start: 0,
          end: 1,
          text: "Hallo",
          words: [{ word: "Hallo", start: 0, end: 1 }],
        },
        {
          speaker: "SPEAKER_01",
          start: 1,
          end: 2,
          text: "Servus",
          words: [{ word: "Servus", start: 1, end: 2 }],
        },
      ],
    };

    render(<TranscriptEditor />);

    await userEvent.click(screen.getByTestId("mock-upload"));

    const state = useTranscriptStore.getState();
    const speaker = state.speakers.find((item) => item.name === "SPEAKER_01");
    const targetSegment = state.segments.find((segment) => segment.speaker === "SPEAKER_01");
    const otherSegment = state.segments.find((segment) => segment.speaker === "SPEAKER_00");

    if (!speaker || !targetSegment || !otherSegment) {
      throw new Error("Expected SPEAKER_01 and SPEAKER_00 data to exist.");
    }

    const speakerCard = await screen.findByTestId(`speaker-card-${speaker.id}`);
    await userEvent.click(speakerCard);

    expect(screen.queryByTestId(`text-segment-${otherSegment.id}`)).not.toBeInTheDocument();
    expect(await screen.findByTestId(`text-segment-${targetSegment.id}`)).toHaveTextContent(
      "Servus",
    );

    await userEvent.click(screen.getByTestId(`button-edit-${speaker.id}`));

    const renameInput = screen.getByTestId(`input-rename-${speaker.id}`);
    await userEvent.clear(renameInput);
    await userEvent.type(renameInput, "GAST{enter}");

    expect(screen.queryByTestId(`text-segment-${otherSegment.id}`)).not.toBeInTheDocument();
    expect(await screen.findByTestId(`text-segment-${targetSegment.id}`)).toHaveTextContent(
      "Servus",
    );
    expect(screen.getAllByText("GAST").length).toBeGreaterThanOrEqual(1);
  });

  it("assigns speakers with numeric hotkeys", () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 0.9,
          text: "Hallo",
          words: [{ word: "Hallo", start: 0, end: 0.9 }],
        },
      ],
      speakers: [
        { id: "speaker-0", name: "SPEAKER_00", color: "red" },
        { id: "speaker-1", name: "SPEAKER_01", color: "blue" },
      ],
      selectedSegmentId: "segment-1",
    });

    render(<TranscriptEditor />);

    const handler = hotkeyHandlers.get("1,2,3,4,5,6,7,8,9");
    if (!handler) {
      throw new Error("Expected numeric hotkeys to be registered.");
    }

    act(() => {
      handler(new KeyboardEvent("keydown", { key: "2" }));
    });

    const updatedSegment = useTranscriptStore.getState().segments[0];
    expect(updatedSegment.speaker).toBe("SPEAKER_01");
  });

  it("splits the active segment at the current word with the s hotkey", () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 3,
          text: "Hallo Welt Heute",
          words: [
            { word: "Hallo", start: 0, end: 1 },
            { word: "Welt", start: 1, end: 2 },
            { word: "Heute", start: 2, end: 3 },
          ],
        },
      ],
      currentTime: 1.2,
    });

    render(<TranscriptEditor />);

    const handler = hotkeyHandlers.get("s");
    if (!handler) {
      throw new Error("Expected split hotkey to be registered.");
    }

    act(() => {
      handler(new KeyboardEvent("keydown", { key: "s" }));
    });

    const [first, second] = useTranscriptStore.getState().segments;
    expect(first?.text).toBe("Hallo");
    expect(second?.text).toBe("Welt Heute");
  });

  it("ignores hotkeys while editing transcript text", () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 3,
          text: "Hallo Welt Heute",
          words: [
            { word: "Hallo", start: 0, end: 1 },
            { word: "Welt", start: 1, end: 2 },
            { word: "Heute", start: 2, end: 3 },
          ],
        },
      ],
      currentTime: 1.2,
    });

    render(<TranscriptEditor />);

    const handler = hotkeyHandlers.get("s");
    if (!handler) {
      throw new Error("Expected split hotkey to be registered.");
    }

    document.body.dataset.transcriptEditing = "true";
    act(() => {
      handler(new KeyboardEvent("keydown", { key: "s" }));
    });
    delete document.body.dataset.transcriptEditing;

    expect(useTranscriptStore.getState().segments).toHaveLength(1);
  });

  it("keeps playback position when splitting while playing", () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 3,
          text: "Hallo Welt Heute",
          words: [
            { word: "Hallo", start: 0, end: 1 },
            { word: "Welt", start: 1, end: 2 },
            { word: "Heute", start: 2, end: 3 },
          ],
        },
      ],
      currentTime: 1.2,
      isPlaying: true,
      seekRequestTime: null,
    });

    render(<TranscriptEditor />);

    const handler = hotkeyHandlers.get("s");
    if (!handler) {
      throw new Error("Expected split hotkey to be registered.");
    }

    act(() => {
      handler(new KeyboardEvent("keydown", { key: "s" }));
    });

    const state = useTranscriptStore.getState();
    expect(state.currentTime).toBeCloseTo(1.2, 5);
    expect(state.seekRequestTime).toBeNull();
  });

  it("updates the selected segment when current time changes while paused", async () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 0.9,
          text: "Hallo",
          words: [{ word: "Hallo", start: 0, end: 0.9 }],
        },
        {
          id: "segment-2",
          speaker: "SPEAKER_00",
          start: 2,
          end: 3,
          text: "Welt",
          words: [{ word: "Welt", start: 2, end: 3 }],
        },
      ],
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
      selectedSegmentId: "segment-1",
      currentTime: 0,
      isPlaying: false,
    });

    render(<TranscriptEditor />);

    act(() => {
      useTranscriptStore.setState({ currentTime: 2.5 });
    });

    await waitFor(() => {
      expect(useTranscriptStore.getState().selectedSegmentId).toBe("segment-2");
    });
  });

  it("seeks to a clicked segment while paused", async () => {
    mockTranscriptData = {
      segments: [
        {
          speaker: "SPEAKER_00",
          start: 4,
          end: 5,
          text: "Hallo",
          words: [{ word: "Hallo", start: 4, end: 5 }],
        },
      ],
    };

    render(<TranscriptEditor />);

    await userEvent.click(screen.getByTestId("mock-upload"));

    const [segment] = useTranscriptStore.getState().segments;
    if (!segment) {
      throw new Error("Expected a segment to exist.");
    }

    const segmentCard = await screen.findByTestId(`segment-${segment.id}`);
    await userEvent.click(segmentCard);

    const state = useTranscriptStore.getState();
    expect(state.currentTime).toBe(segment.start);
    expect(state.seekRequestTime).toBe(segment.start);
  });

  it("updates the selected segment when currentTime changes while paused", async () => {
    useTranscriptStore.setState({
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
      selectedSegmentId: "segment-1",
      currentTime: 0.5,
      isPlaying: false,
    });

    render(<TranscriptEditor />);

    act(() => {
      useTranscriptStore.setState({ currentTime: 2.5 });
    });

    await waitFor(() => {
      expect(useTranscriptStore.getState().selectedSegmentId).toBe("segment-2");
    });
  });

  it("moves selection with arrow keys while paused", async () => {
    useTranscriptStore.setState({
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
      selectedSegmentId: "segment-1",
      currentTime: 0.5,
      isPlaying: false,
    });

    render(<TranscriptEditor />);

    await act(async () => {});

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    await waitFor(() => {
      expect(useTranscriptStore.getState().selectedSegmentId).toBe("segment-2");
    });
    expect(useTranscriptStore.getState().currentTime).toBe(2);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    });

    expect(useTranscriptStore.getState().selectedSegmentId).toBe("segment-1");
    expect(useTranscriptStore.getState().currentTime).toBe(0);
  });

  it("updates selection within the active speaker filter as time changes", async () => {
    useTranscriptStore.setState({
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
          start: 1,
          end: 2,
          text: "Welt",
          words: [{ word: "Welt", start: 1, end: 2 }],
        },
        {
          id: "segment-3",
          speaker: "SPEAKER_01",
          start: 2,
          end: 3,
          text: "Servus",
          words: [{ word: "Servus", start: 2, end: 3 }],
        },
      ],
      speakers: [
        { id: "speaker-0", name: "SPEAKER_00", color: "red" },
        { id: "speaker-1", name: "SPEAKER_01", color: "blue" },
      ],
      selectedSegmentId: "segment-1",
      currentTime: 0.5,
      isPlaying: false,
    });

    render(<TranscriptEditor />);

    const speaker = useTranscriptStore
      .getState()
      .speakers.find((item) => item.name === "SPEAKER_00");
    if (!speaker) {
      throw new Error("Expected SPEAKER_00 to exist.");
    }

    const speakerCard = await screen.findByTestId(`speaker-card-${speaker.id}`);
    await userEvent.click(speakerCard);

    await waitFor(() => {
      expect(screen.queryByTestId("segment-segment-3")).not.toBeInTheDocument();
    });

    await act(async () => {
      useTranscriptStore.setState({ currentTime: 1.5 });
    });

    await waitFor(() => {
      expect(useTranscriptStore.getState().selectedSegmentId).toBe("segment-2");
    });

  });

  it("keeps selection on visible segments when active segment is filtered out", async () => {
    useTranscriptStore.setState({
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
          start: 1,
          end: 2,
          text: "Welt",
          words: [{ word: "Welt", start: 1, end: 2 }],
        },
        {
          id: "segment-3",
          speaker: "SPEAKER_01",
          start: 2,
          end: 3,
          text: "Servus",
          words: [{ word: "Servus", start: 2, end: 3 }],
        },
      ],
      speakers: [
        { id: "speaker-0", name: "SPEAKER_00", color: "red" },
        { id: "speaker-1", name: "SPEAKER_01", color: "blue" },
      ],
      selectedSegmentId: "segment-1",
      currentTime: 0.5,
      isPlaying: false,
    });

    render(<TranscriptEditor />);

    const speaker = useTranscriptStore
      .getState()
      .speakers.find((item) => item.name === "SPEAKER_00");
    if (!speaker) {
      throw new Error("Expected SPEAKER_00 to exist.");
    }

    await userEvent.click(await screen.findByTestId(`speaker-card-${speaker.id}`));

    await waitFor(() => {
      expect(screen.queryByTestId("segment-segment-3")).not.toBeInTheDocument();
    });

    await act(async () => {
      useTranscriptStore.setState({ currentTime: 2.5 });
    });

    await waitFor(() => {
      expect(useTranscriptStore.getState().selectedSegmentId).toBe("segment-1");
    });
  });

  it("toggles play/pause when space is pressed on an empty text block", async () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 1,
          text: "",
          words: [],
        },
      ],
      selectedSegmentId: "segment-1",
      isPlaying: false,
    });

    render(<TranscriptEditor />);

    const textBlock = await screen.findByTestId("text-segment-segment-1");
    textBlock.focus();

    fireEvent.keyDown(textBlock, { key: " " });

    expect(useTranscriptStore.getState().isPlaying).toBe(true);
  });

  it("sets seekRequestTime when navigating with arrow keys", async () => {
    useTranscriptStore.setState({
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
      selectedSegmentId: "segment-1",
      currentTime: 0.5,
      isPlaying: false,
    });

    render(<TranscriptEditor />);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    expect(useTranscriptStore.getState().seekRequestTime).toBe(2);
  });
});
