import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PromptVariables } from "@/lib/ai/prompts/types";

let detectChapters: typeof import("../service").detectChapters;
let executeFeatureMock: ReturnType<typeof vi.spyOn>;
let coreModule: typeof import("@/lib/ai/core");

const makeSegment = (id: string, start: number) => ({
  id,
  speaker: "A",
  text: `Segment ${id}`,
  start,
  end: start + 1,
});

describe("chapterDetection service", () => {
  beforeAll(async () => {
    coreModule = await import("@/lib/ai/core");
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
          data: {
            chapters: [{ title: "Intro", summary: "Sum1", start: 1, end: 2 }],
          },
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
        data: {
          chapters: [{ title: "Next", summary: "Sum2", start: 1, end: 1 }],
        },
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
});
