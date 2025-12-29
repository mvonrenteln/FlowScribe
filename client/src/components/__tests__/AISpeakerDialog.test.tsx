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
        templates: [],
        activeTemplateId: "default",
      },
      aiSpeakerError: null,
      aiSpeakerAbortController: null,
    });
  });

  it("saves configuration changes to the store", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    // spy on updateConfig to ensure it's called
    const updateSpy = vi.spyOn(useTranscriptStore.getState(), "updateConfig");

    render(<AISpeakerDialog open={true} onOpenChange={onOpenChange} />);

    // Switch to the Config tab so the inputs are rendered
    const configTab = screen.getByText("Config");
    await user.click(configTab);

    // Change Ollama URL
    const urlInput = (await screen.findByLabelText("Ollama URL")) as HTMLInputElement;
    await user.clear(urlInput);
    await user.type(urlInput, "http://my-ollama:1234");

    // Change Model
    const modelInput = (await screen.findByLabelText("Model")) as HTMLInputElement;
    await user.clear(modelInput);
    await user.type(modelInput, "my-model");

    // Change Batch Size
    const batchInput = (await screen.findByLabelText("Batch Size")) as HTMLInputElement;
    await user.clear(batchInput);
    await user.type(batchInput, "20");

    // Click Save Configuration button
    const saveButton = screen.getByRole("button", { name: "Save Configuration" });
    await user.click(saveButton);

    // Expect updateConfig was called with the new values
    expect(updateSpy).toHaveBeenCalledWith({
      ollamaUrl: "http://my-ollama:1234",
      model: "my-model",
      batchSize: 20,
    });

    const config = useTranscriptStore.getState().aiSpeakerConfig;
    expect(config.ollamaUrl).toBe("http://my-ollama:1234");
    expect(config.model).toBe("my-model");
    expect(config.batchSize).toBe(20);

    updateSpy.mockRestore();
  });
});
