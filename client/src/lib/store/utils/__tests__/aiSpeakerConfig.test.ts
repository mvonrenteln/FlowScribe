import { describe, expect, it } from "vitest";
import type { AIPrompt } from "../../types";
import { normalizeAISpeakerConfig } from "../aiSpeakerConfig";

describe("normalizeAISpeakerConfig", () => {
  it("repairs missing prompt types", () => {
    const customPrompt = {
      id: "custom-speaker",
      name: "Custom Speaker",
      systemPrompt: "System",
      userPromptTemplate: "User",
      isBuiltIn: false,
      isDefault: false,
      quickAccess: false,
    } as AIPrompt;

    const result = normalizeAISpeakerConfig({
      prompts: [customPrompt],
      activePromptId: "custom-speaker",
    });

    const prompt = result.prompts.find((p) => p.id === "custom-speaker");
    expect(prompt?.type).toBe("speaker");
  });
});
