import { render, screen } from "@testing-library/react";
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
  recentSessions: [],
  onActivateSession: vi.fn(),
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
});
