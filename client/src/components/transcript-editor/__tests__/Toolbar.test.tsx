import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toolbar } from "@/components/transcript-editor/Toolbar";
import type { TranscriptEditorState } from "@/components/transcript-editor/useTranscriptEditor";

vi.mock("@/components/FileUpload", () => ({
  FileUpload: () => <div data-testid="file-upload" />,
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

const baseProps: TranscriptEditorState["toolbarProps"] = {
  sidebarOpen: true,
  onToggleSidebar: vi.fn(),
  onAudioUpload: vi.fn(),
  onTranscriptUpload: vi.fn(),
  audioFileName: undefined,
  transcriptFileName: undefined,
  transcriptLoaded: true,
  sessionKind: "current",
  sessionLabel: null,
  activeSessionKey: "active-session",
  recentSessions: [],
  onActivateSession: vi.fn(),
  onShowRevisionDialog: vi.fn(),
  canCreateRevision: true,
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  canUndo: false,
  canRedo: false,
  onShowShortcuts: vi.fn(),
  onShowExport: vi.fn(),
  highlightLowConfidence: false,
  onToggleHighlightLowConfidence: vi.fn(),
  confidencePopoverOpen: false,
  onConfidencePopoverChange: vi.fn(),
  lowConfidenceThreshold: 0.4,
  onManualConfidenceChange: vi.fn(),
  onResetConfidenceThreshold: vi.fn(),
  spellcheckPopoverOpen: false,
  onSpellcheckPopoverChange: vi.fn(),
  spellcheckEnabled: false,
  onToggleSpellcheck: vi.fn(),
  spellcheckLanguages: [],
  onSpellcheckLanguageChange: vi.fn(),
  spellcheckCustomEnabled: false,
  onToggleSpellcheckCustom: vi.fn(),
  onShowCustomDictionaries: vi.fn(),
  spellcheckCustomDictionariesCount: 0,
  onShowSpellcheckDialog: vi.fn(),
  spellcheckDebugEnabled: false,
  effectiveSpellcheckLanguages: [],
  spellcheckerLanguages: [],
  spellcheckHighlightActive: false,
  glossaryHighlightActive: false,
  onShowGlossary: vi.fn(),
};

describe("Toolbar", () => {
  it("highlights the spellcheck button when spellcheck highlighting is active", () => {
    render(<Toolbar {...baseProps} spellcheckHighlightActive={true} />);

    const spellcheckButton = screen.getByTestId("button-spellcheck");
    expect(spellcheckButton).toHaveClass("bg-accent");
    expect(spellcheckButton).toHaveAttribute("aria-pressed", "true");
  });

  it("highlights the glossary button when glossary highlighting is active", () => {
    render(<Toolbar {...baseProps} glossaryHighlightActive={true} />);

    const glossaryButton = screen.getByTestId("button-glossary");
    expect(glossaryButton).toHaveClass("bg-accent");
    expect(glossaryButton).toHaveAttribute("aria-pressed", "true");
  });

  it("renders revision entries with a Revision badge", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <Toolbar
        {...baseProps}
        recentSessions={[
          {
            key: "base-1",
            audioName: "audio.mp3",
            transcriptName: "transcript.json",
            updatedAt: 20,
            kind: "current",
            label: null,
          },
          {
            key: "rev-1",
            audioName: "audio.mp3",
            transcriptName: "transcript.json",
            updatedAt: 10,
            kind: "revision",
            label: "Client review",
            baseSessionKey: "base-1",
          },
        ]}
        activeSessionKey="rev-1"
      />,
    );

    await user.click(screen.getByTestId("button-recent-sessions"));
    await screen.findByText("Recent sessions");
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems[1]).toHaveClass("pl-6");
    expect(within(menuItems[1]).getByText("Client review")).toBeInTheDocument();
    expect(screen.getAllByText("audio.mp3")).toHaveLength(2);
    expect(screen.getAllByText("transcript.json")).toHaveLength(2);
  });
});
