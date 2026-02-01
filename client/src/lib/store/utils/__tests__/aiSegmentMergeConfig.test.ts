import { describe, expect, it } from "vitest";
import type { AIPrompt } from "../../types";
import { normalizeAISegmentMergeConfig } from "../aiSegmentMergeConfig";

describe("normalizeAISegmentMergeConfig", () => {
  it("repairs missing prompt types", () => {
    const customPrompt = {
      id: "custom-merge",
      name: "Custom Merge",
      systemPrompt: "System",
      userPromptTemplate: "User",
      isBuiltIn: false,
      isDefault: false,
      quickAccess: false,
    } as AIPrompt;

    const result = normalizeAISegmentMergeConfig({
      prompts: [customPrompt],
      activePromptId: "custom-merge",
    });

    const prompt = result.prompts.find((p) => p.id === "custom-merge");
    expect(prompt?.type).toBe("segment-merge");
  });
});
