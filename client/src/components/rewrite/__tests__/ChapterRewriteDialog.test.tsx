import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { ChapterRewriteDialog } from "@/components/rewrite/ChapterRewriteDialog";
import { useTranscriptStore } from "@/lib/store";

const buildConfig = () => ({
  batchSize: 100,
  minChapterLength: 10,
  maxChapterLength: 80,
  tagIds: [],
  selectedProviderId: undefined,
  selectedModel: undefined,
  activePromptId: "detect-1",
  prompts: [
    {
      id: "chapter-1",
      name: "Chapter Prompt A",
      type: "chapter-detect" as const,
      operation: "rewrite" as const,
      rewriteScope: "chapter" as const,
      systemPrompt: "System",
      userPromptTemplate: "User",
      isBuiltIn: false,
      quickAccess: false,
    },
    {
      id: "chapter-2",
      name: "Chapter Prompt B",
      type: "chapter-detect" as const,
      operation: "rewrite" as const,
      rewriteScope: "chapter" as const,
      systemPrompt: "System",
      userPromptTemplate: "User",
      isBuiltIn: false,
      quickAccess: false,
    },
    {
      id: "paragraph-1",
      name: "Paragraph Prompt",
      type: "chapter-detect" as const,
      operation: "rewrite" as const,
      rewriteScope: "paragraph" as const,
      systemPrompt: "System",
      userPromptTemplate: "User",
      isBuiltIn: false,
      quickAccess: false,
    },
  ],
  includeContext: true,
  contextWordLimit: 500,
  includeParagraphContext: true,
  paragraphContextCount: 2,
  defaultRewritePromptIdsByScope: {
    chapter: "chapter-2",
    paragraph: "paragraph-1",
  },
});

describe("ChapterRewriteDialog", () => {
  beforeEach(() => {
    useTranscriptStore.setState({
      chapters: [
        {
          id: "chapter-id",
          title: "Intro",
          startSegmentId: "seg-1",
          endSegmentId: "seg-1",
          segmentCount: 1,
          createdAt: Date.now(),
          source: "manual",
          rewritePromptId: "chapter-1",
        },
      ],
      aiChapterDetectionConfig: buildConfig(),
      rewriteInProgress: false,
      rewriteChapterId: null,
      paragraphRewriteInProgress: false,
      paragraphRewriteChapterId: null,
      paragraphRewriteParagraphIndex: null,
    });
  });

  it("uses the chapter-scope default prompt on start", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const startRewrite = vi.fn();
    const updateRewriteConfig = vi.fn();
    const setDefaultRewritePromptForScope = vi.fn();

    useTranscriptStore.setState({
      startRewrite,
      updateRewriteConfig,
      setDefaultRewritePromptForScope,
    });

    render(
      <I18nProvider>
        <ChapterRewriteDialog open={true} onOpenChange={onOpenChange} chapterId="chapter-id" />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(setDefaultRewritePromptForScope).toHaveBeenCalledWith("chapter", "chapter-2");
    expect(startRewrite).toHaveBeenCalledWith("chapter-id", "chapter-2", "");
  });

  it("prefers scope default over chapter rewrite history", async () => {
    const user = userEvent.setup();
    const startRewrite = vi.fn();
    const updateRewriteConfig = vi.fn();
    const setDefaultRewritePromptForScope = vi.fn();

    useTranscriptStore.setState({
      startRewrite,
      updateRewriteConfig,
      setDefaultRewritePromptForScope,
    });

    render(
      <I18nProvider>
        <ChapterRewriteDialog open={true} onOpenChange={vi.fn()} chapterId="chapter-id" />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(startRewrite).toHaveBeenCalledWith("chapter-id", "chapter-2", "");
  });

  it("uses the paragraph-scope default prompt on start", async () => {
    const user = userEvent.setup();
    const startParagraphRewrite = vi.fn();
    const updateRewriteConfig = vi.fn();
    const setDefaultRewritePromptForScope = vi.fn();

    useTranscriptStore.setState({
      startParagraphRewrite,
      updateRewriteConfig,
      setDefaultRewritePromptForScope,
    });

    render(
      <I18nProvider>
        <ChapterRewriteDialog
          open={true}
          onOpenChange={vi.fn()}
          chapterId="chapter-id"
          mode="paragraph"
          paragraphIndex={0}
        />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(setDefaultRewritePromptForScope).toHaveBeenCalledWith("paragraph", "paragraph-1");
    expect(startParagraphRewrite).toHaveBeenCalledWith("chapter-id", 0, "paragraph-1", "");
  });
});
