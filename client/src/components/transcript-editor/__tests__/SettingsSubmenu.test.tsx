import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIRevisionPopover } from "@/components/transcript-editor/AIRevisionPopover";
import { useTranscriptStore } from "@/lib/store";

// Helper to suppress act warnings for async operations
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("SettingsSubmenu keyboard flow", () => {
  const initialState = useTranscriptStore.getState();

  beforeEach(() => {
    const [firstPrompt] = initialState.aiRevisionConfig.prompts;
    useTranscriptStore.setState({
      aiRevisionConfig: {
        ...initialState.aiRevisionConfig,
        prompts: [firstPrompt],
        quickAccessPromptIds: [firstPrompt.id],
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

  it("opens Settings, navigates to Provider, opens provider dropdown with Enter and restores focus on Escape", async () => {
    const user = userEvent.setup();
    const { container } = render(<AIRevisionPopover segmentId="segment-1" />);
    const trigger = container.querySelector("button[aria-label]");
    expect(trigger).toBeTruthy();

    await act(async () => {
      await user.click(trigger as HTMLButtonElement);
    });

    await act(async () => {
      await flushPromises();
    });

    // Open Settings
    const settingsButton = await screen.findByRole("button", { name: /Settings|Settings/i });
    await act(async () => {
      await user.click(settingsButton);
    });

    await act(async () => {
      await flushPromises();
    });

    // Provider trigger should exist — label is a sibling, the actual trigger is the following button
    const providerLabel = screen.getByText(/Provider/i);
    const providerTrigger = providerLabel.parentElement?.querySelector("button");
    expect(providerTrigger).toBeTruthy();

    // Focus provider trigger
    providerTrigger && providerTrigger.focus();
    await waitFor(() => expect(providerTrigger).toHaveFocus());

    // Press Enter to open provider dropdown
    await act(async () => {
      await user.keyboard("{Enter}");
    });

    await act(async () => {
      await flushPromises();
    });

    // There should be at least one provider item in the list (from settings)
    const item = await screen.findByRole("option");
    expect(item).toBeTruthy();

    // Press Escape to close the dropdown
    await act(async () => {
      await user.keyboard("{Escape}");
    });

    await act(async () => {
      await flushPromises();
    });

    // Provider trigger should regain focus
    await waitFor(() => expect(providerTrigger).toHaveFocus());
  });
});
