import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SpeakerSidebar } from "@/components/SpeakerSidebar";
import type { Segment, Speaker } from "@/lib/store";

const speakers: Speaker[] = [
  { id: "s1", name: "SPEAKER_00", color: "hsl(217, 91%, 48%)" },
  { id: "s2", name: "SPEAKER_01", color: "hsl(142, 76%, 36%)" },
];

const segments: Segment[] = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    start: 0,
    end: 1,
    text: "Hallo",
    words: [{ word: "Hallo", start: 0, end: 1 }],
  },
  {
    id: "seg-2",
    speaker: "SPEAKER_01",
    start: 1,
    end: 2,
    text: "Servus",
    words: [{ word: "Servus", start: 1, end: 2 }],
  },
];

describe("SpeakerSidebar", () => {
  it("renames speakers", async () => {
    const onRenameSpeaker = vi.fn();
    render(
      <SpeakerSidebar
        speakers={speakers}
        segments={segments}
        onRenameSpeaker={onRenameSpeaker}
        onAddSpeaker={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId("button-edit-s1"));
    const input = screen.getByTestId("input-rename-s1");
    await userEvent.clear(input);
    await userEvent.type(input, "Moderator{enter}");

    expect(onRenameSpeaker).toHaveBeenCalledWith("SPEAKER_00", "Moderator");
  });

  it("adds and merges speakers", async () => {
    const onAddSpeaker = vi.fn();
    const onMergeSpeakers = vi.fn();

    render(
      <SpeakerSidebar
        speakers={speakers}
        segments={segments}
        onRenameSpeaker={vi.fn()}
        onAddSpeaker={onAddSpeaker}
        onMergeSpeakers={onMergeSpeakers}
      />,
    );

    await userEvent.click(screen.getByTestId("button-add-speaker"));
    const addInput = screen.getByTestId("input-new-speaker");
    await userEvent.type(addInput, "Gast{enter}");

    expect(onAddSpeaker).toHaveBeenCalledWith("Gast");

    await userEvent.click(screen.getByTestId("button-merge-s1"));
    await userEvent.click(screen.getByTestId("menu-merge-s1-into-s2"));

    expect(onMergeSpeakers).toHaveBeenCalledWith("SPEAKER_00", "SPEAKER_01");
  });

  it("filters and clears speaker selection", async () => {
    const onSpeakerSelect = vi.fn();
    const onClearFilter = vi.fn();

    render(
      <SpeakerSidebar
        speakers={speakers}
        segments={segments}
        onRenameSpeaker={vi.fn()}
        onAddSpeaker={vi.fn()}
        onSpeakerSelect={onSpeakerSelect}
        onClearFilter={onClearFilter}
        selectedSpeakerId="s1"
      />,
    );

    const speakerCard = screen.getByTestId("speaker-card-s1");
    fireEvent.keyDown(speakerCard, { key: "Enter" });
    expect(onSpeakerSelect).toHaveBeenCalledWith("s1");

    await userEvent.click(screen.getByTestId("button-clear-speaker-filter"));
    expect(onClearFilter).toHaveBeenCalled();
  });

  it("cancels adding a speaker", async () => {
    const onAddSpeaker = vi.fn();

    render(
      <SpeakerSidebar
        speakers={speakers}
        segments={segments}
        onRenameSpeaker={vi.fn()}
        onAddSpeaker={onAddSpeaker}
      />,
    );

    await userEvent.click(screen.getByTestId("button-add-speaker"));
    const addInput = screen.getByTestId("input-new-speaker");
    await userEvent.type(addInput, "Guest{escape}");

    expect(onAddSpeaker).not.toHaveBeenCalled();
    expect(screen.queryByTestId("input-new-speaker")).toBeNull();

    await userEvent.click(screen.getByTestId("button-add-speaker"));
    await userEvent.type(screen.getByTestId("input-new-speaker"), "Guest");
    await userEvent.click(screen.getByTestId("button-cancel-add-speaker"));

    expect(onAddSpeaker).not.toHaveBeenCalled();
    expect(screen.queryByTestId("input-new-speaker")).toBeNull();
  });

  it("cancels renaming a speaker", async () => {
    const onRenameSpeaker = vi.fn();

    render(
      <SpeakerSidebar
        speakers={speakers}
        segments={segments}
        onRenameSpeaker={onRenameSpeaker}
        onAddSpeaker={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId("button-edit-s1"));
    const input = screen.getByTestId("input-rename-s1");
    await userEvent.clear(input);
    await userEvent.type(input, "Host{escape}");

    expect(onRenameSpeaker).not.toHaveBeenCalled();
    expect(screen.queryByTestId("input-rename-s1")).toBeNull();
  });
});
