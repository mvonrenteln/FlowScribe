import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptEditor } from "@/components/TranscriptEditor";
import { useTranscriptStore } from "@/lib/store";

let mockTranscriptData: unknown;

vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: () => {},
}));

vi.mock("@/components/FileUpload", () => ({
  FileUpload: ({ onTranscriptUpload }: { onTranscriptUpload: (data: unknown) => void }) => (
    <button data-testid="mock-upload" onClick={() => onTranscriptUpload(mockTranscriptData)}>
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

    const speakerLabel = screen
      .getAllByText("SPEAKER_01")
      .find((node) => node.closest('[data-testid^="speaker-card-"]'));
    expect(speakerLabel).toBeTruthy();
    await userEvent.click(speakerLabel!);

    expect(screen.queryByText("Hallo")).not.toBeInTheDocument();
    expect(screen.getByText("Servus")).toBeInTheDocument();
  });
});
