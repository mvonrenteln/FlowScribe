import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PromptVariables } from "@/lib/ai/prompts/types";
import { chapterDetectionConfig } from "../config";

let detectChapters: typeof import("../service").detectChapters;
let executeFeatureMock: ReturnType<typeof vi.spyOn>;
let coreModule: typeof import("../../../core");

const makeSegment = (id: string, start: number) => ({
  id,
  speaker: "A",
  text: `Segment ${id}`,
  start,
  end: start + 1,
});

describe("chapterDetectionConfig", () => {
  it("opts into the structured-batch outcome contract", () => {
    expect(chapterDetectionConfig.responseFormat).toBe("structured-batch");
  });

  it("declares an array item response schema", () => {
    expect(chapterDetectionConfig.responseSchema?.type).toBe("array");
    expect(chapterDetectionConfig.responseSchema?.items?.type).toBe("object");
    expect(chapterDetectionConfig.responseSchema?.items?.required).toEqual(
      expect.arrayContaining(["title", "start", "end"]),
    );
  });

  it("documents concrete ok/empty/error envelopes with chapter items in ok.data", () => {
    const prompt = chapterDetectionConfig.systemPrompt;

    expect(prompt).toContain('"status": "ok"');
    expect(prompt).toContain('"data": [');
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"status": "empty"');
    expect(prompt).toContain('"data": []');
    expect(prompt).toContain('"status": "error"');
  });
});

