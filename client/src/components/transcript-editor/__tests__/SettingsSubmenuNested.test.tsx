import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIRevisionPopover } from "@/components/transcript-editor/AIRevisionPopover";
import { useTranscriptStore } from "@/lib/store";

// Helper to suppress act warnings for async operations
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("SettingsSubmenu nested selects", () => {
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

  it("opens provider then model select and uses Escape to back out to triggers and then to popover trigger", async () => {
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

    const providerLabel = screen.getByText(/Provider/i);
    const modelLabel = screen.getByText(/Model/i);
    const providerTrigger = providerLabel.parentElement?.querySelector("button");
    const modelTrigger = modelLabel.parentElement?.querySelector("button");
    expect(providerTrigger).toBeTruthy();
    expect(modelTrigger).toBeTruthy();

    // Open provider dropdown
    providerTrigger?.focus();
    await waitFor(() => expect(providerTrigger).toHaveFocus());
    await act(async () => {
      await user.keyboard("{Enter}");
    });

    await act(async () => {
      await flushPromises();
    });

    // Close provider dropdown with Escape -> providerTrigger should have focus
    await act(async () => {
      await user.keyboard("{Escape}");
    });
    await act(async () => {
      await flushPromises();
    });
    await waitFor(() => expect(providerTrigger).toHaveFocus());

    // Move to model trigger
    modelTrigger?.focus();
    await waitFor(() => expect(modelTrigger).toHaveFocus());

    // Open model dropdown
    await act(async () => {
      await user.keyboard("{Enter}");
    });
    await act(async () => {
      await flushPromises();
    });

    // Close model dropdown with Escape -> modelTrigger should have focus
    await act(async () => {
      await user.keyboard("{Escape}");
    });
    await act(async () => {
      await flushPromises();
    });
    await waitFor(() => expect(modelTrigger).toHaveFocus());

    // Press Escape again to close settings submenu -> popover trigger should have focus
    await act(async () => {
      await user.keyboard("{Escape}");
    });
    await act(async () => {
      await flushPromises();
    });

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
