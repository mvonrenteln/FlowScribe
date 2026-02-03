import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeFeature } from "@/lib/ai";
import { analyzeMergeCandidates } from "../service";
import type { MergeAnalysisSegment } from "../types";

vi.mock("@/lib/ai", () => ({
  executeFeature: vi.fn(),
}));

const executeFeatureMock = vi.mocked(executeFeature);

function makeSegment(
  id: string,
  start: number,
  end: number,
  text: string,
  speaker = "A",
): MergeAnalysisSegment {
  return { id, start, end, text, speaker };
}

describe("segmentMerge service", () => {
  beforeEach(() => {
    executeFeatureMock.mockReset();
  });

  it("captures request and response payloads for batch logs", async () => {
    const segments = [makeSegment("seg-1", 0, 1, "Hello"), makeSegment("seg-2", 1.1, 2, "world")];
    const rawResponse = '[{"segmentIds":[1,2],"confidence":0.9,"reason":"Continuation"}]';

    executeFeatureMock.mockResolvedValue({
      success: true,
      data: [{ segmentIds: [1, 2], confidence: 0.9, reason: "Continuation" }],
      rawResponse,
      metadata: {
        featureId: "segment-merge",
        providerId: "test",
        model: "test",
        durationMs: 1,
      },
    });

    const onProgress = vi.fn();

    await analyzeMergeCandidates({
      segments,
      maxTimeGap: 2,
      minConfidence: "low",
      sameSpeakerOnly: true,
      enableSmoothing: false,
      batchSize: 10,
      providerId: "provider-1",
      model: "model-1",
      onProgress,
    });

    expect(executeFeatureMock).toHaveBeenCalledWith(
      "segment-merge",
      expect.any(Object),
      expect.objectContaining({
        providerId: "provider-1",
        model: "model-1",
      }),
    );
    expect(onProgress).toHaveBeenCalled();
    const progress = onProgress.mock.calls[0]?.[0];
    const logEntry = progress?.batchLogEntry;
    expect(logEntry?.requestPayload).toContain("SYSTEM");
    expect(logEntry?.requestPayload).toContain("SEGMENT PAIRS TO ANALYZE:");
    expect(logEntry?.requestPayload).toContain("Segment A [1]");
    expect(logEntry?.responsePayload).toBe(rawResponse);
  });
});
