import { beforeEach, describe, expect, it } from "vitest";
import { useTranscriptStore } from "@/lib/store";
import { resetStore, sampleSegments } from "./storeTestUtils";

describe("History slice", () => {
  beforeEach(() => {
    resetStore();
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

  it("updates selection even when history is missing", () => {
    useTranscriptStore.setState({
      ...useTranscriptStore.getState(),
      history: [],
      historyIndex: 0,
    });

    useTranscriptStore.getState().setSelectedSegmentId("seg-1");

    const state = useTranscriptStore.getState();
    expect(state.selectedSegmentId).toBe("seg-1");
    expect(state.history).toEqual([]);
  });

  it("does not undo or redo outside the history range", () => {
    useTranscriptStore.getState().loadTranscript({ segments: sampleSegments });
    const { undo, redo, updateSegmentText } = useTranscriptStore.getState();
    const before = useTranscriptStore.getState();

    undo();
    expect(useTranscriptStore.getState().segments).toEqual(before.segments);

    updateSegmentText("seg-1", "Hallo zusammen");
    const afterUpdate = useTranscriptStore.getState();
    redo();
    expect(useTranscriptStore.getState().segments).toEqual(afterUpdate.segments);
  });
});
