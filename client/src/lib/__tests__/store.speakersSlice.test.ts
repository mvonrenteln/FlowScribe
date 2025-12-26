import { beforeEach, describe, expect, it } from "vitest";
import { useTranscriptStore } from "@/lib/store";
import { createBaseState, resetStore, sampleSegments } from "./storeTestUtils";

describe("Speakers slice", () => {
  beforeEach(() => {
    resetStore();
  });

  it("renames and merges speakers", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });
    const { renameSpeaker, mergeSpeakers } = useTranscriptStore.getState();

    renameSpeaker("SPEAKER_00", "Interviewerin");
    mergeSpeakers("SPEAKER_01", "Interviewerin");

    const { segments, speakers } = useTranscriptStore.getState();
    expect(speakers).toHaveLength(1);
    expect(speakers[0].name).toBe("Interviewerin");
    expect(segments.every((segment) => segment.speaker === "Interviewerin")).toBe(true);
  });

  it("keeps word speakers when updating a segment speaker", () => {
    useTranscriptStore.setState({
      ...createBaseState(),
      segments: [
        {
          id: "seg-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 1,
          text: "Hallo Welt",
          words: [
            { word: "Hallo", start: 0, end: 0.5, speaker: "SPEAKER_00" },
            { word: "Welt", start: 0.5, end: 1, speaker: "SPEAKER_01" },
          ],
        },
      ],
      speakers: [
        { id: "s1", name: "SPEAKER_00", color: "red" },
        { id: "s2", name: "SPEAKER_01", color: "blue" },
      ],
    });

    useTranscriptStore.getState().updateSegmentSpeaker("seg-1", "SPEAKER_01");

    const { segments } = useTranscriptStore.getState();
    expect(segments[0].speaker).toBe("SPEAKER_01");
    expect(segments[0].words[0].speaker).toBe("SPEAKER_00");
    expect(segments[0].words[1].speaker).toBe("SPEAKER_01");
  });

  it("adds a new speaker and tracks history", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    useTranscriptStore.getState().addSpeaker("SPEAKER_02");

    const { speakers, historyIndex } = useTranscriptStore.getState();
    expect(speakers.map((speaker) => speaker.name)).toContain("SPEAKER_02");
    expect(historyIndex).toBe(1);
  });

  it("ignores invalid speaker renames and merges", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });
    const before = useTranscriptStore.getState();

    useTranscriptStore.getState().renameSpeaker("missing", "New Name");
    useTranscriptStore.getState().renameSpeaker("SPEAKER_00", "SPEAKER_00");
    useTranscriptStore.getState().mergeSpeakers("missing", "SPEAKER_00");
    useTranscriptStore.getState().mergeSpeakers("SPEAKER_00", "missing");
    useTranscriptStore.getState().mergeSpeakers("SPEAKER_00", "SPEAKER_00");

    const after = useTranscriptStore.getState();
    expect(after.speakers).toEqual(before.speakers);
    expect(after.segments).toEqual(before.segments);
  });
});
