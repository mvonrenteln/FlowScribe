import { beforeEach, describe, expect, it } from "vitest";
import { useTranscriptStore } from "@/lib/store";
import { resetStore, sampleSegments } from "./storeTestUtils";

describe("Segments slice", () => {
  beforeEach(() => {
    resetStore();
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

  it("tracks confidence score changes separately from structural edits", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });
    const initialVersion = useTranscriptStore.getState().confidenceScoresVersion;

    useTranscriptStore.getState().mergeSegments("seg-1", "seg-2");
    expect(useTranscriptStore.getState().confidenceScoresVersion).toBe(initialVersion);

    resetStore();
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });
    const versionAfterReload = useTranscriptStore.getState().confidenceScoresVersion;

    useTranscriptStore.getState().updateSegmentText("seg-1", "Hallo zusammen");
    expect(useTranscriptStore.getState().confidenceScoresVersion).toBe(versionAfterReload + 1);

    useTranscriptStore.getState().confirmSegment("seg-1");
    expect(useTranscriptStore.getState().confidenceScoresVersion).toBe(versionAfterReload + 2);
  });

  it("preserves timestamps when replacing words", () => {
    useTranscriptStore.setState({
      ...useTranscriptStore.getState(),
      segments: [
        {
          id: "seg-1",
          speaker: "SPEAKER_00",
          tags: [],
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
    expect(segments[0].words.map((word) => word.word)).toEqual(["Hallo", "schoene", "neue"]);
    expect(segments[0].words[0]).toEqual({ word: "Hallo", start: 0, end: 1, score: 0.4 });
    expect(segments[0].words[1]?.start).toBe(1);
    expect(segments[0].words[2]?.end).toBe(3);
  });

  it("confirms a segment by setting word scores to 1", () => {
    useTranscriptStore.setState({
      ...useTranscriptStore.getState(),
      segments: [
        {
          id: "seg-1",
          speaker: "SPEAKER_00",
          tags: [],
          start: 0,
          end: 1,
          text: "Hallo Welt",
          words: [
            { word: "Hallo", start: 0, end: 0.5, score: 0.2 },
            { word: "Welt", start: 0.5, end: 1, score: 0.4 },
          ],
        },
      ],
    });

    useTranscriptStore.getState().confirmSegment("seg-1");

    const { segments } = useTranscriptStore.getState();
    expect(segments[0].words.map((word) => word.score)).toEqual([1, 1]);
    expect(segments[0].confirmed).toBe(true);
  });

  it("toggles a segment bookmark", () => {
    useTranscriptStore.setState({
      ...useTranscriptStore.getState(),
      segments: [
        {
          id: "seg-1",
          speaker: "SPEAKER_00",
          tags: [],
          start: 0,
          end: 1,
          text: "Hallo Welt",
          words: [
            { word: "Hallo", start: 0, end: 0.5 },
            { word: "Welt", start: 0.5, end: 1 },
          ],
        },
      ],
    });

    useTranscriptStore.getState().toggleSegmentBookmark("seg-1");
    expect(useTranscriptStore.getState().segments[0].bookmarked).toBe(true);

    useTranscriptStore.getState().toggleSegmentBookmark("seg-1");
    expect(useTranscriptStore.getState().segments[0].bookmarked).toBe(false);
  });

  it("splits a segment at a valid word boundary", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    useTranscriptStore.getState().splitSegment("seg-1", 1);

    const { segments, selectedSegmentId, currentTime, seekRequestTime } =
      useTranscriptStore.getState();
    expect(segments).toHaveLength(3);
    expect(segments[0].text).toBe("Hallo");
    expect(segments[1].text).toBe("Welt");
    expect(selectedSegmentId).toBe(segments[1].id);
    expect(currentTime).toBeCloseTo(segments[1].start, 5);
    expect(seekRequestTime).toBeCloseTo(segments[1].start, 5);
  });

  it("ignores splits with invalid word boundaries", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    useTranscriptStore.getState().splitSegment("seg-1", 0);
    useTranscriptStore.getState().splitSegment("seg-1", 2);
    useTranscriptStore.getState().splitSegment("missing", 1);

    const { segments, historyIndex } = useTranscriptStore.getState();
    expect(segments).toHaveLength(2);
    expect(historyIndex).toBe(0);
  });

  it("merges adjacent segments in either order", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    const forwardId = useTranscriptStore.getState().mergeSegments("seg-1", "seg-2");
    expect(forwardId).not.toBeNull();
    expect(useTranscriptStore.getState().segments).toHaveLength(1);

    resetStore();
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });
    const reverseId = useTranscriptStore.getState().mergeSegments("seg-2", "seg-1");
    expect(reverseId).not.toBeNull();
    expect(useTranscriptStore.getState().segments).toHaveLength(1);
  });

  it("avoids invalid merges", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    const result = useTranscriptStore.getState().mergeSegments("seg-1", "seg-1");

    expect(result).toBeNull();
    expect(useTranscriptStore.getState().segments).toHaveLength(2);
  });

  it("updates segment timing and records history", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    useTranscriptStore.getState().updateSegmentTiming("seg-2", 1.4, 2.8);

    const { segments, historyIndex } = useTranscriptStore.getState();
    expect(segments[1].start).toBeCloseTo(1.4, 5);
    expect(segments[1].end).toBeCloseTo(2.8, 5);
    expect(historyIndex).toBe(1);
  });

  it("skips timing updates when nothing changes", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });
    const { segments, historyIndex } = useTranscriptStore.getState();

    useTranscriptStore.getState().updateSegmentTiming("seg-1", segments[0].start, segments[0].end);

    const after = useTranscriptStore.getState();
    expect(after.historyIndex).toBe(historyIndex);
  });

  it("deletes a segment and tracks history", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });

    useTranscriptStore.getState().deleteSegment("seg-1");

    const { segments, historyIndex } = useTranscriptStore.getState();
    expect(segments).toHaveLength(1);
    expect(segments[0].id).toBe("seg-2");
    expect(historyIndex).toBe(1);
  });

  it("ignores delete requests for missing ids", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });
    const before = useTranscriptStore.getState();

    useTranscriptStore.getState().deleteSegment("missing-id");

    const after = useTranscriptStore.getState();
    expect(after.segments).toHaveLength(2);
    expect(after.historyIndex).toBe(before.historyIndex);
  });
});
