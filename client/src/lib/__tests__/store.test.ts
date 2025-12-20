import { beforeEach, describe, expect, it } from "vitest";
import { type Segment, useTranscriptStore } from "@/lib/store";

const baseState = {
  audioFile: null,
  audioUrl: null,
  segments: [],
  speakers: [],
  selectedSegmentId: null,
  currentTime: 0,
  isPlaying: false,
  duration: 0,
  seekRequestTime: null,
  history: [],
  historyIndex: -1,
  isWhisperXFormat: false,
};

const sampleSegments: Segment[] = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    start: 0,
    end: 1.2,
    text: "Hallo Welt",
    words: [
      { word: "Hallo", start: 0, end: 0.6 },
      { word: "Welt", start: 0.6, end: 1.2 },
    ],
  },
  {
    id: "seg-2",
    speaker: "SPEAKER_01",
    start: 1.2,
    end: 2.6,
    text: "Guten Morgen",
    words: [
      { word: "Guten", start: 1.2, end: 1.9 },
      { word: "Morgen", start: 1.9, end: 2.6 },
    ],
  },
];

const resetStore = () => {
  useTranscriptStore.setState({ ...baseState });
};

describe("useTranscriptStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("loads transcripts and generates speakers", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    const { segments, speakers } = useTranscriptStore.getState();
    expect(segments).toHaveLength(2);
    expect(speakers.map((speaker) => speaker.name)).toEqual(["SPEAKER_00", "SPEAKER_01"]);
  });

  it("updates segment text and keeps history", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });
    const { updateSegmentText } = useTranscriptStore.getState();

    updateSegmentText("seg-1", "Hallo zusammen");

    const { segments, historyIndex, canUndo } = useTranscriptStore.getState();
    expect(segments[0].text).toBe("Hallo zusammen");
    expect(historyIndex).toBe(1);
    expect(canUndo()).toBe(true);
  });

  it("merges adjacent segments", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    const mergedId = useTranscriptStore.getState().mergeSegments("seg-1", "seg-2");
    const { segments } = useTranscriptStore.getState();

    expect(mergedId).not.toBeNull();
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("Hallo Welt Guten Morgen");
    expect(segments[0].words).toHaveLength(4);
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
});
