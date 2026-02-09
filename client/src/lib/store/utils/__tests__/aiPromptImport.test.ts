import { describe, expect, it } from "vitest";
import type { AIPrompt, PromptType } from "../../types";
import { buildPromptExportData } from "../aiPromptExport";
import { buildPromptImportPlan } from "../aiPromptImport";

const makePrompt = (overrides: Partial<AIPrompt> = {}): AIPrompt => ({
  id: "prompt-1",
  name: "Prompt",
  type: "text",
  systemPrompt: "System",
  userPromptTemplate: "User",
  isBuiltIn: false,
  isDefault: false,
  quickAccess: false,
  ...overrides,
});

const emptyByType = (): Record<PromptType, AIPrompt[]> => ({
  speaker: [],
  text: [],
  "segment-merge": [],
  "chapter-detect": [],
});

describe("buildPromptImportPlan", () => {
  it("updates when a name match exists (including built-ins)", () => {
    const existing = emptyByType();
    existing["chapter-detect"] = [
      makePrompt({
        id: "builtin-chapter",
        name: "Chapter Detection (Default)",
        type: "chapter-detect",
        isBuiltIn: true,
      }),
    ];

    const items = [
      {
        name: "Chapter Detection (Default)",
        type: "chapter-detect" as const,
        systemPrompt: "Updated system",
        userPromptTemplate: "Updated user",
        isBuiltIn: true,
        quickAccess: false,
      },
    ];

    const plan = buildPromptImportPlan(existing, items);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]?.id).toBe("builtin-chapter");
    expect(plan.updates[0]?.updates.systemPrompt).toBe("Updated system");
  });

  it("creates new prompts when name is missing", () => {
    const existing = emptyByType();
    existing.text = [makePrompt({ id: "existing", name: "Existing" })];

    const items = [
      {
        name: "New Prompt",
        type: "text" as const,
        systemPrompt: "System",
        userPromptTemplate: "User",
        isBuiltIn: false,
        quickAccess: true,
      },
    ];

    const plan = buildPromptImportPlan(existing, items);
    expect(plan.updates).toHaveLength(0);
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0]?.data.name).toBe("New Prompt");
    expect(plan.creates[0]?.data.quickAccess).toBe(true);
  });

  it("updates metadata prompts by metadataType and skips creation", () => {
    const existing = emptyByType();
    existing["chapter-detect"] = [
      makePrompt({
        id: "builtin-title",
        name: "Title Suggestion",
        type: "chapter-detect",
        operation: "metadata",
        metadataType: "title",
        isBuiltIn: true,
      }),
    ];

    const items = [
      {
        name: "Custom Title Prompt",
        type: "chapter-detect" as const,
        operation: "metadata" as const,
        metadataType: "title" as const,
        systemPrompt: "Updated system",
        userPromptTemplate: "Updated user",
        isBuiltIn: true,
        quickAccess: false,
      },
      {
        name: "Notes Prompt",
        type: "chapter-detect" as const,
        operation: "metadata" as const,
        metadataType: "notes" as const,
        systemPrompt: "System",
        userPromptTemplate: "User",
        isBuiltIn: true,
        quickAccess: false,
      },
    ];

    const plan = buildPromptImportPlan(existing, items);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]?.id).toBe("builtin-title");
    expect(plan.creates).toHaveLength(0);
  });

  it("roundtrips export without creating duplicates", () => {
    const existing = emptyByType();
    existing.speaker = [
      makePrompt({
        id: "speaker-1",
        name: "Speaker Default",
        type: "speaker",
        systemPrompt: "System A",
        userPromptTemplate: "User A",
      }),
    ];
    existing.text = [
      makePrompt({
        id: "text-1",
        name: "Text Default",
        type: "text",
        systemPrompt: "System B",
        userPromptTemplate: "User B",
      }),
    ];

    const exportData = buildPromptExportData([...existing.speaker, ...existing.text]);
    const plan = buildPromptImportPlan(existing, exportData.prompts);

    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(2);
  });

  it("preserves rewrite scope when importing chapter rewrite prompts", () => {
    const existing = emptyByType();

    const items = [
      {
        name: "Paragraph Refine",
        type: "chapter-detect" as const,
        operation: "rewrite" as const,
        rewriteScope: "paragraph" as const,
        systemPrompt: "System",
        userPromptTemplate: "User",
        isBuiltIn: false,
        quickAccess: false,
      },
    ];

    const plan = buildPromptImportPlan(existing, items);
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0]?.data.rewriteScope).toBe("paragraph");
  });
});
