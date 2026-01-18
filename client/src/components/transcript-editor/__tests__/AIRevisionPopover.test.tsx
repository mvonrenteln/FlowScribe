import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIRevisionPopover } from "@/components/transcript-editor/AIRevisionPopover";
import { useTranscriptStore } from "@/lib/store";

describe("AIRevisionPopover", () => {
  const initialState = useTranscriptStore.getState();

  beforeEach(() => {
    const [firstPrompt, secondPrompt] = initialState.aiRevisionConfig.prompts;
    useTranscriptStore.setState({
      aiRevisionConfig: {
        ...initialState.aiRevisionConfig,
        prompts: [firstPrompt, secondPrompt],
        quickAccessPromptIds: [firstPrompt.id, secondPrompt.id],
      },
      aiRevisionSuggestions: [],
      aiRevisionIsProcessing: false,
      aiRevisionCurrentSegmentId: null,
      aiRevisionLastResult: null,
      startSingleRevision: vi.fn(),
      setAiRevisionLastSelection: vi.fn(),
    });
  });

  afterEach(() => {
    useTranscriptStore.setState(initialState, true);
  });

  it("focuses the first prompt and supports arrow navigation", async () => {
    const user = userEvent.setup();
    const { container } = render(<AIRevisionPopover segmentId="segment-1" />);
    const trigger = container.querySelector("button[aria-label]");
    expect(trigger).toBeTruthy();

    await user.click(trigger as HTMLButtonElement);

    const firstPrompt = await screen.findByRole("button", {
      name: initialState.aiRevisionConfig.prompts[0].name,
    });
    const secondPrompt = screen.getByRole("button", {
      name: initialState.aiRevisionConfig.prompts[1].name,
    });

    await waitFor(() => {
      expect(firstPrompt).toHaveFocus();
    });

    await user.keyboard("{ArrowDown}");

    await waitFor(() => {
      expect(secondPrompt).toHaveFocus();
    });
  });
});
