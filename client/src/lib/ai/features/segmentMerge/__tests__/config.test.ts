/**
 * Segment Merge Config Tests
 *
 * Tests for configuration, prompts, and response schema.
 */

import { describe, expect, it } from "vitest";
import {
  getMergeSystemPrompt,
  getMergeUserTemplate,
  mergeResponseSchema,
  segmentMergeConfig,
} from "../config";

describe("segmentMergeConfig - structural checks", () => {
  it("has correct feature ID and category", () => {
    expect(segmentMergeConfig.id).toBe("segment-merge");
    expect(segmentMergeConfig.category).toBe("structural");
  });

  it("is batchable and requires confirmation", () => {
    expect(segmentMergeConfig.batchable).toBe(true);
    expect(segmentMergeConfig.requiresConfirmation).toBe(true);
  });

  it("has a response schema and placeholders", () => {
    expect(segmentMergeConfig.responseSchema).toBeDefined();
    expect(segmentMergeConfig.availablePlaceholders).toContain("segments");
  });

  it("uses the structured-batch response format", () => {
    expect(segmentMergeConfig.responseFormat).toBe("structured-batch");
  });

  it("documents concrete ok, empty, and error envelopes and all six model error codes", () => {
    const prompt = segmentMergeConfig.systemPrompt;

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

  it("instructs no-merge results via the empty envelope, not a raw top-level array", () => {
    const prompt = segmentMergeConfig.systemPrompt;

    expect(prompt).not.toContain("return an empty array: []");
    expect(prompt).not.toContain("Return a JSON array of merge suggestions");
  });
});

describe("prompt helper functions", () => {
  it("returns system prompt and user template variants", () => {
    expect(getMergeSystemPrompt()).toBeDefined();
    expect(getMergeUserTemplate(5)).toBeDefined();
    expect(getMergeUserTemplate(100)).toBeDefined();
  });

  it("preserves incomplete boundary fragments in system prompt", () => {
    const systemPrompt = getMergeSystemPrompt();
    const simpleTemplate = getMergeUserTemplate(5);
    const fullTemplate = getMergeUserTemplate(50);

    expect(systemPrompt).toContain(
      "NEVER delete an incomplete sentence at the beginning of the first segment",
    );
    expect(systemPrompt).toContain(
      "NEVER delete an incomplete sentence at the end of the second segment",
    );
    expect(simpleTemplate).not.toContain("incomplete sentence");
    expect(fullTemplate).not.toContain("incomplete sentence");
  });

  it("references segments for context", () => {
    const simpleTemplate = getMergeUserTemplate(5);
    const fullTemplate = getMergeUserTemplate(50);

    expect(simpleTemplate).toContain("{{segments}}");
    expect(fullTemplate).toContain("{{segments}}");
  });
});

describe("mergeResponseSchema", () => {
  it("is an array type", () => {
    expect(mergeResponseSchema.type).toBe("array");
  });

  it("has items with required properties", () => {
    expect(mergeResponseSchema.items).toBeDefined();
    expect(mergeResponseSchema.items?.type).toBe("object");
    expect(mergeResponseSchema.items?.properties).toBeDefined();
  });

  it("requires segmentIds", () => {
    expect(mergeResponseSchema.items?.properties?.segmentIds).toBeDefined();
    expect(mergeResponseSchema.items?.required).toContain("segmentIds");
  });

  it("includes confidence property", () => {
    expect(mergeResponseSchema.items?.properties?.confidence).toBeDefined();
  });

  it("includes optional smoothing properties", () => {
    expect(mergeResponseSchema.items?.properties?.smoothedText).toBeDefined();
    expect(mergeResponseSchema.items?.properties?.smoothingChanges).toBeDefined();
  });
});
