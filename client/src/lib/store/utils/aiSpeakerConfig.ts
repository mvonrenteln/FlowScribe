import {
  SPEAKER_SYSTEM_PROMPT as DEFAULT_SYSTEM_PROMPT,
  SPEAKER_USER_PROMPT_TEMPLATE as DEFAULT_USER_PROMPT_TEMPLATE,
} from "@/lib/ai/features/speaker";
import type { AIPrompt, AISpeakerConfig } from "../types";

export const DEFAULT_SPEAKER_PROMPT: AIPrompt = {
  id: "builtin-speaker-default",
  name: "RPG Transcript Classifier",
  type: "speaker",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
  isBuiltIn: true,
  isDefault: true,
  quickAccess: true,
};

export const DEFAULT_AI_SPEAKER_CONFIG: AISpeakerConfig = {
  ollamaUrl: "http://localhost:11434",
  model: "llama3.2",
  batchSize: 10,
  prompts: [DEFAULT_SPEAKER_PROMPT],
  activePromptId: "builtin-speaker-default",
};

const normalizePrompt = (prompt: AIPrompt): AIPrompt => ({
  ...prompt,
  type: "speaker",
  isBuiltIn: prompt.id === DEFAULT_SPEAKER_PROMPT.id,
  isDefault: prompt.id === DEFAULT_SPEAKER_PROMPT.id ? true : Boolean(prompt.isDefault ?? false),
});

const normalizePrompts = (prompts: AIPrompt[]) => prompts.map((p) => normalizePrompt(p));

const ensureBuiltInPrompt = (prompts: AIPrompt[]) => {
  const normalized = normalizePrompts(prompts.length ? prompts : DEFAULT_AI_SPEAKER_CONFIG.prompts);
  const builtInIndex = normalized.findIndex((p) => p.id === DEFAULT_SPEAKER_PROMPT.id);
  if (builtInIndex === -1) {
    normalized.unshift({ ...DEFAULT_SPEAKER_PROMPT });
    return normalized;
  }
  normalized[builtInIndex] = {
    ...normalized[builtInIndex],
    isBuiltIn: true,
    isDefault: true,
    type: "speaker",
  };
  return normalized;
};

export const normalizeAISpeakerConfig = (
  config?: Partial<AISpeakerConfig> | null,
): AISpeakerConfig => {
  const base = {
    ...DEFAULT_AI_SPEAKER_CONFIG,
    ...config,
  };

  const prompts = ensureBuiltInPrompt(config?.prompts ?? base.prompts);
  const activePromptId = prompts.some((p) => p.id === base.activePromptId)
    ? base.activePromptId
    : (prompts.find((p) => p.isBuiltIn)?.id ?? prompts[0].id);

  return {
    ...base,
    prompts,
    activePromptId,
  };
};
