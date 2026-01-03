/**
 * Speaker Classification Utilities Tests
 *
 * Tests for speaker classification helper functions.
 */

import { describe, expect, it } from "vitest";
import {
  estimateTokens,
  formatSegmentsForPrompt,
  formatSpeakersForPrompt,
  markNewSpeaker,
  normalizeSpeakerTag,
  prepareBatchSegments,
  resolveSuggestedSpeaker,
  truncateForPrompt,
} from "../features/speaker/utils";

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
});
