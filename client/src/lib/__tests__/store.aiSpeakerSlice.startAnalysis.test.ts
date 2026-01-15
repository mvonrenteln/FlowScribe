import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBaseState } from "@/lib/__tests__/storeTestUtils";
import { classifySpeakersBatch } from "@/lib/ai/features/speaker";
import { useTranscriptStore } from "@/lib/store";
import type { Segment, Speaker } from "@/lib/store/types";

vi.mock("@/lib/ai/features/speaker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/features/speaker")>();
  return {
    ...actual,
    classifySpeakersBatch: vi.fn().mockResolvedValue({
      results: [],
      summary: { total: 0, classified: 0, unchanged: 0, failed: 0 },
      issues: [],
    }),
  };
});

const baseSegments: Segment[] = [
  {
    id: "seg-1",
    speaker: "SPEAKER_00",
    tags: [],
    start: 0,
    end: 1,
    text: "First segment",
    confirmed: false,
    words: [],
  },
  {
    id: "seg-2",
    speaker: "SPEAKER_00",
    tags: [],
    start: 1,
    end: 2,
    text: "Confirmed segment",
    confirmed: true,
    words: [],
  },
  {
    id: "seg-3",
    speaker: "SPEAKER_01",
    tags: [],
    start: 2,
    end: 3,
    text: "Other speaker",
    confirmed: false,
    words: [],
  },
];

const baseSpeakers: Speaker[] = [
  { id: "SPEAKER_00", name: "SPEAKER_00", color: "#000000" },
  { id: "SPEAKER_01", name: "SPEAKER_01", color: "#111111" },
];

describe("aiSpeakerSlice - startAnalysis", () => {
  beforeEach(() => {
    useTranscriptStore.setState({
      ...createBaseState(),
      segments: baseSegments,
      speakers: baseSpeakers,
    });
    vi.clearAllMocks();
  });

  it("uses scoped segment ids when provided", () => {
    useTranscriptStore.getState().startAnalysis([], false, ["seg-1", "seg-3"]);

    expect(useTranscriptStore.getState().aiSpeakerTotalToProcess).toBe(2);
    expect(classifySpeakersBatch).toHaveBeenCalled();
    const mocked = vi.mocked(classifySpeakersBatch);
    const firstCallFirstArg = mocked.mock.calls[0][0] as Segment[];
    expect(firstCallFirstArg.map((s) => s.id)).toEqual(["seg-1", "seg-3"]);
  });

  it("combines segment ids with speaker and confirmed filters", () => {
    useTranscriptStore.getState().startAnalysis(["SPEAKER_00"], true, ["seg-1", "seg-2", "seg-3"]);

    expect(useTranscriptStore.getState().aiSpeakerTotalToProcess).toBe(1);
    expect(classifySpeakersBatch).toHaveBeenCalled();
    const mocked = vi.mocked(classifySpeakersBatch);
    const firstCallFirstArg = mocked.mock.calls[0][0] as Segment[];
    expect(firstCallFirstArg.map((s) => s.id)).toEqual(["seg-1"]);
  });
});
