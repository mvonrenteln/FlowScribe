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
    window.localStorage.clear();
  });

  it("loads transcripts and generates speakers", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    const { segments, speakers, selectedSegmentId } = useTranscriptStore.getState();
    expect(segments).toHaveLength(2);
    expect(speakers.map((speaker) => speaker.name)).toEqual(["SPEAKER_00", "SPEAKER_01"]);
    expect(selectedSegmentId).toBe("seg-1");
  });

  it("updates segment text and keeps history", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });
    const { updateSegmentText } = useTranscriptStore.getState();

    updateSegmentText("seg-1", "Hallo zusammen");

    const { segments, historyIndex, canUndo } = useTranscriptStore.getState();
    expect(segments[0].text).toBe("Hallo zusammen");
    expect(segments[0].words.map((word) => word.word)).toEqual(["Hallo", "zusammen"]);
    expect(historyIndex).toBe(1);
    expect(canUndo()).toBe(true);
  });

  it("keeps existing timestamps when replacing a word with multiple words", () => {
    useTranscriptStore.setState({
      ...baseState,
      segments: [
        {
          id: "seg-1",
          speaker: "SPEAKER_00",
          start: 0,
          end: 3,
          text: "Hallo Welt",
          words: [
            { word: "Hallo", start: 0, end: 1, score: 0.4 },
            { word: "Welt", start: 1, end: 3, score: 0.7 },
          ],
        },
      ],
    });

    const { updateSegmentText } = useTranscriptStore.getState();
    updateSegmentText("seg-1", "Hallo schoene neue");

    const { segments } = useTranscriptStore.getState();
    expect(segments[0].words.map((word) => word.word)).toEqual([
      "Hallo",
      "schoene",
      "neue",
    ]);
    expect(segments[0].words[0]).toEqual({ word: "Hallo", start: 0, end: 1, score: 0.4 });
    expect(segments[0].words[1]?.start).toBe(1);
    expect(segments[0].words[2]?.end).toBe(3);
    expect(segments[0].words[1]?.score).toBe(1);
    expect(segments[0].words[2]?.score).toBe(1);
  });

  it("merges adjacent segments", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    const mergedId = useTranscriptStore.getState().mergeSegments("seg-1", "seg-2");
    const { segments, selectedSegmentId } = useTranscriptStore.getState();

    expect(mergedId).not.toBeNull();
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("Hallo Welt Guten Morgen");
    expect(segments[0].words).toHaveLength(4);
    expect(selectedSegmentId).toBe(mergedId);
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

  it("updates segment speakers and keeps history", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });
    const { updateSegmentSpeaker } = useTranscriptStore.getState();

    updateSegmentSpeaker("seg-1", "SPEAKER_01");

    const { segments, historyIndex, canUndo } = useTranscriptStore.getState();
    expect(segments[0].speaker).toBe("SPEAKER_01");
    expect(historyIndex).toBe(1);
    expect(canUndo()).toBe(true);
  });

  it("splits a segment at a valid word boundary", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    useTranscriptStore.getState().splitSegment("seg-1", 1);

    const { segments, selectedSegmentId, currentTime, seekRequestTime } =
      useTranscriptStore.getState();
    expect(segments).toHaveLength(3);
    expect(segments[0].text).toBe("Hallo");
    expect(segments[1].text).toBe("Welt");
    expect(segments[0].end).toBeCloseTo(0.6, 5);
    expect(segments[1].start).toBeCloseTo(0.6, 5);
    expect(selectedSegmentId).toBe(segments[1].id);
    expect(currentTime).toBeCloseTo(segments[1].start, 5);
    expect(seekRequestTime).toBeCloseTo(segments[1].start, 5);
  });


  it("does not split a segment when the word index is invalid", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    useTranscriptStore.getState().splitSegment("seg-1", 0);
    useTranscriptStore.getState().splitSegment("seg-1", 2);
    useTranscriptStore.getState().splitSegment("missing", 1);

    const { segments, historyIndex } = useTranscriptStore.getState();
    expect(segments).toHaveLength(2);
    expect(historyIndex).toBe(0);
  });

  it("updates segment timing and records history", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    useTranscriptStore.getState().updateSegmentTiming("seg-2", 1.4, 2.8);

    const { segments, historyIndex } = useTranscriptStore.getState();
    expect(segments[1].start).toBeCloseTo(1.4, 5);
    expect(segments[1].end).toBeCloseTo(2.8, 5);
    expect(historyIndex).toBe(1);
  });

  it("deletes a segment and tracks history", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    useTranscriptStore.getState().deleteSegment("seg-1");

    const { segments, historyIndex } = useTranscriptStore.getState();
    expect(segments).toHaveLength(1);
    expect(segments[0].id).toBe("seg-2");
    expect(historyIndex).toBe(1);
  });

  it("undoes and redoes transcript changes", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });
    const { updateSegmentText, undo, redo, canRedo, canUndo } = useTranscriptStore.getState();

    updateSegmentText("seg-1", "Hallo zusammen");

    expect(canUndo()).toBe(true);
    undo();
    expect(useTranscriptStore.getState().segments[0].text).toBe("Hallo Welt");
    expect(canRedo()).toBe(true);
    redo();
    expect(useTranscriptStore.getState().segments[0].text).toBe("Hallo zusammen");
  });

  it("restores selection when undoing a merge", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });
    const { setSelectedSegmentId, mergeSegments, undo } = useTranscriptStore.getState();

    setSelectedSegmentId("seg-2");

    const mergedId = mergeSegments("seg-1", "seg-2");
    expect(useTranscriptStore.getState().selectedSegmentId).toBe(mergedId);

    undo();
    expect(useTranscriptStore.getState().selectedSegmentId).toBe("seg-2");
  });

  it("avoids invalid merges and duplicate speakers", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });
    const { mergeSegments, addSpeaker, speakers } = useTranscriptStore.getState();

    const result = mergeSegments("seg-1", "seg-1");
    addSpeaker("SPEAKER_00");

    expect(result).toBeNull();
    expect(useTranscriptStore.getState().speakers).toEqual(speakers);
  });
});
