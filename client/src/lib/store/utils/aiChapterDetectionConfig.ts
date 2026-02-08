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
  includeContext: true,
  contextWordLimit: 500,
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
  persistedRewrites?: PersistedGlobalState["rewritePrompts"],
  persistedRewriteConfig?: PersistedGlobalState["rewriteConfig"],
): AIChapterDetectionConfig => {
  const base = DEFAULT_AI_CHAPTER_DETECTION_CONFIG;

  // Combine existing chapter prompts with migrated rewrite prompts
  let initialPrompts = getPromptsFromConfig(config) ?? base.prompts;

  if (persistedRewrites?.length) {
    const existingIds = new Set(initialPrompts.map((p) => p.id));
    const migratedRewrites = persistedRewrites
      .filter((p) => !existingIds.has(p.id))
      .map(
        (p) =>
          ({
            ...p,
            type: "chapter-detect" as const,
            operation: "rewrite" as const,
            systemPrompt: "",
            userPromptTemplate: "",
            isBuiltIn: p.isBuiltin ?? false,
            quickAccess: false,
          }) as AIPrompt,
      );
    initialPrompts = [...initialPrompts, ...migratedRewrites];
  }

  const prompts = ensureBuiltInPrompts(initialPrompts);
  const activePromptId = prompts.some(
    (p) => p.id === (config?.activePromptId ?? base.activePromptId),
  )
    ? (config?.activePromptId ?? base.activePromptId)
    : config?.activePromptId || DEFAULT_CHAPTER_DETECTION_PROMPT.id;

  // Migrate rewrite config if available
  const includeContext =
    typeof config?.includeContext === "boolean"
      ? config.includeContext
      : typeof persistedRewriteConfig?.includeContext === "boolean"
        ? persistedRewriteConfig.includeContext
        : true;

  const contextWordLimit =
    typeof config?.contextWordLimit === "number"
      ? config.contextWordLimit
      : typeof persistedRewriteConfig?.contextWordLimit === "number"
        ? persistedRewriteConfig.contextWordLimit
        : 500;

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
    includeContext,
    contextWordLimit,
  };
};
