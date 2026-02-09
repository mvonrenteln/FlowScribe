import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTranscriptStore } from "@/lib/store";

vi.mock("@/components/ChapterHeader", () => ({
  ChapterHeader: ({
    chapter,
    onRewriteChapter,
  }: {
    chapter: { id: string };
    onRewriteChapter: (id: string) => void;
  }) => (
    <button type="button" onClick={() => onRewriteChapter(chapter.id)}>
      Rewrite {chapter.id}
    </button>
  ),
}));

import { TranscriptList } from "@/components/transcript-editor/TranscriptList";

const resetStore = () => {
  useTranscriptStore.setState({
    segments: [],
    speakers: [],
    tags: [],
    chapters: [],
    chapterDisplayModes: {},
    aiRevisionSuggestions: [],
    aiRevisionLastResult: null,
    aiSpeakerSuggestions: [],
    aiSegmentMergeSuggestions: [],
    rewriteInProgress: false,
    rewriteChapterId: null,
    rewriteError: null,
    aiChapterDetectionConfig: {
      batchSize: 100,
      minChapterLength: 10,
      maxChapterLength: 80,
      tagIds: [],
      selectedProviderId: undefined,
      selectedModel: undefined,
      activePromptId: "prompt-1",
      prompts: [
        {
          id: "prompt-1",
          name: "Default Prompt",
          type: "chapter-detect",
          operation: "rewrite",
          systemPrompt: "You are an expert editor.",
          userPromptTemplate: "Rewrite the chapter: {{chapterContent}}",
          isBuiltIn: false,
          quickAccess: false,
        },
      ],
      includeContext: true,
      contextWordLimit: 500,
      includeParagraphContext: true,
      paragraphContextCount: 2,
    },
  });
};

describe("TranscriptList rewrite dialog", () => {
  beforeEach(() => {
    resetStore();
  });

  it("unmounts the rewrite dialog after closing", async () => {
    const user = userEvent.setup();
    const segment = {
      id: "seg-1",
      speaker: "Speaker 1",
      start: 0,
      end: 1,
      text: "Hello world.",
      words: [],
      tags: [],
    };
    const chapter = {
      id: "chapter-1",
      title: "Intro",
      startSegmentId: "seg-1",
      endSegmentId: "seg-1",
      segmentCount: 1,
      createdAt: Date.now(),
      source: "manual" as const,
    };

    const props: React.ComponentProps<typeof TranscriptList> = {
      containerRef: { current: null },
      filteredSegments: [segment],
      speakers: [{ id: "speaker-1", name: "Speaker 1", color: "red" }],
      chapters: [chapter],
      selectedChapterId: null,
      activeSegmentId: null,
      selectedSegmentId: null,
      activeWordIndex: -1,
      splitWordIndex: null,
      showLexiconMatches: false,
      lexiconHighlightUnderline: false,
      lexiconHighlightBackground: false,
      lexiconMatchesBySegment: new Map(),
      showSpellcheckMatches: false,
      spellcheckMatchesBySegment: new Map(),
      highlightLowConfidence: false,
      lowConfidenceThreshold: null,
      editRequestId: null,
      onClearEditRequest: vi.fn(),
      segmentHandlers: [
        {
          onSelect: vi.fn(),
          onSelectOnly: vi.fn(),
          onTextChange: vi.fn(),
          onSpeakerChange: vi.fn(),
          onSplit: vi.fn(),
          onConfirm: vi.fn(),
          onToggleBookmark: vi.fn(),
          onIgnoreLexiconMatch: vi.fn(),
          onMergeWithPrevious: vi.fn(),
          onMergeWithNext: vi.fn(),
          onDelete: vi.fn(),
        },
      ],
      onSeek: vi.fn(),
      onIgnoreSpellcheckMatch: vi.fn(),
      onAddSpellcheckToGlossary: vi.fn(),
      emptyState: {
        title: "Empty",
        description: "No segments available.",
      },
      searchQuery: "",
      isRegexSearch: false,
      currentMatch: {
        segmentId: "seg-1",
        startIndex: 0,
        endIndex: 1,
        text: "He",
      },
      allMatches: [],
      replaceQuery: "",
      onReplaceCurrent: vi.fn(),
      onMatchClick: vi.fn(),
      findMatchIndex: vi.fn(),
      onStartChapterAtSegment: vi.fn(),
      onSelectChapter: vi.fn(),
      onUpdateChapter: vi.fn(),
      onDeleteChapter: vi.fn(),
      chapterFocusRequest: null,
      onChapterFocusRequestHandled: vi.fn(),
      isTranscriptEditing: false,
    };

    render(<TranscriptList {...props} />);

    const openButton = screen.getByRole("button", { name: `Rewrite ${chapter.id}` });
    await user.click(openButton);

    expect(screen.getByText("Rewrite Chapter")).toBeInTheDocument();

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText("Rewrite Chapter")).not.toBeInTheDocument();
    });
  });
});
