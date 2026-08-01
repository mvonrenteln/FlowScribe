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
    expect(logEntry?.requestPayload).toContain("SEGMENTS FOR CONTEXT:");
    expect(logEntry?.requestPayload).toContain('[1] [A] (00:00.0 - 00:01.0): "Hello"');
    expect(logEntry?.responsePayload).toBe(rawResponse);
  });

  it("does not recover suggestions from a failed batch even when the raw response contains parseable JSON", async () => {
    const segments = [
      makeSegment("seg-1", 0, 1, "This is the first"),
      makeSegment("seg-2", 1.1, 2, "part of the sentence"),
    ];
    const validPayload = '[{"segmentIds":[1,2],"confidence":0.85,"reason":"Continuation"}]';

    executeFeatureMock.mockResolvedValue({
      success: false,
      status: "error",
      retryable: true,
      errorSource: "parser",
      data: undefined,
      rawResponse: validPayload,
      error: "Model timeout after retries",
      errorCode: "TIMEOUT",
      metadata: {
        featureId: "segment-merge",
        providerId: "test",
        model: "test",
        durationMs: 5000,
      },
    });

    const result = await analyzeMergeCandidates({
      segments,
      maxTimeGap: 2,
      minConfidence: "low",
      sameSpeakerOnly: true,
      enableSmoothing: false,
      batchSize: 10,
      providerId: "provider-1",
      model: "model-1",
    });

    expect(result.suggestions).toEqual([]);
  });

  it("produces zero suggestions and a nonfatal batch log when the model reports an empty batch", async () => {
    const segments = [makeSegment("seg-1", 0, 1, "Hello"), makeSegment("seg-2", 1.1, 2, "world")];

    executeFeatureMock.mockResolvedValue({
      success: true,
      status: "empty",
      retryable: false,
      data: [],
      rawResponse: '{"status":"empty","retryable":false,"data":[],"error":null}',
      metadata: {
        featureId: "segment-merge",
        providerId: "test",
        model: "test",
        durationMs: 1,
      },
    });

    const onProgress = vi.fn();

    const result = await analyzeMergeCandidates({
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

    expect(result.suggestions).toEqual([]);
    expect(result.issues.some((issue) => issue.level === "error")).toBe(false);

    const logEntry = onProgress.mock.calls[0]?.[0]?.batchLogEntry;
    expect(logEntry?.fatal).toBe(false);
    expect(logEntry?.suggestionCount).toBe(0);
    expect(logEntry?.rawItemCount).toBe(0);
  });

  it("preserves errorSource, retryable, errorCode, and parser diagnostics in the batch issue context", async () => {
    const segments = [makeSegment("seg-1", 0, 1, "Hello"), makeSegment("seg-2", 1.1, 2, "world")];

    executeFeatureMock.mockResolvedValue({
      success: false,
      status: "error",
      retryable: true,
      errorSource: "parser",
      error: "Failed to parse AI response",
      errorCode: "PARSE_ERROR",
      parserFailure: {
        code: "SCHEMA_MISMATCH",
        message: "Structured batch envelope did not match the expected schema",
        diagnostics: [{ path: "data", message: "Expected array", expected: "array", actual: null }],
      },
      metadata: {
        featureId: "segment-merge",
        providerId: "test",
        model: "test",
        durationMs: 10,
      },
    });

    const result = await analyzeMergeCandidates({
      segments,
      maxTimeGap: 2,
      minConfidence: "low",
      sameSpeakerOnly: true,
      enableSmoothing: false,
      batchSize: 10,
      providerId: "provider-1",
      model: "model-1",
    });

    expect(result.suggestions).toEqual([]);
    const errorIssue = result.issues.find((issue) => issue.level === "error");
    expect(errorIssue?.context).toMatchObject({
      errorCode: "PARSE_ERROR",
      errorSource: "parser",
      retryable: true,
      parserFailure: expect.objectContaining({ code: "SCHEMA_MISMATCH" }),
    });
  });
});
