/**
 * Segment Merge Config Tests
 *
 * Tests for configuration, prompts, and response schema.
 */

import { describe, expect, it } from "vitest";
import {
  getMergeSystemPrompt,
  getMergeUserTemplate,
  MERGE_ANALYSIS_USER_TEMPLATE,
  MERGE_ANALYSIS_USER_TEMPLATE_SIMPLE,
  mergeResponseSchema,
  segmentMergeConfig,
} from "../config";

/**
 * Count occurrences of an opening/closing XML tag pair in a string.
 */
function countTagOccurrences(source: string, tag: string): { open: number; close: number } {
  const open = (source.match(new RegExp(`<${tag}>`, "g")) ?? []).length;
  const close = (source.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
  return { open, close };
}

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

describe("segmentMergeConfig - XML structure (Task 3)", () => {
  it("wraps merge rules and the response contract in the system prompt, each exactly once", () => {
    const prompt = segmentMergeConfig.systemPrompt;

    for (const tag of ["merge_rules", "response_contract"]) {
      const { open, close } = countTagOccurrences(prompt, tag);
      expect(open).toBe(1);
      expect(close).toBe(1);
    }
  });

  it("encloses prefilter facts, merge criteria, artifacts, boundary preservation, confidence, and exclusions within <merge_rules>", () => {
    const prompt = segmentMergeConfig.systemPrompt;
    const openIndex = prompt.indexOf("<merge_rules>");
    const closeIndex = prompt.indexOf("</merge_rules>");
    expect(openIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeGreaterThan(openIndex);

    const block = prompt.slice(openIndex, closeIndex);
    expect(block).toContain("already been pre-filtered");
    expect(block).toContain("MERGE CRITERIA");
    expect(block).toContain("COMMON TRANSCRIPTION ARTIFACTS");
    expect(block).toContain("BOUNDARY PRESERVATION RULE");
    expect(block).toContain("CONFIDENCE SCORING");
    expect(block).toContain("DO NOT SUGGEST MERGE WHEN");
  });

  it("encloses the Plan 1 outcome section within <response_contract> without losing semantics or examples", () => {
    const prompt = segmentMergeConfig.systemPrompt;
    const openIndex = prompt.indexOf("<response_contract>");
    const closeIndex = prompt.indexOf("</response_contract>");
    expect(openIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeGreaterThan(openIndex);

    const block = prompt.slice(openIndex, closeIndex);
    expect(block).toContain('"status": "ok"');
    expect(block).toContain('"status": "empty"');
    expect(block).toContain('"status": "error"');
    expect(block).toContain("MISSING_REQUIRED_INPUT");
    expect(block).toContain("TEMPORARY_FAILURE");
  });

  it("keeps the short TASK section and consecutive-segment prose untagged", () => {
    const prompt = segmentMergeConfig.systemPrompt;
    const taskIndex = prompt.indexOf("TASK\n----");
    const mergeRulesIndex = prompt.indexOf("<merge_rules>");
    expect(taskIndex).toBeGreaterThan(-1);
    expect(mergeRulesIndex).toBeGreaterThan(taskIndex);
    expect(prompt.slice(taskIndex, mergeRulesIndex)).not.toMatch(/<\w+>/);
  });

  it("wraps {{segments}} in <segments_for_context> in both built-in user templates", () => {
    for (const template of [MERGE_ANALYSIS_USER_TEMPLATE, MERGE_ANALYSIS_USER_TEMPLATE_SIMPLE]) {
      const { open, close } = countTagOccurrences(template, "segments_for_context");
      expect(open).toBe(1);
      expect(close).toBe(1);

      const openIndex = template.indexOf("<segments_for_context>");
      const closeIndex = template.indexOf("</segments_for_context>");
      expect(template.slice(openIndex, closeIndex)).toContain("{{segments}}");
    }
  });

  it("wraps conditional smoothing instructions in <smoothing_rules> inside the enableSmoothing conditional, in both built-in user templates", () => {
    for (const template of [MERGE_ANALYSIS_USER_TEMPLATE, MERGE_ANALYSIS_USER_TEMPLATE_SIMPLE]) {
      const { open, close } = countTagOccurrences(template, "smoothing_rules");
      expect(open).toBe(1);
      expect(close).toBe(1);

      const ifIndex = template.indexOf("{{#if enableSmoothing}}");
      const smoothingOpenIndex = template.indexOf("<smoothing_rules>");
      const smoothingCloseIndex = template.indexOf("</smoothing_rules>");
      const endIfIndex = template.lastIndexOf("{{/if}}");

      expect(ifIndex).toBeGreaterThan(-1);
      expect(smoothingOpenIndex).toBeGreaterThan(ifIndex);
      expect(smoothingCloseIndex).toBeGreaterThan(smoothingOpenIndex);
      expect(endIfIndex).toBeGreaterThan(smoothingCloseIndex);
    }
  });

  it("preserves placeholders unchanged in both built-in user templates", () => {
    for (const template of [MERGE_ANALYSIS_USER_TEMPLATE, MERGE_ANALYSIS_USER_TEMPLATE_SIMPLE]) {
      expect(template).toContain("{{maxTimeGap}}");
      expect(template).toContain("{{#if enableSmoothing}}");
      expect(template).toContain("{{segments}}");
    }
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
