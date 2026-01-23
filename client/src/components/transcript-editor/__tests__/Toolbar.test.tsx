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
  onDeleteSession: vi.fn(),
  onShowRevisionDialog: vi.fn(),
  canCreateRevision: true,
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  canUndo: false,
  canRedo: false,
  onShowShortcuts: vi.fn(),
  onShowExport: vi.fn(),
  chaptersOutlineOpen: false,
  onToggleChaptersOutline: vi.fn(),
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
  aiCommandPanelOpen: false,
  onToggleAICommandPanel: vi.fn(),
};

describe("Toolbar", () => {
  it("highlights the Highlights button when any highlighting is active", () => {
    render(<Toolbar {...baseProps} spellcheckHighlightActive={true} />);

    const highlightsButton = screen.getByTestId("button-highlights");

    expect(highlightsButton).toHaveClass("bg-accent");
  });

  it("highlights the Highlights button when glossary highlighting is active", () => {
    render(<Toolbar {...baseProps} glossaryHighlightActive={true} />);

    const highlightsButton = screen.getByTestId("button-highlights");

    expect(highlightsButton).toHaveClass("bg-accent");
  });

  it("highlights the Highlights button when confidence highlighting is active", () => {
    render(<Toolbar {...baseProps} highlightLowConfidence={true} />);

    const highlightsButton = screen.getByTestId("button-highlights");

    expect(highlightsButton).toHaveClass("bg-accent");
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

    expect(within(menuItems[1]).getByText("Client review")).toBeInTheDocument();
    expect(screen.getAllByText("audio")).toHaveLength(1);
    expect(screen.getAllByText("transcript")).toHaveLength(1);
  });

  it("calls onDeleteSession when the delete button is clicked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onDeleteSession = vi.fn();
    render(
      <Toolbar
        {...baseProps}
        onDeleteSession={onDeleteSession}
        recentSessions={[
          {
            key: "base-1",
            audioName: "audio.mp3",
            transcriptName: "transcript.json",
            updatedAt: 20,
            kind: "current",
            label: null,
          },
        ]}
      />,
    );

    await user.click(screen.getByTestId("button-recent-sessions"));

    const deleteButton = screen.getByLabelText("Delete session");
    await user.click(deleteButton);

    expect(onDeleteSession).toHaveBeenCalledWith("base-1");
  });

  it("toggles glossary highlighting when glossary item is clicked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onShowGlossary = vi.fn();
    render(<Toolbar {...baseProps} onShowGlossary={onShowGlossary} />);

    await user.click(screen.getByTestId("button-highlights"));
    const glossaryItem = await screen.findByText("Glossary");
    await user.click(glossaryItem);

    expect(onShowGlossary).toHaveBeenCalled();
  });

  it("shows check mark for glossary when glossaryHighlightActive=true", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Toolbar {...baseProps} glossaryHighlightActive={true} />);

    await user.click(screen.getByTestId("button-highlights"));
    const glossaryItem = await screen.findByText("Glossary");
    // The Check icon renders as an SVG; ensure it's present within the item
    const parent = glossaryItem.closest("button") || glossaryItem.parentElement;
    expect(parent).toBeTruthy();
    // look for an element with role img (lucide icons don't have role, so search for svg)
    expect(parent?.querySelector("svg")).toBeTruthy();
  });
});
