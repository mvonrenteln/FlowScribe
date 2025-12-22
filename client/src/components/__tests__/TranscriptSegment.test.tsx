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
        onSelect={onSelect}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
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
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={onSplit}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
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

  it("saves edited text on Enter", async () => {
    const onTextChange = vi.fn();
    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={onTextChange}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const textBlock = screen.getByTestId("text-segment-seg-1");
    fireEvent.doubleClick(textBlock);

    const textarea = screen.getByTestId("textarea-segment-seg-1");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Hallo zusammen");
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onTextChange).toHaveBeenCalledWith("Hallo zusammen");
  });

  it("cancels edits on Escape", async () => {
    const onTextChange = vi.fn();
    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={onTextChange}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const textBlock = screen.getByTestId("text-segment-seg-1");
    fireEvent.doubleClick(textBlock);

    const textarea = screen.getByTestId("textarea-segment-seg-1");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Andere Worte");
    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(onTextChange).not.toHaveBeenCalled();
    expect(screen.getByText("Hallo")).toBeInTheDocument();
    expect(screen.getByText("Welt")).toBeInTheDocument();
  });

  it("saves edited text via the save button", async () => {
    const onTextChange = vi.fn();
    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={onTextChange}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const textBlock = screen.getByTestId("text-segment-seg-1");
    fireEvent.doubleClick(textBlock);

    const textarea = screen.getByTestId("textarea-segment-seg-1");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Neue Worte");
    await userEvent.click(screen.getByTestId("button-save-segment-seg-1"));

    expect(onTextChange).toHaveBeenCalledWith("Neue Worte");
  });

  it("cancels edits via the cancel button", async () => {
    const onTextChange = vi.fn();
    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={onTextChange}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const textBlock = screen.getByTestId("text-segment-seg-1");
    fireEvent.doubleClick(textBlock);

    const textarea = screen.getByTestId("textarea-segment-seg-1");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Andere Worte");
    await userEvent.click(screen.getByTestId("button-cancel-segment-seg-1"));

    expect(onTextChange).not.toHaveBeenCalled();
    expect(screen.getByText("Hallo")).toBeInTheDocument();
    expect(screen.getByText("Welt")).toBeInTheDocument();
  });

  it("seeks when activating word with keyboard", () => {
    const onSeek = vi.fn();
    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={onSeek}
      />,
    );

    const word = screen.getByTestId("word-seg-1-0");
    fireEvent.keyDown(word, { key: "Enter" });

    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it("uses fallback speaker color when missing speaker data", () => {
    render(
      <TranscriptSegment
        segment={segment}
        speakers={[]}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const segmentCard = screen.getByTestId("segment-seg-1");
    const colorSwatch = segmentCard.querySelector("div[style]");

    expect(colorSwatch).toHaveStyle({ backgroundColor: "hsl(217, 91%, 48%)" });
  });

  it("splits at the current word from the segment menu", async () => {
    const onSplit = vi.fn();
    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={true}
        activeWordIndex={1}
        splitWordIndex={1}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={onSplit}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId("button-segment-menu-seg-1"));
    await userEvent.click(screen.getByText("Split at current word"));

    expect(onSplit).toHaveBeenCalledWith(1);
  });

  it("does not split at the current word when the segment is inactive", async () => {
    const onSplit = vi.fn();
    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        activeWordIndex={1}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={onSplit}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId("button-segment-menu-seg-1"));
    await userEvent.click(screen.getByText("Split at current word"));

    expect(onSplit).not.toHaveBeenCalled();
  });

  it("confirms the segment from the menu", async () => {
    const onConfirm = vi.fn();
    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={onConfirm}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId("button-segment-menu-seg-1"));
    await userEvent.click(screen.getByText("Confirm block"));

    expect(onConfirm).toHaveBeenCalled();
  });

  it("confirms the segment via the quick action button", async () => {
    const onConfirm = vi.fn();
    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={onConfirm}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId("button-confirm-seg-1"));

    expect(onConfirm).toHaveBeenCalled();
  });

  it("toggles bookmark via the quick action button", async () => {
    const onToggleBookmark = vi.fn();
    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={onToggleBookmark}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId("button-bookmark-seg-1"));

    expect(onToggleBookmark).toHaveBeenCalled();
  });

  it("shows the confirmed badge and icon when a segment is confirmed", () => {
    const confirmedSegment: Segment = { ...segment, confirmed: true };
    render(
      <TranscriptSegment
        segment={confirmedSegment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByLabelText("Segment confirmed")).toBeDisabled();
  });

  it("highlights low confidence words when enabled", () => {
    const scoredSegment: Segment = {
      ...segment,
      words: [
        { word: "Hallo", start: 0, end: 1, score: 0.15 },
        { word: "Welt", start: 1, end: 2, score: 0.8 },
      ],
    };

    render(
      <TranscriptSegment
        segment={scoredSegment}
        speakers={speakers}
        isSelected={false}
        isActive={false}
        highlightLowConfidence={true}
        lowConfidenceThreshold={0.3}
        onSelect={vi.fn()}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    const lowWord = screen.getByTestId("word-seg-1-0");
    const highWord = screen.getByTestId("word-seg-1-1");

    expect(lowWord.className).toContain("decoration-dotted");
    expect(highWord.className).not.toContain("decoration-dotted");
  });
});
