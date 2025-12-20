import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TranscriptSegment } from "@/components/TranscriptSegment";
import type { Segment, Speaker } from "@/lib/store";

const speakers: Speaker[] = [
  { id: "s1", name: "SPEAKER_00", color: "hsl(217, 91%, 48%)" },
  { id: "s2", name: "SPEAKER_01", color: "hsl(142, 76%, 36%)" },
];

const segment: Segment = {
  id: "seg-1",
  speaker: "SPEAKER_00",
  start: 0,
  end: 2,
  text: "Hallo Welt",
  words: [
    { word: "Hallo", start: 0, end: 1 },
    { word: "Welt", start: 1, end: 2 },
  ],
};

describe("TranscriptSegment", () => {
  it("renders word tokens and seeks on click", async () => {
    const onSeek = vi.fn();
    const onSelect = vi.fn();
    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        currentTime={0}
        onSelect={onSelect}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onDelete={vi.fn()}
        onSeek={onSeek}
      />,
    );

    const segmentCard = screen.getByTestId("segment-seg-1");
    fireEvent.keyDown(segmentCard, { key: "Enter" });
    const word = screen.getByTestId("word-seg-1-0");
    await userEvent.click(word);

    expect(onSelect).toHaveBeenCalled();
    expect(onSeek).toHaveBeenCalledWith(0);
    expect(screen.getByText("Hallo")).toBeInTheDocument();
    expect(screen.getByText("Welt")).toBeInTheDocument();
  });

  it("splits on selected word", async () => {
    const onSplit = vi.fn();
    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        currentTime={0}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={onSplit}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const word = screen.getByTestId("word-seg-1-1");
    fireEvent.click(word, { shiftKey: true });

    const splitButton = screen.getByTestId("button-split-seg-1");
    await userEvent.click(splitButton);

    expect(onSplit).toHaveBeenCalledWith(1);
  });

  it("saves edited text on blur", () => {
    const onTextChange = vi.fn();
    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        currentTime={0}
        onSelect={vi.fn()}
        onTextChange={onTextChange}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const textBlock = screen.getByTestId("text-segment-seg-1");
    fireEvent.doubleClick(textBlock);
    Object.defineProperty(textBlock, "innerText", {
      value: "Hallo zusammen",
      writable: true,
    });
    fireEvent.blur(textBlock);

    expect(onTextChange).toHaveBeenCalledWith("Hallo zusammen");
  });
});
