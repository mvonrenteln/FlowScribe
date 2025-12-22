import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlaybackControls } from "@/components/PlaybackControls";

describe("PlaybackControls", () => {
  it("splits at the current word when the scissors button is clicked", async () => {
    const onSplitAtCurrentWord = vi.fn();
    render(
      <PlaybackControls
        isPlaying={false}
        currentTime={1}
        duration={10}
        onPlayPause={vi.fn()}
        onSeek={vi.fn()}
        onSkipBack={vi.fn()}
        onSkipForward={vi.fn()}
        onSplitAtCurrentWord={onSplitAtCurrentWord}
        canSplitAtCurrentWord={true}
      />,
    );

    await userEvent.click(screen.getByTestId("button-split-current-word"));

    expect(onSplitAtCurrentWord).toHaveBeenCalledTimes(1);
  });

  it("disables the split control when splitting is unavailable", async () => {
    const onSplitAtCurrentWord = vi.fn();
    render(
      <PlaybackControls
        isPlaying={false}
        currentTime={1}
        duration={10}
        onPlayPause={vi.fn()}
        onSeek={vi.fn()}
        onSkipBack={vi.fn()}
        onSkipForward={vi.fn()}
        onSplitAtCurrentWord={onSplitAtCurrentWord}
        canSplitAtCurrentWord={false}
      />,
    );

    const splitButton = screen.getByTestId("button-split-current-word");
    expect(splitButton).toBeDisabled();

    await userEvent.click(splitButton);

    expect(onSplitAtCurrentWord).not.toHaveBeenCalled();
  });
});
