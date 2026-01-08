import { beforeEach, describe, expect, it } from "vitest";
import { useTranscriptStore } from "@/lib/store";
import type { Segment, Speaker } from "@/lib/store/types";

describe("aiSpeakerSlice - acceptManySuggestions", () => {
  beforeEach(() => {
    // Reset store to initial state
    useTranscriptStore.setState({
      speakers: [],
      segments: [],
      aiSpeakerSuggestions: [],
    });

    // Setup initial state with segments and speakers
    const speakers: Speaker[] = [
      { id: "SPEAKER_00", name: "SPEAKER_00", color: "#000000" },
      { id: "SPEAKER_01", name: "SPEAKER_01", color: "#111111" },
    ];

    const segments: Segment[] = [
      {
        id: "seg1",
        text: "Hello world",
        start: 0,
        end: 1,
        speaker: "SPEAKER_00",
        confirmed: false,
        words: [],
      },
      {
        id: "seg2",
        text: "Second segment",
        start: 1,
        end: 2,
        speaker: "SPEAKER_00",
        confirmed: false,
        words: [],
      },
      {
        id: "seg3",
        text: "Third segment",
        start: 2,
        end: 3,
        speaker: "SPEAKER_01",
        confirmed: false,
        words: [],
      },
    ];

    useTranscriptStore.setState({ speakers, segments });
  });

  it("should create new speakers for unique speaker IDs", () => {
    useTranscriptStore.setState({
      aiSpeakerSuggestions: [
        {
          segmentId: "seg1",
          currentSpeaker: "SPEAKER_00",
          suggestedSpeaker: "SPEAKER_02",
          confidence: 0.9,
          status: "pending",
        },
        {
          segmentId: "seg2",
          currentSpeaker: "SPEAKER_00",
          suggestedSpeaker: "SPEAKER_03",
          confidence: 0.85,
          status: "pending",
        },
      ],
    });

    const initialSpeakerCount = useTranscriptStore.getState().speakers.length;

    useTranscriptStore.getState().acceptManySuggestions(["seg1", "seg2"]);

    const finalSpeakers = useTranscriptStore.getState().speakers;
    expect(finalSpeakers.length).toBe(initialSpeakerCount + 2);
    expect(finalSpeakers.find((s) => s.name === "SPEAKER_02")).toBeDefined();
    expect(finalSpeakers.find((s) => s.name === "SPEAKER_03")).toBeDefined();
  });

  it("should not duplicate speakers that already exist", () => {
    useTranscriptStore.setState({
      aiSpeakerSuggestions: [
        {
          segmentId: "seg1",
          currentSpeaker: "SPEAKER_00",
          suggestedSpeaker: "SPEAKER_01",
          confidence: 0.9,
          status: "pending",
        },
        {
          segmentId: "seg2",
          currentSpeaker: "SPEAKER_00",
          suggestedSpeaker: "SPEAKER_01",
          confidence: 0.85,
          status: "pending",
        },
      ],
    });

    const initialSpeakerCount = useTranscriptStore.getState().speakers.length;

    useTranscriptStore.getState().acceptManySuggestions(["seg1", "seg2"]);

    const finalSpeakers = useTranscriptStore.getState().speakers;
    expect(finalSpeakers.length).toBe(initialSpeakerCount); // No new speakers
  });

  it("should update segment speakers correctly", () => {
    useTranscriptStore.setState({
      aiSpeakerSuggestions: [
        {
          segmentId: "seg1",
          currentSpeaker: "SPEAKER_00",
          suggestedSpeaker: "SPEAKER_02",
          confidence: 0.9,
          status: "pending",
        },
        {
          segmentId: "seg2",
          currentSpeaker: "SPEAKER_00",
          suggestedSpeaker: "SPEAKER_03",
          confidence: 0.85,
          status: "pending",
        },
      ],
    });

    useTranscriptStore.getState().acceptManySuggestions(["seg1", "seg2"]);

    const segments = useTranscriptStore.getState().segments;
    expect(segments.find((s) => s.id === "seg1")?.speaker).toBe("SPEAKER_02");
    expect(segments.find((s) => s.id === "seg2")?.speaker).toBe("SPEAKER_03");
    expect(segments.find((s) => s.id === "seg3")?.speaker).toBe("SPEAKER_01"); // Unchanged
  });

  it("should remove accepted suggestions from store", () => {
    useTranscriptStore.setState({
      aiSpeakerSuggestions: [
        {
          segmentId: "seg1",
          currentSpeaker: "SPEAKER_00",
          suggestedSpeaker: "SPEAKER_02",
          confidence: 0.9,
          status: "pending",
        },
        {
          segmentId: "seg2",
          currentSpeaker: "SPEAKER_00",
          suggestedSpeaker: "SPEAKER_03",
          confidence: 0.85,
          status: "pending",
        },
        {
          segmentId: "seg3",
          currentSpeaker: "SPEAKER_01",
          suggestedSpeaker: "SPEAKER_04",
          confidence: 0.8,
          status: "pending",
        },
      ],
    });

    useTranscriptStore.getState().acceptManySuggestions(["seg1", "seg2"]);

    const remainingSuggestions = useTranscriptStore.getState().aiSpeakerSuggestions;
    expect(remainingSuggestions.length).toBe(1);
    expect(remainingSuggestions[0].segmentId).toBe("seg3");
  });

  it("should handle empty segment IDs array", () => {
    useTranscriptStore.setState({
      aiSpeakerSuggestions: [
        {
          segmentId: "seg1",
          currentSpeaker: "SPEAKER_00",
          suggestedSpeaker: "SPEAKER_02",
          confidence: 0.9,
          status: "pending",
        },
      ],
    });

    const initialSpeakers = useTranscriptStore.getState().speakers;
    const initialSegments = useTranscriptStore.getState().segments;
    const initialSuggestions = useTranscriptStore.getState().aiSpeakerSuggestions;

    useTranscriptStore.getState().acceptManySuggestions([]);

    // Nothing should change
    expect(useTranscriptStore.getState().speakers).toEqual(initialSpeakers);
    expect(useTranscriptStore.getState().segments).toEqual(initialSegments);
    expect(useTranscriptStore.getState().aiSpeakerSuggestions).toEqual(initialSuggestions);
  });

  it("should handle suggestions with non-existent segment IDs gracefully", () => {
    useTranscriptStore.setState({
      aiSpeakerSuggestions: [
        {
          segmentId: "seg1",
          currentSpeaker: "SPEAKER_00",
          suggestedSpeaker: "SPEAKER_02",
          confidence: 0.9,
          status: "pending",
        },
        {
          segmentId: "seg2",
          currentSpeaker: "SPEAKER_00",
          suggestedSpeaker: "SPEAKER_03",
          confidence: 0.85,
          status: "pending",
        },
      ],
    });

    // Should not throw when including non-existent segment ID
    expect(() => {
      useTranscriptStore.getState().acceptManySuggestions(["seg1", "nonexistent"]);
    }).not.toThrow();

    // seg1 should be updated (has suggestion), nonexistent should be ignored (no suggestion)
    const segments = useTranscriptStore.getState().segments;
    expect(segments.find((s) => s.id === "seg1")?.speaker).toBe("SPEAKER_02");
    expect(segments.find((s) => s.id === "seg2")?.speaker).toBe("SPEAKER_00"); // Not accepted

    // Only seg1 suggestion should be removed
    const remainingSuggestions = useTranscriptStore.getState().aiSpeakerSuggestions;
    expect(remainingSuggestions.length).toBe(1);
    expect(remainingSuggestions[0].segmentId).toBe("seg2");
  });
});
