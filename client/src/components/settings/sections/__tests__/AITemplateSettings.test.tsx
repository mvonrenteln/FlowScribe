import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetStore } from "@/lib/__tests__/storeTestUtils";
import { useTranscriptStore } from "@/lib/store";
import type { AIPrompt } from "@/lib/store/types";
import { AITemplateSettings } from "../AITemplateSettings";

const createPrompt = (overrides: Partial<AIPrompt> = {}): AIPrompt => ({
  id: "prompt-rewrite-paragraph",
  name: "Paragraph Rewrite Prompt",
  type: "chapter-detect",
  operation: "rewrite",
  rewriteScope: "paragraph",
  systemPrompt: "Rewrite this paragraph",
  userPromptTemplate: "{{paragraphContent}}",
  isBuiltIn: false,
  quickAccess: false,
  ...overrides,
});

const setChapterPrompts = (prompts: AIPrompt[]) => {
  const current = useTranscriptStore.getState().aiChapterDetectionConfig;
  useTranscriptStore.setState({
    aiChapterDetectionConfig: {
      ...current,
      prompts,
      activePromptId: prompts[0]?.id ?? "",
    },
  });
};

const openChaptersTab = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("tab", { name: "Chapters" }));
};

const selectChapterRewriteScope = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByLabelText("Operation Category"));
  await user.click(screen.getByRole("option", { name: "Content Rewrite" }));
  await user.click(screen.getByLabelText("Rewrite Scope"));
  await user.click(screen.getByRole("option", { name: "Paragraph" }));
};

describe("AITemplateSettings", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: () => false,
    });
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: () => undefined,
    });
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: () => undefined,
    });
  });

  beforeEach(() => {
    resetStore();
  });

  it("persists paragraph rewrite scope when creating chapter rewrite prompts", async () => {
    const user = userEvent.setup();
    setChapterPrompts([]);

    render(<AITemplateSettings />);

    await openChaptersTab(user);
    await user.click(screen.getByTestId("button-add-prompt"));
    await selectChapterRewriteScope(user);

    await user.type(screen.getByLabelText("Prompt Name"), "Paragraph Prompt Created");
    await user.type(screen.getByLabelText("System Prompt"), " System instructions");
    await user.type(screen.getByLabelText("User Prompt Template"), " {{paragraphContent}}");
    await user.click(screen.getByRole("button", { name: "Create Prompt" }));

    const savedPrompt = useTranscriptStore
      .getState()
      .aiChapterDetectionConfig.prompts.find(
        (prompt) => prompt.name === "Paragraph Prompt Created",
      );

    expect(savedPrompt?.operation).toBe("rewrite");
    expect(savedPrompt?.rewriteScope).toBe("paragraph");
  });

  it("keeps paragraph rewrite scope when editing chapter rewrite prompts", async () => {
    const user = userEvent.setup();
    setChapterPrompts([createPrompt()]);

    render(<AITemplateSettings />);

    await openChaptersTab(user);
    await user.click(screen.getByLabelText("Expand prompt details"));
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const systemPrompt = screen.getByLabelText("System Prompt");
    await user.clear(systemPrompt);
    await user.type(systemPrompt, "Updated rewrite instructions");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    const updatedPrompt = useTranscriptStore
      .getState()
      .aiChapterDetectionConfig.prompts.find((prompt) => prompt.id === "prompt-rewrite-paragraph");

    expect(updatedPrompt?.systemPrompt).toBe("Updated rewrite instructions");
    expect(updatedPrompt?.rewriteScope).toBe("paragraph");
  });

  it("keeps paragraph rewrite scope when duplicating chapter rewrite prompts", async () => {
    const user = userEvent.setup();
    setChapterPrompts([createPrompt()]);

    render(<AITemplateSettings />);

    await openChaptersTab(user);
    await user.click(screen.getByLabelText("Expand prompt details"));
    await user.click(screen.getByRole("button", { name: "Duplicate" }));

    const duplicatedPrompt = useTranscriptStore
      .getState()
      .aiChapterDetectionConfig.prompts.find(
        (prompt) => prompt.name === "Paragraph Rewrite Prompt (Copy)",
      );

    expect(duplicatedPrompt?.operation).toBe("rewrite");
    expect(duplicatedPrompt?.rewriteScope).toBe("paragraph");
  });
});
