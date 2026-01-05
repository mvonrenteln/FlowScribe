/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIFeatureResult } from "@/lib/ai/core/types";
import { disableFeatureDebug, enableFeatureDebug } from "@/lib/ai/logging/loggingService";
import {
  extractRawResponse,
  isRawMergeSuggestion,
  normalizeRecoveredItem,
  processAIResponse,
} from "../responseProcessor";

describe("Response Processor", () => {
  beforeEach(() => {
    disableFeatureDebug("SegmentMerge");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("isRawMergeSuggestion", () => {
    it("should return true for valid suggestion", () => {
      expect(isRawMergeSuggestion({ segmentIds: ["1", "2"] })).toBe(true);
      expect(isRawMergeSuggestion({ segmentId: "1" })).toBe(true);
    });

    it("should return true for mergeId format", () => {
      expect(isRawMergeSuggestion({ mergeId: 1 })).toBe(true);
    });

    it("should return true for pairIndex format", () => {
      expect(isRawMergeSuggestion({ pairIndex: 1 })).toBe(true);
    });

    it("should return false for invalid data", () => {
      expect(isRawMergeSuggestion(null)).toBe(false);
      expect(isRawMergeSuggestion({})).toBe(false);
      expect(isRawMergeSuggestion({ other: "field" })).toBe(false);
    });

    it("should return false for segmentA/segmentB format (not validated)", () => {
      expect(
        isRawMergeSuggestion({
          segmentA: { id: 137 },
          segmentB: { id: 138 },
        }),
      ).toBe(false);
    });
  });

  describe("extractRawResponse", () => {
    it("should extract string raw response", () => {
      const result = {
        success: false,
        rawResponse: "test response",
      } as any;

      expect(extractRawResponse(result)).toBe("test response");
    });

    it("should stringify object raw response", () => {
      const result = {
        success: false,
        rawResponse: { data: "test" },
      } as any;

      expect(extractRawResponse(result)).toBe('{"data":"test"}');
    });

    it("should return null when no raw response", () => {
      const result = { success: true } as any;
      expect(extractRawResponse(result)).toBeNull();
    });
  });

  describe("normalizeRecoveredItem", () => {
    it("should normalize valid item", () => {
      const item = {
        segmentIds: ["1", "2"],
        confidence: 0.8,
        reason: "Test reason",
      };

      const normalized = normalizeRecoveredItem(item);

      expect(normalized).toEqual({
        segmentIds: ["1", "2"],
        confidence: 0.8,
        reason: "Test reason",
        smoothedText: undefined,
        smoothingChanges: undefined,
      });
    });

    it("should handle segmentId (singular)", () => {
      const item = { segmentId: "123" };
      const normalized = normalizeRecoveredItem(item);

      expect(normalized.segmentIds).toEqual(["123"]);
    });

    it("should apply defaults", () => {
      const item = { segmentIds: ["1", "2"] };
      const normalized = normalizeRecoveredItem(item);

      expect(normalized.confidence).toBe(0.5);
      expect(normalized.reason).toBe("");
    });

    it("should handle alternative field names", () => {
      const item = {
        segmentIds: ["1", "2"],
        explanation: "Alt reason",
        smoothed_text: "Smoothed",
        smoothing_changes: ["change1"],
      };

      const normalized = normalizeRecoveredItem(item);

      expect(normalized.reason).toBe("Alt reason");
      expect(normalized.smoothedText).toBe("Smoothed");
      expect(normalized.smoothingChanges).toEqual(["change1"]);
    });

    it("should convert segment IDs to strings", () => {
      const item = { segmentIds: [1, 2, 3] };
      const normalized = normalizeRecoveredItem(item);

      expect(normalized.segmentIds).toEqual(["1", "2", "3"]);
    });

    it("should handle mergedText as smoothedText fallback", () => {
      const item = {
        segmentIds: [1, 2],
        mergedText: "Merged content",
      };

      const normalized = normalizeRecoveredItem(item);

      expect(normalized.smoothedText).toBe("Merged content");
    });

    it("should return empty segmentIds array when no IDs provided", () => {
      const item = {
        confidence: 0.8,
        reason: "Test",
      };

      const normalized = normalizeRecoveredItem(item);

      expect(normalized.segmentIds).toEqual([]);
    });
  });

  describe("processAIResponse", () => {
    const idMapping = { "1": "real-1", "2": "real-2" };

    it("should process successful response", () => {
      const result: AIFeatureResult<any> = {
        success: true,
        data: [{ segmentIds: ["1", "2"], confidence: 0.9, reason: "Good match" }],
        metadata: {},
      };

      const processed = processAIResponse(result, { idMapping });

      expect(processed.suggestions).toHaveLength(1);
      expect(processed.issues).toHaveLength(0);
      expect(processed.recoveryStrategy).toBeUndefined();
    });

    it("should handle failed response with recovery", () => {
      const result: AIFeatureResult<any> = {
        success: false,
        error: "Parse failed",
        rawResponse: '[{"segmentIds":["1","2"],"confidence":0.8}]',
        metadata: {},
      };

      const processed = processAIResponse(result, { idMapping });

      expect(processed.suggestions.length).toBeGreaterThan(0);
      expect(processed.issues.some((i) => i.message.includes("recovered"))).toBe(true);
      expect(processed.recoveryStrategy).toBeTruthy();
    });

    it("should handle complete failure", () => {
      const result: AIFeatureResult<any> = {
        success: false,
        error: "Complete failure",
        rawResponse: "not parseable at all",
        metadata: {},
      };

      const processed = processAIResponse(result, { idMapping });

      expect(processed.suggestions).toHaveLength(0);
      expect(processed.issues.some((i) => i.level === "error")).toBe(true);
    });

    it("should normalize suggestions with ID mapping", () => {
      const result: AIFeatureResult<any> = {
        success: true,
        data: [{ segmentIds: ["1", "2"], confidence: 0.9, reason: "Test" }],
        metadata: {},
      };

      const processed = processAIResponse(result, { idMapping });

      // normalizeRawSuggestion should be called (testing integration)
      expect(processed.suggestions).toHaveLength(1);
    });

    it("should handle missing raw response", () => {
      const result: AIFeatureResult<any> = {
        success: false,
        error: "No response",
        metadata: {},
      };

      const processed = processAIResponse(result, { idMapping });

      expect(processed.suggestions).toHaveLength(0);
      expect(processed.issues.some((i) => i.message.includes("No raw response"))).toBe(true);
    });

    it("should log debug info when enabled", () => {
      enableFeatureDebug("SegmentMerge");

      const result: AIFeatureResult<any> = {
        success: true,
        data: [],
        rawResponse: "debug test",
        metadata: {},
      };

      processAIResponse(result, { idMapping });

      expect(console.log).toHaveBeenCalled();
    });

    it("should handle items that fail normalization", () => {
      const result: AIFeatureResult<any> = {
        success: true,
        data: [
          { segmentIds: ["1", "2"], confidence: 0.9 },
          { invalid: "data" }, // This will fail normalization
        ],
        metadata: {},
      };

      const processed = processAIResponse(result, { idMapping });

      expect(processed.issues.some((i) => i.message.includes("could not be normalized"))).toBe(
        true,
      );
    });

    it("should recover from JSON substring", () => {
      const result: AIFeatureResult<any> = {
        success: false,
        error: "Parse error",
        rawResponse: 'Error occurred: [{"segmentIds":["1","2"],"confidence":0.7}] end',
        metadata: {},
      };

      const processed = processAIResponse(result, { idMapping });

      expect(processed.suggestions.length).toBeGreaterThan(0);
      expect(processed.recoveryStrategy).toBe("json-substring");
    });
  });
});
