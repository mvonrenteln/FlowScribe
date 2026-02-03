import {
  MERGE_ANALYSIS_SYSTEM_PROMPT as DEFAULT_SYSTEM_PROMPT,
  MERGE_ANALYSIS_USER_TEMPLATE as DEFAULT_USER_PROMPT_TEMPLATE,
} from "@/lib/ai/features/segmentMerge/config";
import { indexById } from "@/lib/arrayUtils";
import type { AIPrompt, AISegmentMergeConfig } from "../types";

export const DEFAULT_SEGMENT_MERGE_PROMPT: AIPrompt = {
  id: "builtin-segment-merge-default",
  name: "Default Merge Analysis",
  type: "segment-merge",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
  isBuiltIn: true,
  isDefault: true,
  quickAccess: false,
};

export const DEFAULT_AI_SEGMENT_MERGE_CONFIG: AISegmentMergeConfig = {
  defaultMaxTimeGap: 2,
  defaultMinConfidence: "medium",
  defaultEnableSmoothing: true,
  showInlineHints: true,
  batchSize: 20,
  prompts: [DEFAULT_SEGMENT_MERGE_PROMPT],
  activePromptId: "builtin-segment-merge-default",
};

const normalizePrompt = (prompt: AIPrompt): AIPrompt => ({
  ...prompt,
  type: "segment-merge",
  isBuiltIn: prompt.id === DEFAULT_SEGMENT_MERGE_PROMPT.id,
  isDefault:
    prompt.id === DEFAULT_SEGMENT_MERGE_PROMPT.id ? true : Boolean(prompt.isDefault ?? false),
});

const normalizePrompts = (prompts: AIPrompt[]) => prompts.map((p) => normalizePrompt(p));

const ensureBuiltInPrompt = (prompts: AIPrompt[]) => {
  const normalized = normalizePrompts(
    prompts.length ? prompts : DEFAULT_AI_SEGMENT_MERGE_CONFIG.prompts,
  );
  const builtInIndex = indexById(normalized).get(DEFAULT_SEGMENT_MERGE_PROMPT.id) ?? -1;
  if (builtInIndex === -1) {
    normalized.unshift({ ...DEFAULT_SEGMENT_MERGE_PROMPT });
    return normalized;
  }
  normalized[builtInIndex] = {
    ...normalized[builtInIndex],
    isBuiltIn: true,
    isDefault: true,
    type: "segment-merge",
  };
  return normalized;
};

export const normalizeAISegmentMergeConfig = (
  config?: Partial<AISegmentMergeConfig> | null,
): AISegmentMergeConfig => {
  const base = {
    ...DEFAULT_AI_SEGMENT_MERGE_CONFIG,
    ...config,
  };

  const prompts = ensureBuiltInPrompt(config?.prompts ?? base.prompts);
  const activePromptId = prompts.some((p) => p.id === base.activePromptId)
    ? base.activePromptId
    : (prompts.find((p) => p.isBuiltIn)?.id ?? prompts[0].id);

  return {
    ...base,
    showInlineHints: true,
    prompts,
    activePromptId,
  };
};