describe("chapterDetection service", () => {
  beforeAll(async () => {
    coreModule = await import("../../../core");
    ({ detectChapters } = await import("../service"));
  });

  beforeEach(() => {
    executeFeatureMock = vi.spyOn(coreModule, "executeFeature");
    executeFeatureMock.mockReset();
  });

  afterEach(() => {
    executeFeatureMock.mockRestore();
  });

  it("runs batches sequentially and threads previous chapter context", async () => {
    const variablesSeen: PromptVariables[] = [];
    let callIndex = 0;
    executeFeatureMock.mockImplementation((_featureId, variables) => {
      variablesSeen.push(variables as PromptVariables);
      callIndex += 1;
      if (callIndex === 1) {
        return Promise.resolve({
          success: true,
          status: "ok" as const,
          retryable: false,
          data: [{ title: "Intro", summary: "Sum1", start: 1, end: 2 }],
          rawResponse: "first",
          metadata: {
            featureId: "chapter-detection",
            providerId: "test",
            model: "test",
            durationMs: 1,
          },
        });
      }
      return Promise.resolve({
        success: true,
        status: "ok" as const,
        retryable: false,
        data: [{ title: "Next", summary: "Sum2", start: 1, end: 1 }],
        rawResponse: "second",
        metadata: {
          featureId: "chapter-detection",
          providerId: "test",
          model: "test",
          durationMs: 1,
        },
      });
    });

    const onBatchComplete = vi.fn();
    const onProgress = vi.fn();

    const detectPromise = detectChapters({
      segments: [makeSegment("s1", 0), makeSegment("s2", 1), makeSegment("s3", 2)],
      batchSize: 2,
      minChapterLength: 1,
      maxChapterLength: 10,
      tagsAvailable: [],
      onBatchComplete,
      onProgress,
    });

    const result = await detectPromise;

    expect(executeFeatureMock).toHaveBeenCalledTimes(2);
    expect(variablesSeen[0]?.previousChapter).toBe("");
    expect(variablesSeen[1]?.previousChapter).toContain("Intro");
    expect(variablesSeen[1]?.previousChapter).toContain("Sum1");
    expect(onBatchComplete).toHaveBeenCalledTimes(2);
    expect(onProgress.mock.calls.map((call) => call[0])).toEqual([1, 2]);
    expect(result.chapters[0]?.startSegmentId).toBe("s1");
    expect(result.chapters[0]?.endSegmentId).toBe("s2");
    expect(result.chapters[1]?.startSegmentId).toBe("s3");
  });

  it("advances progress, completes with an empty batch, and stays nonfatal when the model reports no chapters", async () => {
    executeFeatureMock.mockResolvedValue({
      success: true,
      status: "empty" as const,
      retryable: false,
      data: [],
      rawResponse: '{"status":"empty","retryable":false,"data":[],"error":null}',
      metadata: {
        featureId: "chapter-detection",
        providerId: "test",
        model: "test",
        durationMs: 1,
      },
    });

    const onBatchComplete = vi.fn();
    const onProgress = vi.fn();
    const onBatchLog = vi.fn();

    const result = await detectChapters({
      segments: [makeSegment("s1", 0), makeSegment("s2", 1)],
      batchSize: 10,
      minChapterLength: 1,
      maxChapterLength: 10,
      tagsAvailable: [],
      onBatchComplete,
      onProgress,
      onBatchLog,
    });

    expect(result.chapters).toEqual([]);
    expect(result.issues.some((issue) => issue.level === "error")).toBe(false);
    expect(onBatchComplete).toHaveBeenCalledWith(0, []);
    expect(onProgress).toHaveBeenCalledWith(1, 1);

    const logEntry = onBatchLog.mock.calls[0]?.[0];
    expect(logEntry?.fatal).toBe(false);
    expect(logEntry?.rawItemCount).toBe(0);
    expect(logEntry?.suggestionCount).toBe(0);
  });

  it("does not update the previous-chapter context after an empty batch", async () => {
    const variablesSeen: PromptVariables[] = [];
    let callIndex = 0;
    executeFeatureMock.mockImplementation((_featureId, variables) => {
      variablesSeen.push(variables as PromptVariables);
      callIndex += 1;
      if (callIndex === 1) {
        return Promise.resolve({
          success: true,
          status: "ok" as const,
          retryable: false,
          data: [{ title: "Intro", summary: "Sum1", start: 1, end: 1 }],
          rawResponse: "first",
          metadata: {
            featureId: "chapter-detection",
            providerId: "test",
            model: "test",
            durationMs: 1,
          },
        });
      }
      return Promise.resolve({
        success: true,
        status: "empty" as const,
        retryable: false,
        data: [],
        rawResponse: '{"status":"empty","retryable":false,"data":[],"error":null}',
        metadata: {
          featureId: "chapter-detection",
          providerId: "test",
          model: "test",
          durationMs: 1,
        },
      });
    });

    await detectChapters({
      segments: [makeSegment("s1", 0), makeSegment("s2", 1), makeSegment("s3", 2)],
      batchSize: 1,
      minChapterLength: 1,
      maxChapterLength: 10,
      tagsAvailable: [],
    });

    expect(variablesSeen[2]?.previousChapter).toContain("Intro");
    expect(variablesSeen[2]?.previousChapter).toContain("Sum1");
  });

  it("keeps model/parser failures fatal and preserves structured error context", async () => {
    executeFeatureMock.mockResolvedValue({
      success: false,
      status: "error" as const,
      retryable: true,
      errorSource: "parser" as const,
      error: "Failed to parse AI response",
      errorCode: "PARSE_ERROR",
      parserFailure: {
        code: "SCHEMA_MISMATCH",
        message: "Structured batch envelope did not match the expected schema",
        diagnostics: [{ path: "data", message: "Expected array", expected: "array", actual: null }],
      },
      rawResponse: "not json",
      metadata: {
        featureId: "chapter-detection",
        providerId: "test",
        model: "test",
        durationMs: 5,
      },
    });

    const onBatchLog = vi.fn();

    const result = await detectChapters({
      segments: [makeSegment("s1", 0), makeSegment("s2", 1)],
      batchSize: 10,
      minChapterLength: 1,
      maxChapterLength: 10,
      tagsAvailable: [],
      onBatchLog,
    });

    expect(result.chapters).toEqual([]);
    const errorIssue = result.issues.find((issue) => issue.level === "error");
    expect(errorIssue?.context).toMatchObject({
      errorCode: "PARSE_ERROR",
      errorSource: "parser",
      retryable: true,
      parserFailure: expect.objectContaining({ code: "SCHEMA_MISMATCH" }),
    });

    const logEntry = onBatchLog.mock.calls[0]?.[0];
    expect(logEntry?.fatal).toBe(true);
  });
});
