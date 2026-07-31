/**
 * Speaker Service Tests
 *
 * Tests for the speaker classification service.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as settingsStorage from "@/lib/settings/settingsStorage";
import * as core from "../core";
import { speakerClassificationConfig } from "../features/speaker/config";
import {
  classifySpeakers,
  classifySpeakersBatch,
  parseRawResponse,
} from "../features/speaker/service";
import type { BatchSegment } from "../features/speaker/types";
import { formatSegmentsForPrompt, formatSpeakersForPrompt } from "../features/speaker/utils";
import { escapeXmlText, extractPlaceholders } from "../prompts";
import type { ChatMessage } from "../providers/types";

/**
 * Extracts the substring between the first balanced `<tag>...</tag>` pair,
 * failing loudly (via a thrown assertion-friendly error) if the tag is
 * missing, duplicated, or unbalanced.
 */
function extractTaggedBlock(text: string, tag: string): string {
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  const openCount = text.split(openTag).length - 1;
  const closeCount = text.split(closeTag).length - 1;
  expect(openCount).toBe(1);
  expect(closeCount).toBe(1);

  const openIndex = text.indexOf(openTag);
  const closeIndex = text.indexOf(closeTag);
  expect(openIndex).toBeGreaterThanOrEqual(0);
  expect(closeIndex).toBeGreaterThan(openIndex);

  return text.slice(openIndex + openTag.length, closeIndex);
}

// Queue consumed in FIFO order by the mocked provider, used only by the
// retry-transparency test below (which runs the real executeFeature).
type MockChatResponse = { content: string };
const chatQueue = vi.hoisted(() => [] as Array<MockChatResponse | Error>);
const chatCallCount = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/lib/ai/core/providerResolver", async () => ({
  ...(await vi.importActual("@/lib/ai/core/providerResolver")),
  resolveProvider: vi.fn(async () => ({
    config: { id: "test-provider", model: "test-model" },
    service: {
      chat: async (_messages: ChatMessage[]): Promise<MockChatResponse> => {
        chatCallCount.count++;
        const next = chatQueue.shift();
        if (next === undefined) {
          throw new Error("Test chat queue exhausted");
        }
        if (next instanceof Error) {
          throw next;
        }
        return next;
      },
    },
  })),
}));

