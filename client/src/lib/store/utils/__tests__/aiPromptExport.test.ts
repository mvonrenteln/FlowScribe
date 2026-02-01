import { describe, expect, it } from "vitest";
import type { AIPrompt } from "../../types";
import { buildPromptExportData } from "../aiPromptExport";

describe("buildPromptExportData", () => {
  it("exports using the prompts array format only", () => {
    const prompts: AIPrompt[] = [
      {
        id: "p-1",
        name: "Speaker Prompt",
        type: "speaker",
        systemPrompt: "System",
        userPromptTemplate: "User",
        isBuiltIn: true,
        isDefault: true,
        quickAccess: false,
      },
    ];

    const result = buildPromptExportData(prompts);
    expect(result.version).toBe(1);
    expect(result.prompts).toHaveLength(1);
    expect(result).not.toHaveProperty("templates");
    expect(result.prompts[0]?.type).toBe("speaker");
  });
});
