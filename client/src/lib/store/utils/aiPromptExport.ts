import type { AIPrompt, PromptType } from "../types";

export interface PromptExportItem {
  name: string;
  type: PromptType;
  systemPrompt: string;
  userPromptTemplate: string;
  isBuiltIn?: boolean;
  quickAccess?: boolean;
}

export interface PromptExportData {
  version: 1;
  prompts: PromptExportItem[];
}

const toExportItem = (prompt: AIPrompt): PromptExportItem => ({
  name: prompt.name,
  type: prompt.type,
  systemPrompt: prompt.systemPrompt,
  userPromptTemplate: prompt.userPromptTemplate,
  isBuiltIn: prompt.isBuiltIn,
  quickAccess: prompt.quickAccess,
});

/**
 * Build export payload for AI prompt templates.
 * Always uses the new `prompts` array format so re-imports are stable.
 */
export const buildPromptExportData = (prompts: AIPrompt[]): PromptExportData => ({
  version: 1,
  prompts: prompts.map((prompt) => toExportItem(prompt)),
});
