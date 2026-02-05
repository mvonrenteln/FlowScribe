/**
 * Revision Service Tests
 *
 * Tests for the text revision service helper functions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as settingsStorage from "@/lib/settings/settingsStorage";
import * as core from "../core";
import { getDefaultPrompt } from "../features/revision/config";
import {
  buildRevisionPrompt,
  getChangePreview,
  hasChanges,
  reviseSegment,
  reviseSegmentsBatch,
} from "../features/revision/service";

describe("Revision Service", () => {
  let executeFeatureSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    executeFeatureSpy = vi.spyOn(core, "executeFeature");
    executeFeatureSpy.mockReset();
  });

  afterEach(() => {
    executeFeatureSpy.mockRestore();
  });

  describe("reviseSegment", () => {
    it("passes provider options to executeFeature", async () => {
      executeFeatureSpy.mockResolvedValueOnce({
        success: true,
        data: "Updated text",
        metadata: {
          featureId: "text-revision",
          providerId: "test-provider",
          model: "test-model",
          durationMs: 5,
        },
      });

      await reviseSegment({
        segment: { id: "1", text: "Hello" },
        prompt: getDefaultPrompt(),
        providerId: "test-provider",
        model: "test-model",
      });

      expect(executeFeatureSpy).toHaveBeenCalledWith(
        "text-revision",
        expect.any(Object),
        expect.objectContaining({
          providerId: "test-provider",
          model: "test-model",
        }),
      );
    });
  });

  describe("reviseSegmentsBatch", () => {
    it("forwards provider options to each revision call", async () => {
      executeFeatureSpy.mockResolvedValue({
        success: true,
        data: "Updated text",
        metadata: {
          featureId: "text-revision",
          providerId: "batch-provider",
          model: "batch-model",
          durationMs: 5,
        },
      });

      await reviseSegmentsBatch({
        segments: [
          { id: "1", text: "Hello" },
          { id: "2", text: "World" },
        ],
        allSegments: [
          { id: "1", text: "Hello" },
          { id: "2", text: "World" },
        ],
        prompt: getDefaultPrompt(),
        providerId: "batch-provider",
        model: "batch-model",
      });

      expect(executeFeatureSpy).toHaveBeenCalledTimes(2);
      for (const call of executeFeatureSpy.mock.calls) {
        const options = call[2] as Record<string, unknown>;
        expect(options).toMatchObject({
          providerId: "batch-provider",
          model: "batch-model",
        });
      }
    });

    it("emits batch log and results in segment order when running concurrently", async () => {
      vi.useFakeTimers();

      const settingsSpy = vi.spyOn(settingsStorage, "initializeSettings").mockReturnValue({
        ...settingsStorage.DEFAULT_SETTINGS,
        enableConcurrentRequests: true,
        maxConcurrentRequests: 2,
      });

      try {
        executeFeatureSpy.mockImplementation((_featureId, variables) => {
          const text = (variables as { text: string }).text;
          const delay = text === "first" ? 30 : text === "second" ? 10 : 0;
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  data: `${text}-revised`,
                  metadata: {
                    featureId: "text-revision",
                    providerId: "test-provider",
                    model: "test-model",
                    durationMs: delay,
                  },
                }),
              delay,
            ),
          );
        });

        const batchLog: string[] = [];
        const resultIds: string[] = [];

        const promise = reviseSegmentsBatch({
          segments: [
            { id: "1", text: "first" },
            { id: "2", text: "second" },
            { id: "3", text: "third" },
          ],
          allSegments: [
            { id: "1", text: "first" },
            { id: "2", text: "second" },
            { id: "3", text: "third" },
          ],
          prompt: getDefaultPrompt(),
          onItemComplete: (entry) => batchLog.push(entry.segmentId),
          onResult: (result) => resultIds.push(result.segmentId),
        });

        await vi.runAllTimersAsync();
        await promise;

        expect(batchLog).toEqual(["1", "2", "3"]);
        expect(resultIds).toEqual(["1", "2", "3"]);
      } finally {
        settingsSpy.mockRestore();
        vi.useRealTimers();
      }
    });
  });

  describe("hasChanges", () => {
    it("should return false for identical text", () => {
      expect(hasChanges("Hello world", "Hello world")).toBe(false);
    });

    it("should return false for text with only whitespace differences", () => {
      expect(hasChanges("Hello world", "  Hello world  ")).toBe(false);
    });

    it("should return true for different text", () => {
      expect(hasChanges("Hello world", "Hello there")).toBe(true);
    });

    it("should return true for added text", () => {
      expect(hasChanges("Hello", "Hello world")).toBe(true);
    });

    it("should return true for removed text", () => {
      expect(hasChanges("Hello world", "Hello")).toBe(true);
    });
  });

  describe("buildRevisionPrompt", () => {
    const template = getDefaultPrompt();

    it("should include the text to revise", () => {
      const prompt = buildRevisionPrompt(template, "Hello world");
      expect(prompt).toContain("Hello world");
    });

    it("should include previous context when provided", () => {
      const prompt = buildRevisionPrompt(template, "Hello world", {
        previousText: "Previous segment",
      });
      expect(prompt).toContain("Previous segment");
    });

    it("should include next context when provided", () => {
      const prompt = buildRevisionPrompt(template, "Hello world", {
        nextText: "Next segment",
      });
      expect(prompt).toContain("Next segment");
    });

    it("should handle empty context", () => {
      const prompt = buildRevisionPrompt(template, "Hello world", {});
      expect(prompt).toContain("Hello world");
    });
  });

  describe("getChangePreview", () => {
    it("should return 'No changes' for identical text", () => {
      expect(getChangePreview("Hello", "Hello")).toBe("No changes");
    });

    it("should return preview for changed text", () => {
      const preview = getChangePreview("Hello", "Hello world");
      expect(preview).not.toBe("No changes");
      expect(preview.length).toBeGreaterThan(0);
    });

    it("should truncate long previews", () => {
      const original = "a".repeat(50);
      const revised = "b".repeat(200);
      const preview = getChangePreview(original, revised, 50);
      expect(preview.length).toBeLessThanOrEqual(50);
    });

    it("should handle whitespace-only changes", () => {
      expect(getChangePreview("Hello", "  Hello  ")).toBe("No changes");
    });
  });

  describe("getDefaultPrompt", () => {
    it("should return a valid template", () => {
      const template = getDefaultPrompt();
      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.systemPrompt).toBeDefined();
      expect(template.userPromptTemplate).toBeDefined();
    });

    it("should return cleanup template as default", () => {
      const template = getDefaultPrompt();
      expect(template.id).toContain("cleanup");
    });
  });
});
