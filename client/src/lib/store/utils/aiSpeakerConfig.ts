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

const clonePrompts = (prompts: AIPrompt[]) => prompts.map((p) => ({ ...p }));

const ensureBuiltInPrompt = (prompts: AIPrompt[]) => {
  const normalized = clonePrompts(prompts.length ? prompts : DEFAULT_AI_SPEAKER_CONFIG.prompts);
  if (!normalized.some((p) => p.isBuiltIn && p.type === "speaker")) {
    normalized.unshift({ ...DEFAULT_SPEAKER_PROMPT });
  }
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
