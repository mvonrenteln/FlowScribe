import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TranscriptSegment } from "@/components/TranscriptSegment";
import type { Segment, Speaker } from "@/lib/store";

const speakers: Speaker[] = [{ id: "s1", name: "SPEAKER_00", color: "hsl(217, 91%, 48%)" }];

const segment: Segment = {
  id: "seg-1",
  speaker: "SPEAKER_00",
  tags: [],
  start: 10,
  end: 12,
  text: "Hallo Welt",
  words: [
    { word: "Hallo", start: 10, end: 11 },
    { word: "Welt", start: 11, end: 12 },
  ],
};

describe("click selection regression", () => {
  it("clicking the segment root selects after the click timeout", async () => {
    const onSeek = vi.fn();
    const onSelect = vi.fn();

    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        tags={[]}
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

    // Clicking the segment root should select the segment
    // The selection is delayed to allow double-click to cancel single-clicks.
    // Use fake timers to advance the timeout.
    vi.useFakeTimers();
    const segmentEl = screen.getByTestId("segment-seg-1");
    fireEvent.mouseDown(segmentEl, { button: 0, detail: 1 });
    // Advance past the 200ms click timeout used in useSegmentEditing
    vi.advanceTimersByTime(250);
    expect(onSelect).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("clicking a word selects without segment-start seek and seeks to the word time", async () => {
    vi.useFakeTimers();
    const onSeek = vi.fn();
    const onSelect = vi.fn(() => {
      onSeek(segment.start, { source: "transcript", action: "segment_click" });
    });
    const onSelectOnly = vi.fn();

    render(
      <TranscriptSegment
        segment={segment}
        speakers={speakers}
        tags={[]}
        isSelected={false}
        isActive={false}
        onSelect={onSelect}
        onSelectOnly={onSelectOnly}
        onTextChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onSplit={vi.fn()}
        onConfirm={vi.fn()}
        onToggleBookmark={vi.fn()}
        onDelete={vi.fn()}
        onSeek={onSeek}
      />,
    );

    const word = screen.getByTestId("word-seg-1-1");
    fireEvent.click(word);

    // Flush any pending segment single-click timeout if it was scheduled.
    vi.advanceTimersByTime(250);

    expect(onSelect).not.toHaveBeenCalled();
    expect(onSelectOnly).toHaveBeenCalled();
    expect(onSeek).toHaveBeenCalledWith(11, { source: "transcript", action: "word_click" });
    expect(onSeek).not.toHaveBeenCalledWith(10, { source: "transcript", action: "segment_click" });

    vi.useRealTimers();
  });
});
