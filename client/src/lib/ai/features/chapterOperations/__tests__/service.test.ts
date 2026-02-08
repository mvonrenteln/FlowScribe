import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as coreModule from "../../../core";
import type { AIFeatureResult } from "@/lib/ai/core/types";
import { generateMetadata, generateNotes, generateSummary, suggestTitles } from "../service";
import type { ChapterPrompt } from "../types";

describe("chapterOperations service", () => {
  let executeFeatureSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    executeFeatureSpy = vi.spyOn(coreModule, "executeFeature");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockPrompt: ChapterPrompt = {
    id: "test-prompt",
    name: "Test Title Prompt", // Implies title operation by default fallback
    operation: "metadata",
    systemPrompt: "sys",
    userPromptTemplate: "user",
    description: "desc",
    isBuiltIn: false,
    quickAccess: false,
  };

  const mockContext = {
    chapterId: "c1",
    chapterSegments: "segments...",
    chapterTitle: "Old Title",
    currentSummary: "Old Summary",
    currentNotes: "Old Notes",
  };
  const mockMetadata: AIFeatureResult<unknown>["metadata"] = {
    featureId: "chapter-metadata",
    providerId: "test-provider",
    model: "test-model",
    durationMs: 1,
  };

  describe("generateMetadata", () => {
    it("calls executeFeature with correct arguments", async () => {
      executeFeatureSpy.mockResolvedValue({
        success: true,
        data: { operation: "title", titleOptions: ["T1", "T2"] },
        metadata: mockMetadata,
      });

      await generateMetadata(mockPrompt, mockContext);

      expect(executeFeatureSpy).toHaveBeenCalledWith(
        "chapter-metadata",
        expect.objectContaining({
          chapterSegments: mockContext.chapterSegments,
        }),
        expect.objectContaining({
          customPrompt: {
            systemPrompt: mockPrompt.systemPrompt,
            userPromptTemplate: mockPrompt.userPromptTemplate,
          },
        }),
      );
    });

    it("validates operation type", async () => {
      const badPrompt: ChapterPrompt = { ...mockPrompt, operation: "rewrite" };
      await expect(generateMetadata(badPrompt, mockContext)).rejects.toThrow(
        'Prompt operation must be "metadata"',
      );
    });

    it("validates required prompts", async () => {
      const badPrompt = { ...mockPrompt, systemPrompt: "" };
      await expect(generateMetadata(badPrompt, mockContext)).rejects.toThrow(
        "Metadata prompts require systemPrompt",
      );
    });

    it("throws on AI failure", async () => {
      executeFeatureSpy.mockResolvedValue({
        success: false,
        error: "AI Error",
        metadata: mockMetadata,
      });
      await expect(generateMetadata(mockPrompt, mockContext)).rejects.toThrow("AI Error");
    });

    it("throws if required fields are missing for operation", async () => {
      // Prompt implies summary
      const summaryPrompt = { ...mockPrompt, name: "Generate Summary" };

      // AI returns title structure instead
      executeFeatureSpy.mockResolvedValue({
        success: true,
        data: { operation: "title", titleOptions: ["T1"] },
        metadata: mockMetadata,
      });

      // Expect error because we look for summary string
      await expect(generateMetadata(summaryPrompt, mockContext)).rejects.toThrow(
        "summary string is required for summary operation",
      );
    });
  });

  describe("suggestTitles", () => {
    it("returns title options on success", async () => {
      executeFeatureSpy.mockResolvedValue({
        success: true,
        data: { operation: "title", titleOptions: ["T1", "T2"] },
        metadata: mockMetadata,
      });

      const result = await suggestTitles(mockPrompt, mockContext);
      expect(result.options).toEqual(["T1", "T2"]);
    });

    it("throws if response is invalid", async () => {
      executeFeatureSpy.mockResolvedValue({
        success: true,
        data: { operation: "summary", summary: "S1" },
        metadata: mockMetadata,
      });

      // generateMetadata itself validates based on prompt name.
      // If mockPrompt implies Title, but we get Summary data (and operation='summary' in response),
      // generateMetadata will fallback to checking title requirements because it thinks we wanted a Title.
      // So it will throw 'titleOptions array is required'
      await expect(suggestTitles(mockPrompt, mockContext)).rejects.toThrow(
        "titleOptions array is required",
      );
    });
  });

  describe("generateSummary", () => {
    it("returns summary on success", async () => {
      const summaryPrompt = { ...mockPrompt, name: "Summary Generation" };
      executeFeatureSpy.mockResolvedValue({
        success: true,
        data: { operation: "summary", summary: "New Summary" },
        metadata: mockMetadata,
      });

      const result = await generateSummary(summaryPrompt, mockContext);
      expect(result.summary).toBe("New Summary");
    });
  });

  describe("generateNotes", () => {
    it("returns notes on success", async () => {
      const notesPrompt = { ...mockPrompt, name: "Notes Generation" };
      executeFeatureSpy.mockResolvedValue({
        success: true,
        data: { operation: "notes", notes: "My Notes" },
        metadata: mockMetadata,
      });

      const result = await generateNotes(notesPrompt, mockContext);
      expect(result.notes).toBe("My Notes");
    });
  });
});
