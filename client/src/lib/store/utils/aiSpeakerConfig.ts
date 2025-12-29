import {
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_USER_PROMPT_TEMPLATE,
} from "@/lib/aiSpeakerService";
import type { AISpeakerConfig, PromptTemplate } from "../types";

export const DEFAULT_TEMPLATE: PromptTemplate = {
    id: "default",
    name: "RPG Transcript Classifier",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
    isDefault: true,
};

export const DEFAULT_AI_SPEAKER_CONFIG: AISpeakerConfig = {
    ollamaUrl: "http://localhost:11434",
    model: "llama3.2",
    batchSize: 10,
    templates: [DEFAULT_TEMPLATE],
    activeTemplateId: "default",
};

const cloneTemplates = (templates: PromptTemplate[]) => templates.map((t) => ({ ...t }));

const ensureDefaultTemplate = (templates: PromptTemplate[]) => {
    const normalized = cloneTemplates(templates.length ? templates : DEFAULT_AI_SPEAKER_CONFIG.templates);
    if (!normalized.some((t) => t.isDefault)) {
        normalized.unshift({ ...DEFAULT_TEMPLATE });
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

    const templates = ensureDefaultTemplate(config?.templates ?? base.templates);
    const activeTemplateId = templates.some((t) => t.id === base.activeTemplateId)
        ? base.activeTemplateId
        : templates.find((t) => t.isDefault)?.id ?? templates[0].id;

    return {
        ...base,
        templates,
        activeTemplateId,
    };
};

