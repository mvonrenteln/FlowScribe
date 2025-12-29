/**
 * AI Speaker Slice
 *
 * Zustand slice for managing AI speaker suggestion state, including
 * suggestions, processing status, configuration, and prompt templates.
 */

import type { StoreApi } from "zustand";
import {
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_USER_PROMPT_TEMPLATE,
    runAnalysis,
} from "@/lib/aiSpeakerService";
import type {
    AISpeakerConfig,
    AISpeakerSlice,
    AISpeakerSuggestion,
    PromptTemplate,
    TranscriptStore,
} from "../types";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

// ==================== Default Configuration ====================

const DEFAULT_TEMPLATE: PromptTemplate = {
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

// ==================== Initial State ====================

export const initialAISpeakerState = {
    aiSpeakerSuggestions: [] as AISpeakerSuggestion[],
    aiSpeakerIsProcessing: false,
    aiSpeakerProcessedCount: 0,
    aiSpeakerTotalToProcess: 0,
    aiSpeakerConfig: DEFAULT_AI_SPEAKER_CONFIG,
    aiSpeakerError: null as string | null,
    aiSpeakerAbortController: null as AbortController | null,
};

// ==================== Slice Implementation ====================

export const createAISpeakerSlice = (
    set: StoreSetter,
    get: StoreGetter,
): AISpeakerSlice => ({
    // Actions only - state is in InitialStoreState with aiSpeaker* prefix
    startAnalysis: (selectedSpeakers, excludeConfirmed) => {
        const state = get();

        // Cancel any existing analysis
        if (state.aiSpeakerAbortController) {
            state.aiSpeakerAbortController.abort();
        }

        const abortController = new AbortController();

        // Filter segments to get count
        const segmentsToAnalyze = state.segments.filter((segment) => {
            if (excludeConfirmed && segment.confirmed) return false;
            if (selectedSpeakers.length > 0) {
                return selectedSpeakers.some(
                    (s) => s.toLowerCase() === segment.speaker.toLowerCase(),
                );
            }
            return true;
        });

        set({
            aiSpeakerIsProcessing: true,
            aiSpeakerProcessedCount: 0,
            aiSpeakerTotalToProcess: segmentsToAnalyze.length,
            aiSpeakerError: null,
            aiSpeakerAbortController: abortController,
        });

        // Run analysis asynchronously
        runAnalysis({
            segments: state.segments,
            speakers: state.speakers.map((s) => s.name),
            config: state.aiSpeakerConfig,
            selectedSpeakers,
            excludeConfirmed,
            signal: abortController.signal,
            onProgress: (processed, total) => {
                set({
                    aiSpeakerProcessedCount: processed,
                    aiSpeakerTotalToProcess: total,
                });
            },
            onBatchComplete: (suggestions) => {
                const current = get().aiSpeakerSuggestions;
                set({
                    aiSpeakerSuggestions: [...current, ...suggestions],
                });
            },
            onError: (error) => {
                set({
                    aiSpeakerError: error.message,
                    aiSpeakerIsProcessing: false,
                });
            },
        }).finally(() => {
            // Only update if not aborted
            if (!abortController.signal.aborted) {
                set({ aiSpeakerIsProcessing: false });
            }
        });
    },

    cancelAnalysis: () => {
        const { aiSpeakerAbortController } = get();
        if (aiSpeakerAbortController) {
            aiSpeakerAbortController.abort();
        }
        // Keep existing suggestions, just stop processing
        set({
            aiSpeakerIsProcessing: false,
            aiSpeakerAbortController: null,
        });
    },

    addSuggestions: (suggestions) => {
        const current = get().aiSpeakerSuggestions;
        set({ aiSpeakerSuggestions: [...current, ...suggestions] });
    },

    acceptSuggestion: (segmentId) => {
        const { aiSpeakerSuggestions, segments, updateSegmentSpeaker } = get();
        const suggestion = aiSpeakerSuggestions.find((s) => s.segmentId === segmentId);

        if (suggestion) {
            // Update the segment speaker
            updateSegmentSpeaker(segmentId, suggestion.suggestedSpeaker);

            // Update suggestion status
            set({
                aiSpeakerSuggestions: aiSpeakerSuggestions.map((s) =>
                    s.segmentId === segmentId ? { ...s, status: "accepted" as const } : s,
                ),
            });
        }
    },

    rejectSuggestion: (segmentId) => {
        const { aiSpeakerSuggestions } = get();
        set({
            aiSpeakerSuggestions: aiSpeakerSuggestions.map((s) =>
                s.segmentId === segmentId ? { ...s, status: "rejected" as const } : s,
            ),
        });
    },

    clearSuggestions: () => {
        set({ aiSpeakerSuggestions: [] });
    },

    updateConfig: (config) => {
        const current = get().aiSpeakerConfig;
        set({ aiSpeakerConfig: { ...current, ...config } });
    },

    addTemplate: (template) => {
        const { aiSpeakerConfig } = get();
        const newTemplate: PromptTemplate = {
            ...template,
            id: crypto.randomUUID(),
        };
        set({
            aiSpeakerConfig: {
                ...aiSpeakerConfig,
                templates: [...aiSpeakerConfig.templates, newTemplate],
            },
        });
    },

    updateTemplate: (id, updates) => {
        const { aiSpeakerConfig } = get();
        set({
            aiSpeakerConfig: {
                ...aiSpeakerConfig,
                templates: aiSpeakerConfig.templates.map((t) =>
                    t.id === id ? { ...t, ...updates } : t,
                ),
            },
        });
    },

    deleteTemplate: (id) => {
        const { aiSpeakerConfig } = get();
        // Don't delete default template
        if (id === "default") return;

        const newTemplates = aiSpeakerConfig.templates.filter((t) => t.id !== id);
        const newActiveId =
            aiSpeakerConfig.activeTemplateId === id
                ? "default"
                : aiSpeakerConfig.activeTemplateId;

        set({
            aiSpeakerConfig: {
                ...aiSpeakerConfig,
                templates: newTemplates,
                activeTemplateId: newActiveId,
            },
        });
    },

    setActiveTemplate: (id) => {
        const { aiSpeakerConfig } = get();
        set({
            aiSpeakerConfig: {
                ...aiSpeakerConfig,
                activeTemplateId: id,
            },
        });
    },

    setProcessingProgress: (processed, total) => {
        set({
            aiSpeakerProcessedCount: processed,
            aiSpeakerTotalToProcess: total,
        });
    },

    setError: (error) => {
        set({ aiSpeakerError: error });
    },
});
