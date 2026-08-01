import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { compileTemplate, extractPlaceholders } from "@/lib/ai/prompts";
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

  it("wraps only the structured response contract in <response_contract>, leaving TASK/CONSTRAINTS headings unwrapped", () => {
    const prompt = chapterDetectionConfig.systemPrompt;

    const openCount = (prompt.match(/<response_contract>/g) ?? []).length;
    const closeCount = (prompt.match(/<\/response_contract>/g) ?? []).length;
    expect(openCount).toBe(1);
    expect(closeCount).toBe(1);

    const taskIndex = prompt.indexOf("TASK\n");
    const constraintsIndex = prompt.indexOf("CONSTRAINTS\n");
    const openIndex = prompt.indexOf("<response_contract>");
    const closeIndex = prompt.indexOf("</response_contract>");
    const outputFormatIndex = prompt.indexOf("OUTPUT FORMAT");

    expect(taskIndex).toBeGreaterThanOrEqual(0);
    expect(constraintsIndex).toBeGreaterThan(taskIndex);
    // TASK/CONSTRAINTS headings sit before the tagged block and are not wrapped.
    expect(openIndex).toBeGreaterThan(constraintsIndex);
    expect(prompt.slice(taskIndex, openIndex)).not.toContain("<response_contract>");
    expect(outputFormatIndex).toBeGreaterThan(openIndex);
    expect(closeIndex).toBeGreaterThan(outputFormatIndex);
  });

  it("keeps batch metadata untagged in the user template", () => {
    const template = chapterDetectionConfig.userPromptTemplate;

    for (const placeholder of ["batchIndex", "totalBatches", "batchSize"]) {
      const idx = template.indexOf(`{{${placeholder}}}`);
      expect(idx).toBeGreaterThanOrEqual(0);
      // No XML tag immediately wraps the batch metadata placeholders.
      expect(template.slice(Math.max(0, idx - 40), idx)).not.toMatch(/<\w+>\s*$/);
    }
  });

  it("wraps tagsAvailable, previousChapter, and segments with the three selected tags exactly once each", () => {
    const template = chapterDetectionConfig.userPromptTemplate;

    for (const tag of ["available_tag_ids", "previous_chapter_context", "transcript_segments"]) {
      const openCount = (template.match(new RegExp(`<${tag}>`, "g")) ?? []).length;
      const closeCount = (template.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
      expect(openCount).toBe(1);
      expect(closeCount).toBe(1);
    }

    expect(template).toContain("<available_tag_ids>\n{{tagsAvailable}}\n</available_tag_ids>");
    expect(template).toContain(
      "<previous_chapter_context>\n{{previousChapter}}\n</previous_chapter_context>",
    );
    expect(template).toContain("<transcript_segments>\n{{segments}}\n</transcript_segments>");
  });

  it("does not render an empty <previous_chapter_context> tag for the first batch (no previous chapter)", () => {
    const compiled = compileTemplate(chapterDetectionConfig.userPromptTemplate, {
      batchIndex: 1,
      totalBatches: 1,
      batchSize: 2,
      minChapterLength: 1,
      maxChapterLength: 10,
      tagsAvailable: "(none)",
      segments: "1 | A | hello",
      previousChapter: "",
    });

    expect(compiled).not.toContain("<previous_chapter_context>");
    expect(compiled).not.toContain("</previous_chapter_context>");
  });

  it("renders the <previous_chapter_context> tag with content once a previous chapter exists", () => {
    const compiled = compileTemplate(chapterDetectionConfig.userPromptTemplate, {
      batchIndex: 2,
      totalBatches: 2,
      batchSize: 2,
      minChapterLength: 1,
      maxChapterLength: 10,
      tagsAvailable: "(none)",
      segments: "1 | A | hello",
      previousChapter: "PREVIOUS CHAPTER CONTEXT\n------------------------\nTitle: Intro\n",
    });

    expect(compiled).toContain("<previous_chapter_context>");
    expect(compiled).toContain("Title: Intro");
    expect(compiled).toContain("</previous_chapter_context>");
  });

  it("keeps all eight placeholders unchanged and the system prompt placeholder-free", () => {
    expect(chapterDetectionConfig.availablePlaceholders).toEqual([
      "batchIndex",
      "totalBatches",
      "batchSize",
      "minChapterLength",
      "maxChapterLength",
      "tagsAvailable",
      "segments",
      "previousChapter",
    ]);
    expect(extractPlaceholders(chapterDetectionConfig.systemPrompt)).toEqual([]);
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

  it("passes tagsAvailable, segments, and previousChapter through as-is for the default prompt path, including across sequential batches", async () => {
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
          data: [{ title: "A & B <title>", summary: "C < D", start: 1, end: 1 }],
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

    const result = await detectChapters({
      segments: [makeSegment("s1", 0), makeSegment("s2", 1)],
      batchSize: 1,
      minChapterLength: 1,
      maxChapterLength: 10,
      tagsAvailable: [{ id: "q&a", label: "Q&A <intro>" }],
      onBatchComplete,
    });

    // Default-prompt path: tagsAvailable/segments reach executeFeature raw.
    expect(variablesSeen[0]?.tagsAvailable).toBe("- q&a: Q&A <intro>");
    expect(variablesSeen[0]?.previousChapter).toBe("");

    // Numeric metadata is unaffected.
    expect(variablesSeen[0]?.batchIndex).toBe(1);
    expect(variablesSeen[0]?.totalBatches).toBe(2);
    expect(variablesSeen[0]?.batchSize).toBe(1);

    // previousChapter is passed through raw when inserted into the next request.
    expect(variablesSeen[1]?.previousChapter).toContain("A & B <title>");
    expect(variablesSeen[1]?.previousChapter).toContain("C < D");

    // Stored chapter results and callbacks stay raw/unchanged, same as the request.
    expect(result.chapters[0]?.title).toBe("A & B <title>");
    expect(result.chapters[0]?.summary).toBe("C < D");
    expect(onBatchComplete.mock.calls[0]?.[1][0]?.title).toBe("A & B <title>");
  });

  it("preserves raw values when a custom system prompt, custom user template, or both are supplied", async () => {
    const variablesSeen: PromptVariables[] = [];
    executeFeatureMock.mockImplementation((_featureId, variables) => {
      variablesSeen.push(variables as PromptVariables);
      return Promise.resolve({
        success: true,
        status: "ok" as const,
        retryable: false,
        data: [{ title: "Chapter", start: 1, end: 1 }],
        rawResponse: "r",
        metadata: {
          featureId: "chapter-detection",
          providerId: "test",
          model: "test",
          durationMs: 1,
        },
      });
    });

    const customCases: Array<{
      name: string;
      customPrompt: { systemPrompt?: string; userPromptTemplate?: string };
    }> = [
      { name: "custom system prompt only", customPrompt: { systemPrompt: "custom system" } },
      {
        name: "custom user template only",
        customPrompt: { userPromptTemplate: "custom user {{segments}}" },
      },
      {
        name: "both custom",
        customPrompt: {
          systemPrompt: "custom system",
          userPromptTemplate: "custom user {{segments}}",
        },
      },
    ];

    for (const { customPrompt } of customCases) {
      variablesSeen.length = 0;
      await detectChapters({
        segments: [makeSegment("s1", 0)],
        batchSize: 10,
        minChapterLength: 1,
        maxChapterLength: 10,
        tagsAvailable: [{ id: "q&a", label: "Q&A <intro>" }],
        customPrompt,
      });

      expect(variablesSeen[0]?.tagsAvailable).toBe("- q&a: Q&A <intro>");
      expect(variablesSeen[0]?.tagsAvailable).not.toContain("&amp;");
    }
  });
});
