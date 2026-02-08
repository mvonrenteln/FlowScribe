import {
  CHAPTER_DETECTION_SYSTEM_PROMPT,
  CHAPTER_DETECTION_USER_PROMPT_TEMPLATE,
} from "@/lib/ai/features/chapterDetection";
import { indexById } from "@/lib/arrayUtils";
import type { AIChapterDetectionConfig, AIPrompt, PersistedGlobalState } from "../types";
import { BUILTIN_METADATA_PROMPTS, BUILTIN_PROMPT_IDS } from "./chapterMetadataPrompts";

export const DEFAULT_CHAPTER_DETECTION_PROMPT: AIPrompt = {
  id: "builtin-chapter-detect-default",
  name: "Chapter Detection (Default)",
  type: "chapter-detect",
  systemPrompt: CHAPTER_DETECTION_SYSTEM_PROMPT,
  userPromptTemplate: CHAPTER_DETECTION_USER_PROMPT_TEMPLATE,
  isBuiltIn: true,
  isDefault: true,
  quickAccess: false,
};

export const DEFAULT_AI_CHAPTER_DETECTION_CONFIG: AIChapterDetectionConfig = {
  batchSize: 100,
  minChapterLength: 10,
  maxChapterLength: 80,
  tagIds: [],
  prompts: [DEFAULT_CHAPTER_DETECTION_PROMPT, ...BUILTIN_METADATA_PROMPTS],
  activePromptId: DEFAULT_CHAPTER_DETECTION_PROMPT.id,
};

const normalizePrompt = (prompt: AIPrompt): AIPrompt => ({
  ...prompt,
  type: "chapter-detect",
  isBuiltIn: prompt.id === DEFAULT_CHAPTER_DETECTION_PROMPT.id || BUILTIN_PROMPT_IDS.has(prompt.id),
  isDefault:
    prompt.id === DEFAULT_CHAPTER_DETECTION_PROMPT.id ? true : Boolean(prompt.isDefault ?? false),
});

const normalizePrompts = (prompts: AIPrompt[]) => prompts.map((p) => normalizePrompt(p));

const ensureBuiltInPrompts = (prompts: AIPrompt[]) => {
  const normalized = normalizePrompts(
    prompts.length ? prompts : DEFAULT_AI_CHAPTER_DETECTION_CONFIG.prompts,
  );

  const indexMap = indexById(normalized);
  const allBuiltins = [DEFAULT_CHAPTER_DETECTION_PROMPT, ...BUILTIN_METADATA_PROMPTS];

  // Ensure all built-in prompts are present
  for (const builtIn of allBuiltins) {
    const existingIndex = indexMap.get(builtIn.id) ?? -1;
    if (existingIndex === -1) {
      normalized.push({ ...builtIn });
    } else {
      normalized[existingIndex] = {
        ...normalized[existingIndex],
        isBuiltIn: true,
        type: "chapter-detect",
        // Only set isDefault for the detection prompt
        ...(builtIn.id === DEFAULT_CHAPTER_DETECTION_PROMPT.id && { isDefault: true }),
      };
    }
  }

  return normalized;
};

const getPromptsFromConfig = (
  config?: PersistedGlobalState["aiChapterDetectionConfig"],
): AIPrompt[] | undefined => (Array.isArray(config?.prompts) ? config.prompts : undefined);

/**
 * Normalize persisted chapter detection config by restoring defaults and preserving custom prompts.
 */
export const normalizeAIChapterDetectionConfig = (
  config?: PersistedGlobalState["aiChapterDetectionConfig"],
): AIChapterDetectionConfig => {
  const base = DEFAULT_AI_CHAPTER_DETECTION_CONFIG;
  const prompts = ensureBuiltInPrompts(getPromptsFromConfig(config) ?? base.prompts);
  const activePromptId = prompts.some(
    (p) => p.id === (config?.activePromptId ?? base.activePromptId),
  )
    ? (config?.activePromptId ?? base.activePromptId)
    : DEFAULT_CHAPTER_DETECTION_PROMPT.id;

  return {
    batchSize: typeof config?.batchSize === "number" ? config.batchSize : base.batchSize,
    minChapterLength:
      typeof config?.minChapterLength === "number"
        ? config.minChapterLength
        : base.minChapterLength,
    maxChapterLength:
      typeof config?.maxChapterLength === "number"
        ? config.maxChapterLength
        : base.maxChapterLength,
    tagIds: Array.isArray(config?.tagIds) ? config.tagIds.map((t) => String(t)) : base.tagIds,
    selectedProviderId: config?.selectedProviderId,
    selectedModel: config?.selectedModel,
    prompts,
    activePromptId,
  };
};
