import { describe, expect, it } from "vitest";
import type { AIChapterDetectionConfig, AIPrompt } from "../../types";
import {
  DEFAULT_CHAPTER_DETECTION_PROMPT,
  normalizeAIChapterDetectionConfig,
} from "../aiChapterDetectionConfig";
import {
  BUILTIN_NOTES_GENERATION_ID,
  BUILTIN_SUMMARY_GENERATION_ID,
  BUILTIN_TITLE_SUGGESTION_ID,
} from "../chapterMetadataPrompts";

const makeCustomPrompt = (overrides: Partial<AIPrompt> = {}): AIPrompt => ({
  id: "custom-chapter-prompt",
  name: "Custom Chapter Prompt",
  type: "chapter-detect",
  systemPrompt: "Custom system prompt",
  userPromptTemplate: "Custom user prompt: {{segments}}",
  isBuiltIn: false,
  isDefault: false,
  quickAccess: false,
  ...overrides,
});

describe("normalizeAIChapterDetectionConfig", () => {
  it("returns defaults when config is missing", () => {
    const result = normalizeAIChapterDetectionConfig(null);
    expect(result.prompts.find((p) => p.id === DEFAULT_CHAPTER_DETECTION_PROMPT.id)).toBeTruthy();
    expect(result.activePromptId).toBe(DEFAULT_CHAPTER_DETECTION_PROMPT.id);
  });

  it("preserves custom prompts and built-in edits", () => {
    const editedBuiltIn: AIPrompt = {
      ...DEFAULT_CHAPTER_DETECTION_PROMPT,
      systemPrompt: "Edited built-in system prompt",
    };
    const customPrompt = makeCustomPrompt({ id: "custom-1" });
    const config: AIChapterDetectionConfig = {
      batchSize: 25,
      minChapterLength: 5,
      maxChapterLength: 40,
      tagIds: [],
      prompts: [editedBuiltIn, customPrompt],
      activePromptId: "custom-1",
    };

    const result = normalizeAIChapterDetectionConfig(config);
    const resolvedBuiltIn = result.prompts.find(
      (p) => p.id === DEFAULT_CHAPTER_DETECTION_PROMPT.id,
    );
    expect(result.prompts.find((p) => p.id === "custom-1")).toBeTruthy();
    expect(resolvedBuiltIn?.systemPrompt).toBe("Edited built-in system prompt");
    expect(result.prompts.every((p) => p.type === "chapter-detect")).toBe(true);
    expect(result.activePromptId).toBe("custom-1");
  });

  it("keeps only the fixed metadata prompts", () => {
    const customMetadataPrompt = makeCustomPrompt({
      id: "custom-metadata",
      operation: "metadata",
      metadataType: "summary",
    });
    const config: AIChapterDetectionConfig = {
      batchSize: 25,
      minChapterLength: 5,
      maxChapterLength: 40,
      tagIds: [],
      prompts: [customMetadataPrompt],
      activePromptId: DEFAULT_CHAPTER_DETECTION_PROMPT.id,
      includeContext: true,
      contextWordLimit: 500,
    };

    const result = normalizeAIChapterDetectionConfig(config);
    const metadataIds = new Set(
      result.prompts.filter((p) => p.operation === "metadata").map((p) => p.id),
    );
    expect(metadataIds).toEqual(
      new Set([
        BUILTIN_TITLE_SUGGESTION_ID,
        BUILTIN_SUMMARY_GENERATION_ID,
        BUILTIN_NOTES_GENERATION_ID,
      ]),
    );
    expect(metadataIds.has("custom-metadata")).toBe(false);
  });
});
