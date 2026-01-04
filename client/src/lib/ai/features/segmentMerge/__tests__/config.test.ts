/**
 * Segment Merge Config Tests
 *
 * Tests for configuration, prompts, and response schema.
 */

import { describe, expect, it } from "vitest";
import {
  getMergeSystemPrompt,
  getMergeUserTemplate,
  segmentMergeConfig,
  mergeResponseSchema,
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
    expect(segmentMergeConfig.availablePlaceholders).toContain("segmentPairs");
  });
});

describe("prompt helper functions", () => {
  it("returns system prompt and user template variants", () => {
    expect(getMergeSystemPrompt()).toBeDefined();
    expect(getMergeUserTemplate(5)).toBeDefined();
    expect(getMergeUserTemplate(100)).toBeDefined();
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
