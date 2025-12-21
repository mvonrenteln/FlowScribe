import { render, screen } from "@testing-library/react";
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
          end: 1,
          text: "Hallo",
          words: [{ word: "Hallo", start: 0, end: 1 }],
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

    handler(new KeyboardEvent("keydown", { key: "2" }));

    const updatedSegment = useTranscriptStore.getState().segments[0];
    expect(updatedSegment.speaker).toBe("SPEAKER_01");
  });
});
