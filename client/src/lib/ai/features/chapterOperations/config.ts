import type { AIFeatureConfig, ResponseSchema } from "@/lib/ai/core/types";
import { BUILTIN_TITLE_SUGGESTION } from "./prompts";

// ==================== Response Schema ====================

/**
 * JSON Schema for chapter metadata response.
 * Covers all possible metadata operations (title, summary, notes).
 */
export const chapterMetadataResponseSchema: ResponseSchema = {
    type: "object",
    properties: {
        operation: {
            type: "string",
            enum: ["title", "summary", "notes"]
        },
        titleOptions: {
            type: "array",
            items: { type: "string" },
            optional: true
        },
        summary: {
            type: "string",
            optional: true
        },
        notes: {
            type: "string",
            optional: true
        }
    },
    required: ["operation"]
};

// ==================== Feature Configuration ====================

/**
 * Chapter metadata feature configuration.
 * Uses Title Suggestion as the default prompt configuration,
 * but service will override based on requested operation.
 */
export const chapterMetadataConfig: AIFeatureConfig = {
    id: "chapter-metadata",
    name: "Chapter Metadata",
    category: "metadata",

    // Default to Title Suggestion prompts as fallback
    systemPrompt: BUILTIN_TITLE_SUGGESTION.systemPrompt || "",
    userPromptTemplate: BUILTIN_TITLE_SUGGESTION.userPromptTemplate || "",

    batchable: false,
    streamable: false,
    defaultBatchSize: 1,

    icon: "wand-2",
    requiresConfirmation: false,

    availablePlaceholders: [
        "chapterTitle",
        "chapterSegments",
        "currentSummary",
        "summary"
    ],

    responseSchema: chapterMetadataResponseSchema
};
