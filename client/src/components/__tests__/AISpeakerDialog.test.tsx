import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AISpeakerDialog } from "@/components/AISpeakerDialog";
import { useTranscriptStore } from "@/lib/store";

// Mock dependencies that AISpeakerDialog uses
vi.mock("@/components/FileUpload", () => ({ FileUpload: () => null }));
vi.mock("@/components/PlaybackControls", () => ({ PlaybackControls: () => null }));
vi.mock("@/components/ExportDialog", () => ({ ExportDialog: () => null }));
vi.mock("@/components/KeyboardShortcuts", () => ({ KeyboardShortcuts: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/GlossaryDialog", () => ({ GlossaryDialog: () => null }));
vi.mock("@/components/SpellcheckDialog", () => ({ SpellcheckDialog: () => null }));
vi.mock("@/components/CustomDictionariesDialog", () => ({ CustomDictionariesDialog: () => null }));
// removed self-mock of AISpeakerDialog so we can test the real component

describe("AISpeakerDialog configuration persistence", () => {
  beforeEach(() => {
    // Reset store to default state
    useTranscriptStore.setState({
      // other required state fields
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
      // AI Speaker defaults
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
  });

  it("renders batch size input and allows changes", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(<AISpeakerDialog open={true} onOpenChange={onOpenChange} />);

    // Batch Size input should be visible (this is still in the dialog)
    const batchInput = screen.getByRole("spinbutton", { name: /batch size/i }) as HTMLInputElement;
    expect(batchInput).toBeInTheDocument();

    // Should have default value
    expect(batchInput.value).toBe("10");

    // Change Batch Size
    await user.clear(batchInput);
    await user.type(batchInput, "25");

    // Value should be updated
    expect(batchInput.value).toBe("25");
  });

  it("shows provider and model selection", () => {
    const onOpenChange = vi.fn();

    render(<AISpeakerDialog open={true} onOpenChange={onOpenChange} />);

    // Should show provider and model labels
    expect(screen.getByText("AI Provider")).toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
  });

  it("shows settings button", () => {
    const onOpenChange = vi.fn();

    render(<AISpeakerDialog open={true} onOpenChange={onOpenChange} />);

    // Should show settings button
    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  });
});
