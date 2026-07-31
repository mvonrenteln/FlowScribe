/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { buildMergePrompt, hasEligiblePairs } from "../promptBuilder";
import type { MergeAnalysisSegment } from "../types";
import {
  collectSegmentPairsWithSimpleIds,
  createSimpleIdContext,
  formatSegmentsWithSimpleIds,
} from "../utils";

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
        createSegment({ id: "seg-1", start: 0, end: 1 }),
        createSegment({ id: "seg-2", start: 1.5, end: 2.5 }),
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
        createSegment({ id: "seg-1", start: 0, end: 1 }),
        createSegment({ id: "seg-2", start: 1.5, end: 2.5 }),
      ];
      const idContext = createSimpleIdContext(segments);

      const prompt = buildMergePrompt({
        segments,
        maxTimeGap: 2.0,
        sameSpeakerOnly: false,
        enableSmoothing: "true",
        idContext,
      });

      expect(prompt.variables.segmentPairsJson).toBeTruthy();
      expect(prompt.variables.segments).toBeTruthy();
      expect(prompt.variables.maxTimeGap).toBe("2");
      expect(prompt.variables.enableSmoothing).toBe("true");
    });

    it("should use simple IDs in formatted segments", () => {
      const segments = [
        createSegment({ id: "complex-uuid-123", text: "First", start: 0, end: 1 }),
        createSegment({ id: "complex-uuid-456", text: "Second", start: 1.5, end: 2.5 }),
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
      const formattedSegments = prompt.variables.segments as string;
      expect(formattedSegments).toContain("1");
      expect(formattedSegments).toContain("2");
      expect(formattedSegments).not.toContain("complex-uuid");
    });

    it("should include real IDs in pair mapping JSON", () => {
      const segments = [
        createSegment({ id: "real-id-1", start: 0, end: 1 }),
        createSegment({ id: "real-id-2", start: 1.5, end: 2.5 }),
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
      expect(pairMapping[0].pairIndex).toBe(1);
    });

    it("should filter pairs by time gap", () => {
      const segments = [
        createSegment({ id: "seg-1", start: 0, end: 1 }),
        createSegment({ id: "seg-2", start: 5, end: 6 }), // Far away
        createSegment({ id: "seg-3", start: 6.5, end: 7.5 }), // Close to seg-2
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
        createSegment({ id: "seg-1", speaker: "Alice", start: 0, end: 1 }),
        createSegment({ id: "seg-2", speaker: "Bob", start: 1.5, end: 2.5 }),
        createSegment({ id: "seg-3", speaker: "Alice", start: 3, end: 4 }),
        createSegment({ id: "seg-4", speaker: "Alice", start: 4.5, end: 5.5 }),
      ];
      const idContext = createSimpleIdContext(segments);

      const prompt = buildMergePrompt({
        segments,
        maxTimeGap: 2.0,
        sameSpeakerOnly: true, // Only same speaker
        enableSmoothing: "true",
        idContext,
      });

      // Should only find 1 pair (seg-3 and seg-4, both Alice)
      expect(prompt.pairCount).toBe(1);
    });

    it("should handle no eligible pairs", () => {
      const segments = [
        createSegment({ id: "seg-1", start: 0, end: 1 }),
        createSegment({ id: "seg-2", start: 10, end: 11 }), // Too far
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
    });
  });

  describe("hasEligiblePairs", () => {
    it("should return true when pairs exist", () => {
      const segments = [
        createSegment({ id: "seg-1", start: 0, end: 1 }),
        createSegment({ id: "seg-2", start: 1.5, end: 2.5 }),
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
      const segments = [createSegment({ id: "seg-1", start: 0, end: 1 })];
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

  describe("raw passthrough of default transcript content (Task 3)", () => {
    const segmentsWithSpecialChars = [
      createSegment({ id: "seg-1", text: 'Rule: "A" & <B> > C', start: 0, end: 1 }),
      createSegment({ id: "seg-2", text: "Second & <segment>", start: 1.5, end: 2.5 }),
    ];

    it("passes the default formatted segment string through as-is, without transformation", () => {
      const idContext = createSimpleIdContext(segmentsWithSpecialChars);

      const prompt = buildMergePrompt({
        segments: segmentsWithSpecialChars,
        maxTimeGap: 2.0,
        sameSpeakerOnly: false,
        enableSmoothing: "true",
        idContext,
      });

      const rawFormatted = formatSegmentsWithSimpleIds(
        segmentsWithSpecialChars,
        idContext.getSimpleId,
      );

      expect(prompt.variables.segments).toBe(rawFormatted);
    });

    it("does not transform other variables", () => {
      const idContext = createSimpleIdContext(segmentsWithSpecialChars);

      const prompt = buildMergePrompt({
        segments: segmentsWithSpecialChars,
        maxTimeGap: 2.0,
        sameSpeakerOnly: false,
        enableSmoothing: "true",
        idContext,
      });

      const expectedPairs = collectSegmentPairsWithSimpleIds(
        segmentsWithSpecialChars,
        2.0,
        false,
        idContext.mapping,
        idContext.getSimpleId,
      );
      const expectedSegmentPairsJson = JSON.stringify(
        expectedPairs.map((pair) => ({
          pairIndex: pair.pairIndex,
          segmentIds: [pair.segmentA.id, pair.segmentB.id],
          simpleIds: [String(pair.simpleIdA), String(pair.simpleIdB)],
        })),
      );

      expect(prompt.variables.maxTimeGap).toBe("2");
      expect(prompt.variables.enableSmoothing).toBe("true");
      expect(prompt.variables.segmentPairsJson).toBe(expectedSegmentPairsJson);
    });

    it("keeps segments raw when a custom systemPrompt override is supplied", () => {
      const idContext = createSimpleIdContext(segmentsWithSpecialChars);

      const prompt = buildMergePrompt({
        segments: segmentsWithSpecialChars,
        maxTimeGap: 2.0,
        sameSpeakerOnly: false,
        enableSmoothing: "true",
        idContext,
        systemPrompt: "Custom system prompt",
      });

      const rawFormatted = formatSegmentsWithSimpleIds(
        segmentsWithSpecialChars,
        idContext.getSimpleId,
      );
      expect(prompt.variables.segments).toBe(rawFormatted);
    });

    it("keeps segments raw when a custom userTemplate override is supplied", () => {
      const idContext = createSimpleIdContext(segmentsWithSpecialChars);

      const prompt = buildMergePrompt({
        segments: segmentsWithSpecialChars,
        maxTimeGap: 2.0,
        sameSpeakerOnly: false,
        enableSmoothing: "true",
        idContext,
        userTemplate: "{{segments}}",
      });

      const rawFormatted = formatSegmentsWithSimpleIds(
        segmentsWithSpecialChars,
        idContext.getSimpleId,
      );
      expect(prompt.variables.segments).toBe(rawFormatted);
    });

    it("keeps segments raw when both custom systemPrompt and userTemplate overrides are supplied", () => {
      const idContext = createSimpleIdContext(segmentsWithSpecialChars);

      const prompt = buildMergePrompt({
        segments: segmentsWithSpecialChars,
        maxTimeGap: 2.0,
        sameSpeakerOnly: false,
        enableSmoothing: "true",
        idContext,
        systemPrompt: "Custom system prompt",
        userTemplate: "{{segments}}",
      });

      const rawFormatted = formatSegmentsWithSimpleIds(
        segmentsWithSpecialChars,
        idContext.getSimpleId,
      );
      expect(prompt.variables.segments).toBe(rawFormatted);
    });
  });
});
