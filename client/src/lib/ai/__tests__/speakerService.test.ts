/**
 * Speaker Service Tests
 *
 * Tests for the speaker classification service.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as core from "../core";
import { classifySpeakers, parseRawResponse } from "../features/speaker/service";
import type { BatchSegment } from "../features/speaker/types";

describe("Speaker Service", () => {
  const executeFeatureMock = vi.spyOn(core, "executeFeature");

  beforeEach(() => {
    executeFeatureMock.mockReset();
  });

  afterAll(() => {
    executeFeatureMock.mockRestore();
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
