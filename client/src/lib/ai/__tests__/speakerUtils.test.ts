/**
 * Speaker Classification Utilities Tests
 *
 * Tests for speaker classification helper functions.
 */

import { describe, expect, it } from "vitest";
import {
  buildCurrentSpeakersMap,
  estimateTokens,
  filterSegmentsForAnalysis,
  formatSegmentsForPrompt,
  formatSpeakersForPrompt,
  markNewSpeaker,
  normalizeSpeakerTag,
  prepareBatch,
  prepareBatchSegments,
  previewResponse,
  resolveSuggestedSpeaker,
  summarizeIssues,
  truncateForPrompt,
} from "../features/speaker/utils";
import type { BatchIssue } from "../features/speaker/types";

describe("Speaker Utils", () => {
  describe("normalizeSpeakerTag", () => {
    it("should convert to lowercase", () => {
      expect(normalizeSpeakerTag("ALICE")).toBe("alice");
    });

    it("should remove non-alphanumeric characters", () => {
      expect(normalizeSpeakerTag("[Speaker 1]")).toBe("speaker1");
    });

    it("should handle special characters", () => {
      expect(normalizeSpeakerTag("Dr. Smith")).toBe("drsmith");
    });

    it("should return empty string for empty input", () => {
      expect(normalizeSpeakerTag("")).toBe("");
    });

    it("should handle only special characters", () => {
      expect(normalizeSpeakerTag("[@#$]")).toBe("");
    });
  });

  describe("resolveSuggestedSpeaker", () => {
    const speakers = ["Alice", "Bob", "[SL]", "[OOC]"];

    it("should find exact match (case insensitive)", () => {
      expect(resolveSuggestedSpeaker("alice", speakers)).toBe("Alice");
    });

    it("should find partial match", () => {
      expect(resolveSuggestedSpeaker("sl", speakers)).toBe("[SL]");
    });

    it("should return null for no match", () => {
      expect(resolveSuggestedSpeaker("unknown", speakers)).toBe(null);
    });

    it("should return null for ambiguous match", () => {
      const ambiguousSpeakers = ["Alice Smith", "Alice Jones"];
      expect(resolveSuggestedSpeaker("alice", ambiguousSpeakers)).toBe(null);
    });

    it("should handle empty tag", () => {
      expect(resolveSuggestedSpeaker("", speakers)).toBe(null);
    });

    it("should work with Set", () => {
      const speakerSet = new Set(["Alice", "Bob"]);
      expect(resolveSuggestedSpeaker("bob", speakerSet)).toBe("Bob");
    });
  });

  describe("markNewSpeaker", () => {
    it("should remove brackets", () => {
      const result = markNewSpeaker("[New Speaker]");
      expect(result.name).toBe("New Speaker");
      expect(result.isNew).toBe(true);
    });

    it("should trim whitespace", () => {
      const result = markNewSpeaker("  Alice  ");
      expect(result.name).toBe("Alice");
    });

    it("should handle no brackets", () => {
      const result = markNewSpeaker("Alice");
      expect(result.name).toBe("Alice");
    });
  });

  describe("formatSegmentsForPrompt", () => {
    it("should format segments correctly", () => {
      const segments = [
        { id: "1", speaker: "Alice", text: "Hello" },
        { id: "2", speaker: "Bob", text: "Hi there" },
      ];
      const result = formatSegmentsForPrompt(segments);
      expect(result).toBe('[1] [Alice]: "Hello"\n[2] [Bob]: "Hi there"');
    });

    it("should handle empty array", () => {
      expect(formatSegmentsForPrompt([])).toBe("");
    });

    it("should use 1-based index", () => {
      const segments = [{ id: "abc", speaker: "X", text: "Test" }];
      const result = formatSegmentsForPrompt(segments);
      expect(result).toContain("[1]");
    });
  });

  describe("formatSpeakersForPrompt", () => {
    it("should join speakers with comma", () => {
      const result = formatSpeakersForPrompt(["Alice", "Bob", "[SL]"]);
      expect(result).toBe("Alice, Bob, [SL]");
    });

    it("should handle single speaker", () => {
      expect(formatSpeakersForPrompt(["Alice"])).toBe("Alice");
    });

    it("should handle empty array", () => {
      expect(formatSpeakersForPrompt([])).toBe("");
    });
  });

  describe("prepareBatchSegments", () => {
    it("should extract required fields", () => {
      const segments = [{ id: "1", speaker: "Alice", text: "Hello", start: 0, end: 1 }];
      const result = prepareBatchSegments(segments);
      expect(result).toEqual([{ segmentId: "1", speaker: "Alice", text: "Hello" }]);
    });

    it("should handle empty array", () => {
      expect(prepareBatchSegments([])).toEqual([]);
    });
  });

  describe("truncateForPrompt", () => {
    it("should not truncate short text", () => {
      expect(truncateForPrompt("Hello", 100)).toBe("Hello");
    });

    it("should truncate long text with ellipsis", () => {
      const longText = "a".repeat(100);
      const result = truncateForPrompt(longText, 50);
      expect(result.length).toBe(50);
      expect(result.endsWith("...")).toBe(true);
    });

    it("should handle exact length", () => {
      const text = "a".repeat(50);
      expect(truncateForPrompt(text, 50)).toBe(text);
    });

    it("should use default max length", () => {
      const longText = "a".repeat(600);
      const result = truncateForPrompt(longText);
      expect(result.length).toBe(500);
    });
  });

  describe("estimateTokens", () => {
    it("should estimate tokens", () => {
      expect(estimateTokens("Hello")).toBe(2); // 5 chars / 4 = 1.25 -> 2
    });

    it("should handle empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("should round up", () => {
      expect(estimateTokens("a")).toBe(1); // 1 / 4 = 0.25 -> 1
    });
  });

  // ==================== New Tests ====================

  describe("prepareBatch", () => {
    const segments = [
      { id: "1", speaker: "Alice", text: "One" },
      { id: "2", speaker: "Bob", text: "Two" },
      { id: "3", speaker: "Alice", text: "Three" },
      { id: "4", speaker: "Bob", text: "Four" },
      { id: "5", speaker: "Alice", text: "Five" },
    ];

    it("should return batch from start index", () => {
      const result = prepareBatch(segments, 0, 2);
      expect(result).toHaveLength(2);
      expect(result[0].segmentId).toBe("1");
      expect(result[1].segmentId).toBe("2");
    });

    it("should return batch from middle", () => {
      const result = prepareBatch(segments, 2, 2);
      expect(result).toHaveLength(2);
      expect(result[0].segmentId).toBe("3");
      expect(result[1].segmentId).toBe("4");
    });

    it("should handle end of array", () => {
      const result = prepareBatch(segments, 3, 5);
      expect(result).toHaveLength(2);
      expect(result[0].segmentId).toBe("4");
      expect(result[1].segmentId).toBe("5");
    });

    it("should handle empty result", () => {
      const result = prepareBatch(segments, 10, 2);
      expect(result).toHaveLength(0);
    });
  });

  describe("filterSegmentsForAnalysis", () => {
    const segments = [
      { id: "1", speaker: "Alice", text: "A", confirmed: false },
      { id: "2", speaker: "Bob", text: "B", confirmed: true },
      { id: "3", speaker: "Alice", text: "C", confirmed: false },
      { id: "4", speaker: "Charlie", text: "D", confirmed: false },
    ];

    it("should return all segments when no filters", () => {
      const result = filterSegmentsForAnalysis(segments, [], false);
      expect(result).toHaveLength(4);
    });

    it("should exclude confirmed segments", () => {
      const result = filterSegmentsForAnalysis(segments, [], true);
      expect(result).toHaveLength(3);
      expect(result.find((s) => s.id === "2")).toBeUndefined();
    });

    it("should filter by selected speakers", () => {
      const result = filterSegmentsForAnalysis(segments, ["Alice"], false);
      expect(result).toHaveLength(2);
      expect(result.every((s) => s.speaker === "Alice")).toBe(true);
    });

    it("should combine filters", () => {
      const result = filterSegmentsForAnalysis(segments, ["Alice", "Bob"], true);
      expect(result).toHaveLength(2);
      expect(result.find((s) => s.speaker === "Bob")).toBeUndefined();
    });

    it("should be case insensitive for speakers", () => {
      const result = filterSegmentsForAnalysis(segments, ["ALICE"], false);
      expect(result).toHaveLength(2);
    });
  });

  describe("summarizeIssues", () => {
    it("should return empty string for undefined", () => {
      expect(summarizeIssues(undefined)).toBe("");
    });

    it("should return empty string for empty array", () => {
      expect(summarizeIssues([])).toBe("");
    });

    it("should join up to 3 messages", () => {
      const issues: BatchIssue[] = [
        { level: "warn", message: "first" },
        { level: "warn", message: "second" },
        { level: "error", message: "third" },
      ];
      expect(summarizeIssues(issues)).toBe("first; second; third");
    });

    it("should truncate beyond 3 messages", () => {
      const issues: BatchIssue[] = [
        { level: "warn", message: "m1" },
        { level: "warn", message: "m2" },
        { level: "warn", message: "m3" },
        { level: "error", message: "m4" },
        { level: "error", message: "m5" },
      ];
      expect(summarizeIssues(issues)).toBe("m1; m2; m3 (+2 more)");
    });
  });

  describe("previewResponse", () => {
    it("should return '<empty>' for empty string", () => {
      expect(previewResponse("")).toBe("<empty>");
    });

    it("should return full text if under limit", () => {
      expect(previewResponse("Hello world", 100)).toBe("Hello world");
    });

    it("should truncate long text with ellipsis", () => {
      const longText = "a".repeat(100);
      const result = previewResponse(longText, 50);
      expect(result.length).toBe(50); // maxLength includes ellipsis
      expect(result.endsWith("…")).toBe(true);
    });

    it("should use default max length", () => {
      const longText = "a".repeat(700);
      const result = previewResponse(longText);
      expect(result.length).toBe(600); // default maxLength includes ellipsis
    });
  });

  describe("buildCurrentSpeakersMap", () => {
    it("should build map from batch segments", () => {
      const batch = [
        { segmentId: "1", speaker: "Alice", text: "A" },
        { segmentId: "2", speaker: "Bob", text: "B" },
      ];
      const map = buildCurrentSpeakersMap(batch);
      expect(map.get("1")).toBe("Alice");
      expect(map.get("2")).toBe("Bob");
      expect(map.size).toBe(2);
    });

    it("should handle empty batch", () => {
      const map = buildCurrentSpeakersMap([]);
      expect(map.size).toBe(0);
    });
  });
});