describe("Speaker Service", () => {
  // Captured before the spy replaces the export, so the retry-transparency
  // test can delegate to the real implementation instead of the mock.
  const actualExecuteFeature = core.executeFeature;
  const executeFeatureMock = vi.spyOn(core, "executeFeature");

  beforeEach(() => {
    executeFeatureMock.mockReset();
    chatQueue.length = 0;
    chatCallCount.count = 0;
  });

  afterAll(() => {
    executeFeatureMock.mockRestore();
  });

  describe("speakerClassificationConfig", () => {
    it("uses the structured-batch response format", () => {
      expect(speakerClassificationConfig.responseFormat).toBe("structured-batch");
    });

    it("documents concrete ok, empty, and error envelopes and all six model error codes", () => {
      const prompt = speakerClassificationConfig.systemPrompt;

      expect(prompt).toContain('"status": "ok"');
      expect(prompt).toContain('"status": "empty"');
      expect(prompt).toContain('"status": "error"');

      for (const code of [
        "MISSING_REQUIRED_INPUT",
        "INVALID_INPUT_SHAPE",
        "CONTRADICTORY_INPUT",
        "UNSUPPORTED_TASK",
        "OUTPUT_TRUNCATED",
        "TEMPORARY_FAILURE",
      ]) {
        expect(prompt).toContain(code);
      }
    });

    it("wraps the response contract and recognition rules in exactly one balanced tag pair each", () => {
      const prompt = speakerClassificationConfig.systemPrompt;

      const contractBlock = extractTaggedBlock(prompt, "response_contract");
      const rulesBlock = extractTaggedBlock(prompt, "speaker_recognition_rules");

      expect(contractBlock.length).toBeGreaterThan(0);
      expect(rulesBlock.length).toBeGreaterThan(0);
    });

    it("keeps every envelope field/state, all six error codes, and retryability inside the response contract", () => {
      const contractBlock = extractTaggedBlock(
        speakerClassificationConfig.systemPrompt,
        "response_contract",
      );

      expect(contractBlock).toContain('"status": "ok"');
      expect(contractBlock).toContain('"status": "empty"');
      expect(contractBlock).toContain('"status": "error"');
      expect(contractBlock).toContain('"retryable": false');
      expect(contractBlock).toContain('"retryable": true');
      expect(contractBlock).toContain('"data"');
      expect(contractBlock).toContain('"error"');

      for (const code of [
        "MISSING_REQUIRED_INPUT",
        "INVALID_INPUT_SHAPE",
        "CONTRADICTORY_INPUT",
        "UNSUPPORTED_TASK",
        "OUTPUT_TRUNCATED",
        "TEMPORARY_FAILURE",
      ]) {
        expect(contractBlock).toContain(code);
      }
    });

    it("keeps the recognition heuristics, humor guidance, and decision steps inside the tagged rules block", () => {
      const rulesBlock = extractTaggedBlock(
        speakerClassificationConfig.systemPrompt,
        "speaker_recognition_rules",
      );

      expect(rulesBlock).toContain("HEURISTICS FOR SPEAKER RECOGNITION");
      expect(rulesBlock).toContain("IMPORTANT NOTE ON HUMOR");
      expect(rulesBlock).toContain("DECISION STEPS FOR EACH SECTION");
      expect(rulesBlock).toContain("[Unknown?]");
    });

    it("keeps the short TASK prose untagged before the first XML tag", () => {
      const prompt = speakerClassificationConfig.systemPrompt;
      const firstTagIndex = prompt.indexOf("<response_contract>");

      expect(firstTagIndex).toBeGreaterThan(0);
      expect(prompt.slice(0, firstTagIndex)).toContain("TASK");
      expect(prompt.slice(0, firstTagIndex)).not.toContain("<");
    });

    it("wraps only the dynamic bodies of the user template in available_speakers and sections_to_classify", () => {
      const template = speakerClassificationConfig.userPromptTemplate;

      const speakersBlock = extractTaggedBlock(template, "available_speakers");
      const sectionsBlock = extractTaggedBlock(template, "sections_to_classify");

      expect(speakersBlock).toContain("{{speakers}}");
      expect(sectionsBlock).toContain("{{segments}}");
      expect(template).toContain("AVAILABLE SPEAKERS");
      expect(template).toContain("SECTIONS TO CLASSIFY");

      const speakersHeadingIndex = template.indexOf("AVAILABLE SPEAKERS");
      const speakersTagIndex = template.indexOf("<available_speakers>");
      expect(speakersHeadingIndex).toBeLessThan(speakersTagIndex);
    });

    it("keeps placeholders exactly speakers and segments in the user template, with none in the system prompt", () => {
      expect(extractPlaceholders(speakerClassificationConfig.systemPrompt)).toEqual([]);
      expect(extractPlaceholders(speakerClassificationConfig.userPromptTemplate)).toEqual([
        "speakers",
        "segments",
      ]);
    });
  });

  describe("classifySpeakers", () => {
    it("should throw when executeFeature fails", async () => {
      executeFeatureMock.mockResolvedValueOnce({
        success: false,
        error: "Timeout",
        metadata: {
          featureId: "speaker-classification",
          providerId: "test",
          model: "llama3.2",
          durationMs: 10,
        },
      });

      await expect(
        classifySpeakers([{ id: "1", speaker: "[Unknown]", text: "Hello there!" }], ["Alice"]),
      ).rejects.toThrow("Timeout");
    });

    it("escapes default speaker/segment values exactly once before they reach executeFeature", async () => {
      executeFeatureMock.mockResolvedValueOnce({
        success: true,
        data: [],
        metadata: {
          featureId: "speaker-classification",
          providerId: "test",
          model: "llama3.2",
          durationMs: 10,
        },
      });

      const segments = [{ id: "1", speaker: "[Unknown]", text: 'Rule: "A" & <B> > C' }];
      const speakers = ['Alice & "Bob"', "<GM>"];

      await classifySpeakers(segments, speakers);

      const expectedSegments = escapeXmlText(formatSegmentsForPrompt(segments));
      const expectedSpeakers = escapeXmlText(formatSpeakersForPrompt(speakers));

      expect(executeFeatureMock).toHaveBeenCalledWith(
        "speaker-classification",
        { segments: expectedSegments, speakers: expectedSpeakers },
        expect.anything(),
      );

      // Idempotency guard: escaping the already-escaped call arguments again
      // must not change them, proving they were escaped exactly once.
      const [, calledVariables] = executeFeatureMock.mock.calls[0];
      expect(escapeXmlText(calledVariables.segments as string)).toBe(calledVariables.segments);
      expect(escapeXmlText(calledVariables.speakers as string)).toBe(calledVariables.speakers);
    });

    it("passes raw, unescaped values when a custom system prompt is supplied", async () => {
      executeFeatureMock.mockResolvedValueOnce({
        success: true,
        data: [],
        metadata: {
          featureId: "speaker-classification",
          providerId: "test",
          model: "llama3.2",
          durationMs: 10,
        },
      });

      const segments = [{ id: "1", speaker: "[Unknown]", text: 'Rule: "A" & <B> > C' }];
      const speakers = ['Alice & "Bob"', "<GM>"];

      await classifySpeakers(segments, speakers, {
        customPrompt: { systemPrompt: "Custom system prompt" },
      });

      expect(executeFeatureMock).toHaveBeenCalledWith(
        "speaker-classification",
        {
          segments: formatSegmentsForPrompt(segments),
          speakers: formatSpeakersForPrompt(speakers),
        },
        expect.anything(),
      );
    });

    it("passes raw, unescaped values when a custom user prompt template is supplied", async () => {
      executeFeatureMock.mockResolvedValueOnce({
        success: true,
        data: [],
        metadata: {
          featureId: "speaker-classification",
          providerId: "test",
          model: "llama3.2",
          durationMs: 10,
        },
      });

      const segments = [{ id: "1", speaker: "[Unknown]", text: 'Rule: "A" & <B> > C' }];
      const speakers = ['Alice & "Bob"', "<GM>"];

      await classifySpeakers(segments, speakers, {
        customPrompt: { userPromptTemplate: "{{speakers}} {{segments}}" },
      });

      expect(executeFeatureMock).toHaveBeenCalledWith(
        "speaker-classification",
        {
          segments: formatSegmentsForPrompt(segments),
          speakers: formatSpeakersForPrompt(speakers),
        },
        expect.anything(),
      );
    });

    it("passes raw, unescaped values when both a custom system prompt and user prompt template are supplied", async () => {
      executeFeatureMock.mockResolvedValueOnce({
        success: true,
        data: [],
        metadata: {
          featureId: "speaker-classification",
          providerId: "test",
          model: "llama3.2",
          durationMs: 10,
        },
      });

      const segments = [{ id: "1", speaker: "[Unknown]", text: 'Rule: "A" & <B> > C' }];
      const speakers = ['Alice & "Bob"', "<GM>"];

      await classifySpeakers(segments, speakers, {
        customPrompt: {
          systemPrompt: "Custom system prompt",
          userPromptTemplate: "{{speakers}} {{segments}}",
        },
      });

      expect(executeFeatureMock).toHaveBeenCalledWith(
        "speaker-classification",
        {
          segments: formatSegmentsForPrompt(segments),
          speakers: formatSpeakersForPrompt(speakers),
        },
        expect.anything(),
      );
    });

    it("returns no suggestions when the model reports an empty batch, without throwing", async () => {
      executeFeatureMock.mockResolvedValueOnce({
        success: true,
        status: "empty",
        retryable: false,
        data: [],
        metadata: {
          featureId: "speaker-classification",
          providerId: "test",
          model: "llama3.2",
          durationMs: 10,
        },
      });

      const results = await classifySpeakers(
        [{ id: "1", speaker: "[Unknown]", text: "Hello there!" }],
        ["Alice"],
      );

      expect(results).toEqual([]);
    });

    it("preserves errorSource, retryable, and parser diagnostics when the model reports a structured failure", async () => {
      executeFeatureMock.mockResolvedValueOnce({
        success: false,
        status: "error",
        retryable: false,
        errorSource: "model",
        error: "Input segments were contradictory",
        errorCode: "CONTRADICTORY_INPUT",
        metadata: {
          featureId: "speaker-classification",
          providerId: "test",
          model: "llama3.2",
          durationMs: 10,
        },
      });

      await expect(
        classifySpeakers([{ id: "1", speaker: "[Unknown]", text: "Hello there!" }], ["Alice"]),
      ).rejects.toMatchObject({
        message: "Input segments were contradictory",
        code: "CONTRADICTORY_INPUT",
        details: expect.objectContaining({
          errorSource: "model",
          retryable: false,
        }),
      });
    });

    it("preserves parser failure diagnostics when structured-batch parsing fails after retries", async () => {
      executeFeatureMock.mockResolvedValueOnce({
        success: false,
        status: "error",
        retryable: true,
        errorSource: "parser",
        error: "Failed to parse AI response",
        errorCode: "PARSE_ERROR",
        parserFailure: {
          code: "SCHEMA_MISMATCH",
          message: "Structured batch envelope did not match the expected schema",
          diagnostics: [
            { path: "data", message: "Expected array", expected: "array", actual: null },
          ],
        },
        metadata: {
          featureId: "speaker-classification",
          providerId: "test",
          model: "llama3.2",
          durationMs: 10,
        },
      });

      await expect(
        classifySpeakers([{ id: "1", speaker: "[Unknown]", text: "Hello there!" }], ["Alice"]),
      ).rejects.toMatchObject({
        code: "PARSE_ERROR",
        details: expect.objectContaining({
          errorSource: "parser",
          retryable: true,
          parserFailure: expect.objectContaining({ code: "SCHEMA_MISMATCH" }),
        }),
      });
    });

    it("transparently retries a transient model error via the real executeFeature retry loop", async () => {
      executeFeatureMock.mockImplementation(actualExecuteFeature);

      chatQueue.push({
        content: JSON.stringify({
          status: "error",
          retryable: true,
          data: [],
          error: { code: "TEMPORARY_FAILURE", message: "Model overloaded, try again" },
        }),
      });
      chatQueue.push({
        content: JSON.stringify({
          status: "ok",
          retryable: false,
          data: [{ tag: "Alice", confidence: 0.9, reason: "Greeting style" }],
          error: null,
        }),
      });

      const results = await classifySpeakers(
        [{ id: "1", speaker: "[Unknown]", text: "Hello there!" }],
        ["Alice"],
      );

      expect(results).toEqual([
        expect.objectContaining({ segmentId: "1", suggestedSpeaker: "Alice" }),
      ]);
      expect(chatCallCount.count).toBe(2);
    });
  });

  describe("classifySpeakersBatch", () => {
    it("emits batch completion and progress in order under concurrent execution", async () => {
      vi.useFakeTimers();

      const settingsSpy = vi.spyOn(settingsStorage, "initializeSettings").mockReturnValue({
        ...settingsStorage.DEFAULT_SETTINGS,
        enableConcurrentRequests: true,
        maxConcurrentRequests: 2,
      });

      try {
        let callIndex = 0;
        executeFeatureMock.mockImplementation(() => {
          const delay = callIndex === 0 ? 30 : callIndex === 1 ? 10 : 0;
          callIndex += 1;
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  data: [{ tag: "Alice", confidence: 0.9 }],
                  metadata: {
                    featureId: "speaker-classification",
                    providerId: "test",
                    model: "llama3.2",
                    durationMs: delay,
                  },
                }),
              delay,
            ),
          );
        });

        const batchOrder: string[] = [];
        const progress: number[] = [];

        const promise = classifySpeakersBatch(
          [
            { id: "1", speaker: "[Unknown]", text: "Hello" },
            { id: "2", speaker: "[Unknown]", text: "World" },
            { id: "3", speaker: "[Unknown]", text: "Again" },
          ],
          ["Alice", "Bob"],
          {
            batchSize: 1,
            onBatchComplete: (results) =>
              batchOrder.push(results.map((r) => r.segmentId).join(",")),
            onProgress: (processed) => progress.push(processed),
          },
        );

        await vi.runAllTimersAsync();
        await promise;

        expect(batchOrder).toEqual(["1", "2", "3"]);
        expect(progress).toEqual([1, 2, 3]);
      } finally {
        settingsSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it("records failed batches and unchanged assignments", async () => {
      const settingsSpy = vi.spyOn(settingsStorage, "initializeSettings").mockReturnValue({
        ...settingsStorage.DEFAULT_SETTINGS,
        enableConcurrentRequests: false,
        maxConcurrentRequests: 1,
      });

      try {
        executeFeatureMock
          .mockResolvedValueOnce({
            success: true,
            data: [{ tag: "Alice", confidence: 0.9 }],
            metadata: {
              featureId: "speaker-classification",
              providerId: "test",
              model: "llama3.2",
              durationMs: 1,
            },
          })
          .mockResolvedValueOnce({
            success: false,
            error: "Timeout",
            metadata: {
              featureId: "speaker-classification",
              providerId: "test",
              model: "llama3.2",
              durationMs: 1,
            },
          })
          .mockResolvedValueOnce({
            success: true,
            data: [{ tag: "Alice", confidence: 0.9 }],
            metadata: {
              featureId: "speaker-classification",
              providerId: "test",
              model: "llama3.2",
              durationMs: 1,
            },
          });

        const batchResults = await classifySpeakersBatch(
          [
            { id: "1", speaker: "[Unknown]", text: "Hello" },
            { id: "2", speaker: "[Unknown]", text: "World" },
            { id: "3", speaker: "Alice", text: "Again" },
          ],
          ["Alice", "Bob"],
          { batchSize: 1 },
        );

        expect(batchResults.summary).toEqual({
          total: 3,
          classified: 1,
          unchanged: 1,
          failed: 1,
        });
        expect(batchResults.issues.some((issue) => issue.level === "error")).toBe(true);
      } finally {
        settingsSpy.mockRestore();
      }
    });

    it("counts an empty-status batch as unchanged, not failed", async () => {
      const settingsSpy = vi.spyOn(settingsStorage, "initializeSettings").mockReturnValue({
        ...settingsStorage.DEFAULT_SETTINGS,
        enableConcurrentRequests: false,
        maxConcurrentRequests: 1,
      });

      try {
        executeFeatureMock.mockResolvedValueOnce({
          success: true,
          status: "empty",
          retryable: false,
          data: [],
          metadata: {
            featureId: "speaker-classification",
            providerId: "test",
            model: "llama3.2",
            durationMs: 1,
          },
        });

        const batchResults = await classifySpeakersBatch(
          [{ id: "1", speaker: "[Unknown]", text: "Hello" }],
          ["Alice", "Bob"],
          { batchSize: 1 },
        );

        expect(batchResults.summary).toEqual({
          total: 1,
          classified: 0,
          unchanged: 1,
          failed: 0,
        });
        expect(batchResults.issues.some((issue) => issue.level === "error")).toBe(false);
      } finally {
        settingsSpy.mockRestore();
      }
    });

    it("preserves errorSource, retryable, and parser diagnostics in the batch issue context", async () => {
      const settingsSpy = vi.spyOn(settingsStorage, "initializeSettings").mockReturnValue({
        ...settingsStorage.DEFAULT_SETTINGS,
        enableConcurrentRequests: false,
        maxConcurrentRequests: 1,
      });

      try {
        executeFeatureMock.mockResolvedValueOnce({
          success: false,
          status: "error",
          retryable: true,
          errorSource: "parser",
          error: "Failed to parse AI response",
          errorCode: "PARSE_ERROR",
          parserFailure: {
            code: "SCHEMA_MISMATCH",
            message: "Structured batch envelope did not match the expected schema",
            diagnostics: [],
          },
          metadata: {
            featureId: "speaker-classification",
            providerId: "test",
            model: "llama3.2",
            durationMs: 1,
          },
        });

        const batchResults = await classifySpeakersBatch(
          [{ id: "1", speaker: "[Unknown]", text: "Hello" }],
          ["Alice", "Bob"],
          { batchSize: 1 },
        );

        expect(batchResults.summary.failed).toBe(1);
        const errorIssue = batchResults.issues.find((issue) => issue.level === "error");
        expect(errorIssue?.context).toMatchObject({
          errorSource: "parser",
          retryable: true,
          parserFailure: expect.objectContaining({ code: "SCHEMA_MISMATCH" }),
        });
      } finally {
        settingsSpy.mockRestore();
      }
    });
  });

  describe("parseRawResponse", () => {
    const defaultSegments: BatchSegment[] = [
      { segmentId: "1", speaker: "[Unknown]", text: "Hello there!" },
      { segmentId: "2", speaker: "[Unknown]", text: "How are you?" },
    ];

    const availableSpeakers = ["Alice", "Bob", "[SL]", "[OOC]"];
    const currentSpeakers = new Map([
      ["1", "[Unknown]"],
      ["2", "[Unknown]"],
    ]);

    it("should parse valid JSON array response", () => {
      const rawResponse = `[
        {"tag": "Alice", "confidence": 0.95, "reason": "Greeting style"},
        {"tag": "Bob", "confidence": 0.8, "reason": "Question"}
      ]`;

      const result = parseRawResponse(
        rawResponse,
        defaultSegments,
        availableSpeakers,
        currentSpeakers,
      );

      expect(result.fatal).toBe(false);
      expect(result.suggestions.length).toBe(2);
      expect(result.suggestions[0].suggestedSpeaker).toBe("Alice");
      expect(result.suggestions[0].confidence).toBe(0.95);
      expect(result.suggestions[1].suggestedSpeaker).toBe("Bob");
    });

    it("should handle response with markdown code blocks", () => {
      const rawResponse = '```json\n[{"tag": "Alice", "confidence": 0.9}]\n```';

      const result = parseRawResponse(
        rawResponse,
        [defaultSegments[0]],
        availableSpeakers,
        new Map([["1", "[Unknown]"]]),
      );

      expect(result.fatal).toBe(false);
      expect(result.suggestions.length).toBe(1);
      expect(result.suggestions[0].suggestedSpeaker).toBe("Alice");
    });

    it("should fallback to regex for malformed JSON", () => {
      // Multiple JSON objects without array wrapper
      const rawResponse = `{"tag": "Alice", "confidence": 0.8}`;

      const result = parseRawResponse(
        rawResponse,
        [defaultSegments[0]], // Only 1 segment
        availableSpeakers,
        new Map([["1", "[Unknown]"]]),
      );

      expect(result.fatal).toBe(false);
      expect(result.suggestions.length).toBe(1);
      expect(result.suggestions[0].suggestedSpeaker).toBe("Alice");
    });

    it("should return fatal error for empty response", () => {
      const result = parseRawResponse("", defaultSegments, availableSpeakers, currentSpeakers);

      expect(result.fatal).toBe(true);
      expect(result.suggestions.length).toBe(0);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("should handle missing entries with warnings", () => {
      const rawResponse = `[{"tag": "Alice"}]`;

      const result = parseRawResponse(
        rawResponse,
        defaultSegments, // 2 segments
        availableSpeakers,
        currentSpeakers,
      );

      expect(result.fatal).toBe(false);
      expect(result.suggestions.length).toBe(1);
      expect(result.issues.some((i) => i.level === "warn")).toBe(true);
    });

    it("should warn about extra entries", () => {
      const rawResponse = `[
        {"tag": "Alice"},
        {"tag": "Bob"},
        {"tag": "Extra"}
      ]`;

      const result = parseRawResponse(
        rawResponse,
        defaultSegments, // Only 2 segments
        availableSpeakers,
        currentSpeakers,
      );

      expect(result.ignoredCount).toBe(1);
      expect(result.issues.some((i) => i.message.includes("extra"))).toBe(true);
    });

    it("should resolve speaker tags to available speakers", () => {
      const rawResponse = `[{"tag": "alice", "confidence": 0.9}]`;

      const result = parseRawResponse(
        rawResponse,
        [defaultSegments[0]],
        availableSpeakers,
        new Map([["1", "[Unknown]"]]),
      );

      expect(result.suggestions[0].suggestedSpeaker).toBe("Alice");
      expect(result.suggestions[0].isNew).toBe(false);
    });

    it("should mark new speakers", () => {
      const rawResponse = `[{"tag": "Charlie", "confidence": 0.9}]`;

      const result = parseRawResponse(
        rawResponse,
        [defaultSegments[0]],
        availableSpeakers,
        new Map([["1", "[Unknown]"]]),
      );

      expect(result.suggestions[0].suggestedSpeaker).toBe("Charlie");
      expect(result.suggestions[0].isNew).toBe(true);
    });

    it("should skip unchanged assignments", () => {
      const rawResponse = `[{"tag": "Alice"}]`;
      const segments: BatchSegment[] = [{ segmentId: "1", speaker: "Alice", text: "Hello" }];

      const result = parseRawResponse(
        rawResponse,
        segments,
        availableSpeakers,
        new Map([["1", "Alice"]]),
      );

      expect(result.suggestions.length).toBe(0);
      expect(result.unchangedAssignments).toBe(1);
    });

    it("should normalize confidence to 0-1 range", () => {
      const rawResponse = `[{"tag": "Alice", "confidence": 1.5}]`;

      const result = parseRawResponse(
        rawResponse,
        [defaultSegments[0]],
        availableSpeakers,
        currentSpeakers,
      );

      expect(result.suggestions[0].confidence).toBeLessThanOrEqual(1);
    });

    it("should handle missing confidence", () => {
      const rawResponse = `[{"tag": "Alice"}]`;

      const result = parseRawResponse(
        rawResponse,
        [defaultSegments[0]],
        availableSpeakers,
        currentSpeakers,
      );

      expect(result.suggestions[0].confidence).toBeDefined();
      expect(result.suggestions[0].confidence).toBeGreaterThanOrEqual(0);
    });

    it("should include reason if provided", () => {
      const rawResponse = `[{"tag": "Alice", "reason": "Friendly greeting"}]`;

      const result = parseRawResponse(
        rawResponse,
        [defaultSegments[0]],
        availableSpeakers,
        currentSpeakers,
      );

      expect(result.suggestions[0].reason).toBe("Friendly greeting");
    });

    it("should handle empty tag with warning", () => {
      const rawResponse = `[{"tag": "", "confidence": 0.9}]`;

      const result = parseRawResponse(
        rawResponse,
        [defaultSegments[0]],
        availableSpeakers,
        currentSpeakers,
      );

      expect(result.suggestions.length).toBe(0);
      expect(
        result.issues.some((i) => i.message.includes("Missing") || i.message.includes("Empty")),
      ).toBe(true);
    });

    it("should clean up brackets from tags", () => {
      const rawResponse = `[{"tag": "[Alice]"}]`;

      const result = parseRawResponse(
        rawResponse,
        [defaultSegments[0]],
        availableSpeakers,
        currentSpeakers,
      );

      expect(result.suggestions[0].suggestedSpeaker).toBe("Alice");
    });
  });
});
