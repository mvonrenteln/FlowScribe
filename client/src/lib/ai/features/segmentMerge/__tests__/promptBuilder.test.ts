/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { buildMergePrompt, hasEligiblePairs } from "../promptBuilder";
import type { MergeAnalysisSegment } from "../types";
import { createSimpleIdContext } from "../utils";

const createSegment = (overrides?: Partial<MergeAnalysisSegment>): MergeAnalysisSegment => ({
  id: `seg-${Math.random()}`,
  text: "Test segment",
  start: 0,
  end: 1,
  speaker: "Speaker 1",
  ...overrides,
});

describe("Prompt Builder", () => {
  describe("buildMergePrompt", () => {
    it("should build complete prompt data", () => {
      const segments = [
        createSegment({ id: "seg-1", startTime: 0, endTime: 1 }),
        createSegment({ id: "seg-2", startTime: 1.5, endTime: 2.5 }),
      ];
      const idContext = createSimpleIdContext(segments);

      const prompt = buildMergePrompt({
        segments,
        maxTimeGap: 2.0,
        sameSpeakerOnly: false,
        enableSmoothing: "true",
        idContext,
      });

      expect(prompt.variables).toBeDefined();
      expect(prompt.systemPrompt).toBeTruthy();
      expect(prompt.userTemplate).toBeTruthy();
      expect(prompt.pairCount).toBeGreaterThan(0);
    });

    it("should include all required variables", () => {
      const segments = [
        createSegment({ id: "seg-1", startTime: 0, endTime: 1 }),
        createSegment({ id: "seg-2", startTime: 1.5, endTime: 2.5 }),
      ];
      const idContext = createSimpleIdContext(segments);

      const prompt = buildMergePrompt({
        segments,
        maxTimeGap: 2.0,
        sameSpeakerOnly: false,
        enableSmoothing: "true",
        idContext,
      });

      expect(prompt.variables.segmentPairs).toBeTruthy();
      expect(prompt.variables.segmentPairsJson).toBeTruthy();
      expect(prompt.variables.segments).toBeTruthy();
      expect(prompt.variables.maxTimeGap).toBe("2");
      expect(prompt.variables.enableSmoothing).toBe("true");
    });

    it("should use simple IDs in formatted text", () => {
      const segments = [
        createSegment({ id: "complex-uuid-123", text: "First", startTime: 0, endTime: 1 }),
        createSegment({ id: "complex-uuid-456", text: "Second", startTime: 1.5, endTime: 2.5 }),
      ];
      const idContext = createSimpleIdContext(segments);

      const prompt = buildMergePrompt({
        segments,
        maxTimeGap: 2.0,
        sameSpeakerOnly: false,
        enableSmoothing: "false",
        idContext,
      });

      // Should contain simple IDs (1, 2) not complex UUIDs
      expect(prompt.variables.segmentPairs).toContain("1");
      expect(prompt.variables.segmentPairs).toContain("2");
      expect(prompt.variables.segmentPairs).not.toContain("complex-uuid");
    });

    it("should include real IDs in pair mapping JSON", () => {
      const segments = [
        createSegment({ id: "real-id-1", startTime: 0, endTime: 1 }),
        createSegment({ id: "real-id-2", startTime: 1.5, endTime: 2.5 }),
      ];
      const idContext = createSimpleIdContext(segments);

      const prompt = buildMergePrompt({
        segments,
        maxTimeGap: 2.0,
        sameSpeakerOnly: false,
        enableSmoothing: "true",
        idContext,
      });

      const pairMapping = JSON.parse(prompt.variables.segmentPairsJson);

      expect(pairMapping).toHaveLength(1);
      expect(pairMapping[0].segmentIds).toEqual(["real-id-1", "real-id-2"]);
      expect(pairMapping[0].simpleIds).toEqual(["1", "2"]);
      expect(pairMapping[0].pairIndex).toBe(0);
    });

    it("should filter pairs by time gap", () => {
      const segments = [
        createSegment({ id: "seg-1", startTime: 0, endTime: 1 }),
        createSegment({ id: "seg-2", startTime: 5, endTime: 6 }), // Far away
        createSegment({ id: "seg-3", startTime: 6.5, endTime: 7.5 }), // Close to seg-2
      ];
      const idContext = createSimpleIdContext(segments);

      const prompt = buildMergePrompt({
        segments,
        maxTimeGap: 2.0,
        sameSpeakerOnly: false,
        enableSmoothing: "false",
        idContext,
      });

      // Should only find 1 pair (seg-2 and seg-3)
      expect(prompt.pairCount).toBe(1);
    });

    it("should filter pairs by speaker when sameSpeakerOnly", () => {
      const segments = [
        createSegment({ id: "seg-1", speaker: "Alice", startTime: 0, endTime: 1 }),
        createSegment({ id: "seg-2", speaker: "Bob", startTime: 1.5, endTime: 2.5 }),
        createSegment({ id: "seg-3", speaker: "Alice", startTime: 3, endTime: 4 }),
        createSegment({ id: "seg-4", speaker: "Alice", startTime: 4.5, endTime: 5.5 }),
      ];
      const idContext = createSimpleIdContext(segments);

      const prompt = buildMergePrompt({
        segments,
        maxTimeGap: 2.0,
        sameSpeakerOnly: true,
        enableSmoothing: "false",
        idContext,
      });

      // Should only find pairs where speaker matches
      const pairMapping = JSON.parse(prompt.variables.segmentPairsJson);

      for (const pair of pairMapping) {
        const [id1, id2] = pair.segmentIds;
        const seg1 = segments.find((s) => s.id === id1);
        const seg2 = segments.find((s) => s.id === id2);
        expect(seg1?.speaker).toBe(seg2?.speaker);
      }
    });

    it("should handle no eligible pairs", () => {
      const segments = [
        createSegment({ id: "seg-1", startTime: 0, endTime: 1 }),
        createSegment({ id: "seg-2", startTime: 10, endTime: 11 }), // Too far
      ];
      const idContext = createSimpleIdContext(segments);

      const prompt = buildMergePrompt({
        segments,
        maxTimeGap: 2.0,
        sameSpeakerOnly: false,
        enableSmoothing: "false",
        idContext,
      });

      expect(prompt.pairCount).toBe(0);
      expect(prompt.variables.segmentPairs).toBe("");
    });
  });

  describe("hasEligiblePairs", () => {
    it("should return true when pairs exist", () => {
      const segments = [
        createSegment({ id: "seg-1", startTime: 0, endTime: 1 }),
        createSegment({ id: "seg-2", startTime: 1.5, endTime: 2.5 }),
      ];
      const idContext = createSimpleIdContext(segments);

      const prompt = buildMergePrompt({
        segments,
        maxTimeGap: 2.0,
        sameSpeakerOnly: false,
        enableSmoothing: "false",
        idContext,
      });

      expect(hasEligiblePairs(prompt)).toBe(true);
    });

    it("should return false when no pairs", () => {
      const segments = [createSegment({ id: "seg-1", startTime: 0, endTime: 1 })];
      const idContext = createSimpleIdContext(segments);

      const prompt = buildMergePrompt({
        segments,
        maxTimeGap: 2.0,
        sameSpeakerOnly: false,
        enableSmoothing: "false",
        idContext,
      });

      expect(hasEligiblePairs(prompt)).toBe(false);
    });
  });
});
