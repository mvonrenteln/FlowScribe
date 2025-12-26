import { beforeEach, describe, expect, it } from "vitest";
import { useTranscriptStore } from "@/lib/store";
import { resetStore } from "./storeTestUtils";

const baseSegments = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    start: 0,
    end: 1,
    text: "Original text",
    words: [{ word: "Original", start: 0, end: 1 }],
  },
];

const baseSpeakers = [{ id: "spk-1", name: "SPEAKER_00", color: "red" }];

describe("revisions stay isolated", () => {
  beforeEach(() => {
    resetStore();
    useTranscriptStore.setState({
      segments: baseSegments,
      speakers: baseSpeakers,
      selectedSegmentId: "seg-1",
      history: [{ segments: baseSegments, speakers: baseSpeakers, selectedSegmentId: "seg-1" }],
      historyIndex: 0,
      sessionLabel: "Transcript A",
    });
  });

  it("keeps revisions immutable while the current session continues", () => {
    const baseKey = useTranscriptStore.getState().sessionKey;
    const revisionKey = useTranscriptStore.getState().createRevision("First pass");

    expect(revisionKey).toBeTruthy();
    useTranscriptStore.getState().updateSegmentText("seg-1", "Edited live version");

    useTranscriptStore.getState().activateSession(revisionKey as string);
    expect(useTranscriptStore.getState().sessionKind).toBe("revision");
    expect(useTranscriptStore.getState().sessionLabel).toBe("First pass");
    expect(useTranscriptStore.getState().segments[0]?.text).toBe("Original text");

    useTranscriptStore.getState().activateSession(baseKey);
    expect(useTranscriptStore.getState().segments[0]?.text).toBe("Edited live version");
    expect(useTranscriptStore.getState().sessionKind).toBe("current");
  });

  it("ignores empty revision names", () => {
    const initialRecentCount = useTranscriptStore.getState().recentSessions.length;
    const revisionKey = useTranscriptStore.getState().createRevision("   ");

    expect(revisionKey).toBeNull();
    expect(useTranscriptStore.getState().recentSessions).toHaveLength(initialRecentCount);
  });

  it("adds revision metadata to recent sessions", () => {
    const revisionKey = useTranscriptStore.getState().createRevision("QC Revision");
    expect(revisionKey).toBeTruthy();
    const revisionEntry = useTranscriptStore
      .getState()
      .recentSessions.find((session) => session.key === revisionKey);

    expect(revisionEntry).toMatchObject({
      kind: "revision",
      label: "QC Revision",
    });
  });
});
