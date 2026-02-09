import type { AIPrompt, PromptType } from "../types";
import type { PromptExportItem } from "./aiPromptExport";

export type PromptImportPlan = {
  updates: Array<{ id: string; type: PromptType; updates: Partial<AIPrompt> }>;
  creates: Array<{ type: PromptType; data: Omit<AIPrompt, "id"> }>;
};

const allowedTypes: PromptType[] = ["speaker", "text", "segment-merge", "chapter-detect"];

const isPromptType = (value: unknown): value is PromptType =>
  typeof value === "string" && allowedTypes.includes(value as PromptType);

const toUpdates = (item: PromptExportItem): Partial<AIPrompt> => ({
  name: item.name,
  systemPrompt: item.systemPrompt,
  userPromptTemplate: item.userPromptTemplate,
  quickAccess: item.quickAccess,
  isBuiltIn: item.isBuiltIn,
  operation: item.operation,
  metadataType: item.metadataType,
});

/**
 * Build import operations by matching prompts by name (per type).
 * - If name exists: update that prompt.
 * - If name missing: create new prompt.
 */
export const buildPromptImportPlan = (
  existingByType: Record<PromptType, AIPrompt[]>,
  items: PromptExportItem[],
): PromptImportPlan => {
  const nameToExisting = new Map<PromptType, Map<string, AIPrompt>>();

  for (const type of allowedTypes) {
    const byName = new Map<string, AIPrompt>();
    for (const prompt of existingByType[type]) {
      if (!byName.has(prompt.name)) {
        byName.set(prompt.name, prompt);
      }
    }
    nameToExisting.set(type, byName);
  }

  const updates: PromptImportPlan["updates"] = [];
  const creates: PromptImportPlan["creates"] = [];

  for (const item of items) {
    if (!isPromptType(item.type)) continue;
    if (item.type === "chapter-detect" && item.operation === "metadata") {
      const metadataPrompts = existingByType["chapter-detect"].filter(
        (prompt) => prompt.operation === "metadata",
      );
      const existing =
        (item.metadataType
          ? metadataPrompts.find((prompt) => prompt.metadataType === item.metadataType)
          : metadataPrompts.find((prompt) => prompt.name === item.name)) ?? null;

      if (existing) {
        updates.push({
          id: existing.id,
          type: item.type,
          updates: toUpdates(item),
        });
      }
      continue;
    }

    const existing = nameToExisting.get(item.type)?.get(item.name);
    if (existing) {
      updates.push({
        id: existing.id,
        type: item.type,
        updates: toUpdates(item),
      });
      continue;
    }
    if (item.type === "chapter-detect" && item.operation === "metadata") {
      continue;
    }
    creates.push({
      type: item.type,
      data: {
        name: item.name,
        type: item.type,
        systemPrompt: item.systemPrompt,
        userPromptTemplate: item.userPromptTemplate,
        isBuiltIn: false,
        isDefault: false,
        quickAccess: Boolean(item.quickAccess),
        operation: item.operation,
        metadataType: item.metadataType,
      },
    });
  }

  return { updates, creates };
};
