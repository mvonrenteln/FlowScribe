import { describe, expect, it } from "vitest";
import type { AIChapterDetectionConfig, AIPrompt } from "../../types";
import {
  DEFAULT_CHAPTER_DETECTION_PROMPT,
  normalizeAIChapterDetectionConfig,
} from "../aiChapterDetectionConfig";

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

  it("migrates legacy templates arrays into prompts", () => {
    const legacyPrompt = makeCustomPrompt({
      id: "legacy-custom",
      type: "text",
    });
    const legacyConfig = {
      batchSize: 12,
      minChapterLength: 3,
      maxChapterLength: 50,
      tagIds: [],
      templates: [legacyPrompt],
      activePromptId: "legacy-custom",
    } as unknown as AIChapterDetectionConfig;

    const result = normalizeAIChapterDetectionConfig(legacyConfig);
    const migrated = result.prompts.find((p) => p.id === "legacy-custom");
    expect(migrated).toBeTruthy();
    expect(migrated?.type).toBe("chapter-detect");
  });
});
