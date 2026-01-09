import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptEditor } from "@/components/TranscriptEditor";
import { useTranscriptStore } from "@/lib/store";

let mockTranscriptData: unknown;

vi.mock("react-hotkeys-hook", () => ({
  useHotkeys: () => {},
}));

vi.mock("@/components/FileUpload", () => ({
  FileUpload: ({
    onTranscriptUpload,
  }: {
    onTranscriptUpload: (data: unknown, reference?: { name: string }) => void;
  }) => (
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

vi.mock("@/components/GlossaryDialog", () => ({
  GlossaryDialog: () => null,
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

describe("FilterPanel", () => {
  beforeEach(() => {
    resetStore();
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

  it("filters segments using the lexicon filter", async () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 1,
          text: "Zwergenbar",
          words: [{ word: "Zwergenbar", start: 0, end: 1 }],
        },
        {
          id: "segment-2",
          speaker: "SPEAKER_00",
          start: 1,
          end: 2,
          text: "Ritter",
          words: [{ word: "Ritter", start: 1, end: 2 }],
        },
      ],
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
      lexiconEntries: [{ term: "Zwergenbär", variants: [], falsePositives: [] }],
      lexiconThreshold: 0.8,
    });

    render(<TranscriptEditor />);

    await userEvent.click(screen.getByTestId("button-filter-glossary"));

    expect(screen.queryByText("Ritter")).not.toBeInTheDocument();
    expect(screen.getByText("Zwergenbar")).toBeInTheDocument();
  });

  it("matches glossary variants in the filter", async () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 1,
          text: "Glimmer",
          words: [{ word: "Glimmer", start: 0, end: 1 }],
        },
        {
          id: "segment-2",
          speaker: "SPEAKER_00",
          start: 1,
          end: 2,
          text: "Andere",
          words: [{ word: "Andere", start: 1, end: 2 }],
        },
      ],
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
      lexiconEntries: [{ term: "Glymbar", variants: ["Glimmer", "Klümper"], falsePositives: [] }],
      lexiconThreshold: 0.8,
    });

    render(<TranscriptEditor />);

    await userEvent.click(screen.getByTestId("button-filter-glossary"));

    expect(screen.getByText("Glimmer")).toBeInTheDocument();
    expect(screen.queryByText("Andere")).not.toBeInTheDocument();
  });

  it("ignores glossary false positives in the filter", async () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 1,
          text: "Glimmer",
          words: [{ word: "Glimmer", start: 0, end: 1 }],
        },
      ],
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
      lexiconEntries: [
        {
          term: "Glymbar",
          variants: ["Glimmer"],
          falsePositives: ["Glimmer"],
        },
      ],
      lexiconThreshold: 0.8,
    });

    render(<TranscriptEditor />);

    const glossaryButton = screen.getByTestId("button-filter-glossary");
    expect(glossaryButton.textContent).toContain("0");
  });

  it("filters segments using the glossary low-score filter", async () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 1,
          text: "Zwergenbar",
          words: [{ word: "Zwergenbar", start: 0, end: 1 }],
        },
        {
          id: "segment-2",
          speaker: "SPEAKER_00",
          start: 1,
          end: 2,
          text: "Zwergenbear",
          words: [{ word: "Zwergenbear", start: 1, end: 2 }],
        },
      ],
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
      lexiconEntries: [{ term: "Zwergenbear", variants: [], falsePositives: [] }],
      lexiconThreshold: 0.8,
    });

    render(<TranscriptEditor />);

    await userEvent.click(screen.getByTestId("button-filter-glossary-low-score"));

    expect(screen.queryByTestId("segment-segment-1")).toBeInTheDocument();
    expect(screen.queryByTestId("segment-segment-2")).not.toBeInTheDocument();
  });

  it("includes glossary variants in the low-score filter", async () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 1,
          text: "Geweihten",
          words: [{ word: "Geweihten", start: 0, end: 1 }],
        },
        {
          id: "segment-2",
          speaker: "SPEAKER_00",
          start: 1,
          end: 2,
          text: "Unrelated",
          words: [{ word: "Unrelated", start: 1, end: 2 }],
        },
      ],
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
      lexiconEntries: [{ term: "Geweihte", variants: ["Geweihten"], falsePositives: [] }],
      lexiconThreshold: 0.8,
    });

    render(<TranscriptEditor />);

    await userEvent.click(screen.getByTestId("button-filter-glossary-low-score"));

    expect(screen.queryByTestId("segment-segment-1")).toBeInTheDocument();
    expect(screen.queryByTestId("segment-segment-2")).not.toBeInTheDocument();
  });

  it("treats normalized glossary variants as low-score matches", async () => {
    useTranscriptStore.setState({
      segments: [
        {
          id: "segment-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 1,
          text: "Zwergenbar",
          words: [{ word: "Zwergenbar", start: 0, end: 1 }],
        },
        {
          id: "segment-2",
          speaker: "SPEAKER_00",
          start: 1,
          end: 2,
          text: "Unrelated",
          words: [{ word: "Unrelated", start: 1, end: 2 }],
        },
      ],
      speakers: [{ id: "speaker-0", name: "SPEAKER_00", color: "red" }],
      lexiconEntries: [{ term: "Zwergenbär", variants: ["Zwergenbar"], falsePositives: [] }],
      lexiconThreshold: 0.8,
    });

    render(<TranscriptEditor />);

    await userEvent.click(screen.getByTestId("button-filter-glossary-low-score"));

    expect(screen.queryByTestId("segment-segment-1")).toBeInTheDocument();
    expect(screen.queryByTestId("segment-segment-2")).not.toBeInTheDocument();
  });
});
