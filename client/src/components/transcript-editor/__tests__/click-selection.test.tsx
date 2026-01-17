import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TranscriptSegment } from "@/components/TranscriptSegment";
import type { Segment, Speaker } from "@/lib/store";

const speakers: Speaker[] = [{ id: "s1", name: "SPEAKER_00", color: "hsl(217, 91%, 48%)" }];

const segment: Segment = {
  id: "seg-1",
  speaker: "SPEAKER_00",
  tags: [],
  start: 0,
  end: 2,
  text: "Hallo Welt",
  words: [
    { word: "Hallo", start: 0, end: 1 },
    { word: "Welt", start: 1, end: 2 },
  ],
};

describe("click selection regression", () => {
  it("clicking a word selects the segment and seeks", async () => {
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

    // Clicking a word should still seek — test separately
    const word = screen.getByTestId("word-seg-1-0");
    fireEvent.click(word);
    expect(onSeek).toHaveBeenCalledWith(0, { source: "transcript", action: "word_click" });
  });
});
