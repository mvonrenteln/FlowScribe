/**
 * AI Revision Slice
 *
 * Zustand slice for managing AI text revision state, including
 * suggestions, processing status, and template configuration.
 *
 * Follows the "Custom First" principle - users can create their own
 * templates, and configure which are shown in quick-access menu.
 */

import type { StoreApi } from "zustand";
import type { RevisionResult } from "@/lib/services/aiRevisionService";
import type {
  AIRevisionConfig,
  AIRevisionSlice,
  AIRevisionSuggestion,
  AIRevisionTemplate,
  TranscriptStore,
} from "../types";

type StoreSetter = StoreApi<TranscriptStore>["setState"];
type StoreGetter = StoreApi<TranscriptStore>["getState"];

// ==================== Default Templates (nicht löschbar, bearbeitbar) ====================

export const DEFAULT_REVISION_TEMPLATES: AIRevisionTemplate[] = [
  {
    id: "default-transcript-cleanup",
    name: "Transkript-Bereinigung",
    isDefault: true,
    isQuickAccess: true,
    systemPrompt: `Du bist ein Experte für Transkript-Korrektur. Deine Aufgabe ist es, gesprochenen Text zu bereinigen.

AUFGABEN:
- Korrigiere Rechtschreibfehler
- Korrigiere Grammatikfehler (z.B. "das" vs "dass")
- Entferne Füllwörter (ähm, äh, also, halt, sozusagen) nur wenn sie keinen Sinn tragen
- Korrigiere offensichtliche Transkriptionsfehler

WICHTIG:
- Behalte den originalen Stil und Ton bei
- Verändere NICHT den Inhalt oder die Bedeutung
- Behalte Dialekt und Umgangssprache bei, wenn beabsichtigt
- Wenn nichts zu korrigieren ist, gib den Text unverändert zurück`,
    userPromptTemplate: `Bereinige den folgenden Transkript-Text:

{{#if previousText}}
KONTEXT (vorheriges Segment, nicht verändern):
{{previousText}}
{{/if}}

ZU KORRIGIEREN:
{{text}}

{{#if nextText}}
KONTEXT (nächstes Segment, nicht verändern):
{{nextText}}
{{/if}}

Antworte NUR mit dem korrigierten Text, keine Erklärungen oder Anführungszeichen.`,
  },
  {
    id: "default-improve-clarity",
    name: "Formulierung verbessern",
    isDefault: true,
    isQuickAccess: true,
    systemPrompt: `Du bist ein Lektor. Deine Aufgabe ist es, Texte klarer und verständlicher zu formulieren.

AUFGABEN:
- Verbessere die Satzstruktur für bessere Lesbarkeit
- Vereinfache komplizierte Formulierungen
- Korrigiere Grammatik und Rechtschreibung
- Verbessere den Textfluss

WICHTIG:
- Behalte die Kernaussage und Bedeutung bei
- Der Stil sollte dem Original entsprechen
- Keine inhaltlichen Ergänzungen oder Interpretationen`,
    userPromptTemplate: `Verbessere die Formulierung des folgenden Textes für bessere Klarheit und Lesbarkeit:

{{#if previousText}}
KONTEXT (vorheriges Segment, nicht verändern):
{{previousText}}
{{/if}}

ZU VERBESSERN:
{{text}}

{{#if nextText}}
KONTEXT (nächstes Segment, nicht verändern):
{{nextText}}
{{/if}}

Antworte NUR mit dem verbesserten Text, keine Erklärungen oder Anführungszeichen.`,
  },
  {
    id: "default-formalize",
    name: "Formalisieren",
    isDefault: true,
    isQuickAccess: false,
    systemPrompt: `Du bist ein Experte für professionelle Kommunikation. Deine Aufgabe ist es, informelle Sprache in einen formellen Stil zu überführen.

AUFGABEN:
- Wandle Umgangssprache in Standardsprache um
- Ersetze informelle Ausdrücke durch formelle Entsprechungen
- Verbessere die Satzstruktur für einen professionellen Ton
- Korrigiere Grammatik und Rechtschreibung

WICHTIG:
- Behalte die Kernaussage und Bedeutung bei
- Nicht übertrieben förmlich - natürlich professionell`,
    userPromptTemplate: `Formuliere den folgenden Text in einen formelleren, professionelleren Stil um:

ZU FORMALISIEREN:
{{text}}

Antworte NUR mit dem formalisierten Text, keine Erklärungen oder Anführungszeichen.`,
  },
];

// ==================== Initial State ====================

export const initialAIRevisionState = {
  aiRevisionSuggestions: [] as AIRevisionSuggestion[],
  aiRevisionIsProcessing: false,
  aiRevisionProcessedCount: 0,
  aiRevisionTotalToProcess: 0,
  aiRevisionConfig: {
    templates: [...DEFAULT_REVISION_TEMPLATES],
    defaultTemplateId: "default-transcript-cleanup",
    quickAccessTemplateIds: ["default-transcript-cleanup", "default-improve-clarity"],
  } as AIRevisionConfig,
  aiRevisionError: null as string | null,
  aiRevisionAbortController: null as AbortController | null,
};

// ==================== Helper Functions ====================

function generateTemplateId(): string {
  return `template-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ==================== Slice Implementation ====================

export const createAIRevisionSlice = (set: StoreSetter, get: StoreGetter): AIRevisionSlice => ({
  // ==================== Revision Actions ====================

  startSingleRevision: (segmentId, templateId) => {
    const state = get();

    // Cancel any existing revision
    if (state.aiRevisionAbortController) {
      state.aiRevisionAbortController.abort();
    }

    const abortController = new AbortController();
    const segment = state.segments.find((s) => s.id === segmentId);

    if (!segment) {
      set({ aiRevisionError: `Segment ${segmentId} not found` });
      return;
    }

    const template = state.aiRevisionConfig.templates.find((t) => t.id === templateId);
    if (!template) {
      set({ aiRevisionError: `Template ${templateId} not found` });
      return;
    }

    set({
      aiRevisionIsProcessing: true,
      aiRevisionProcessedCount: 0,
      aiRevisionTotalToProcess: 1,
      aiRevisionError: null,
      aiRevisionAbortController: abortController,
    });

    // Find context segments
    const segmentIndex = state.segments.findIndex((s) => s.id === segmentId);
    const previousSegment = segmentIndex > 0 ? state.segments[segmentIndex - 1] : undefined;
    const nextSegment =
      segmentIndex < state.segments.length - 1 ? state.segments[segmentIndex + 1] : undefined;

    // Run revision asynchronously - dynamic import to avoid circular dependencies
    import("@/lib/services/aiRevisionService").then(({ runRevision }) => {
      runRevision({
        segment,
        template,
        previousSegment,
        nextSegment,
        signal: abortController.signal,
      })
        .then((result: RevisionResult) => {
          const currentState = get();
          if (!currentState.aiRevisionIsProcessing) return; // Cancelled

          const suggestion: AIRevisionSuggestion = {
            segmentId,
            templateId,
            originalText: segment.text,
            revisedText: result.revisedText,
            status: "pending",
            changes: result.changes,
            changeSummary: result.changeSummary,
            reasoning: result.reasoning,
          };

          set({
            aiRevisionSuggestions: [...currentState.aiRevisionSuggestions, suggestion],
            aiRevisionIsProcessing: false,
            aiRevisionProcessedCount: 1,
          });
        })
        .catch((error: Error) => {
          if (error.name === "AbortError") return;
          set({
            aiRevisionError: error.message ?? "Revision failed",
            aiRevisionIsProcessing: false,
          });
        });
    });
  },

  startBatchRevision: (segmentIds, templateId) => {
    const state = get();

    // Cancel any existing revision
    if (state.aiRevisionAbortController) {
      state.aiRevisionAbortController.abort();
    }

    const abortController = new AbortController();
    const segments = state.segments.filter((s) => segmentIds.includes(s.id));

    if (segments.length === 0) {
      set({ aiRevisionError: "No segments found" });
      return;
    }

    const template = state.aiRevisionConfig.templates.find((t) => t.id === templateId);
    if (!template) {
      set({ aiRevisionError: `Template ${templateId} not found` });
      return;
    }

    set({
      aiRevisionIsProcessing: true,
      aiRevisionProcessedCount: 0,
      aiRevisionTotalToProcess: segments.length,
      aiRevisionError: null,
      aiRevisionAbortController: abortController,
    });

    // Run batch revision asynchronously - dynamic import to avoid circular dependencies
    import("@/lib/services/aiRevisionService").then(({ runBatchRevision }) => {
      runBatchRevision({
        segments,
        allSegments: state.segments,
        template,
        signal: abortController.signal,
        onProgress: (processed: number, total: number) => {
          set({
            aiRevisionProcessedCount: processed,
            aiRevisionTotalToProcess: total,
          });
        },
        onResult: (result: RevisionResult) => {
          const currentState = get();
          if (!currentState.aiRevisionIsProcessing) return; // Cancelled

          const segment = segments.find((s) => s.id === result.segmentId);
          if (!segment) return;

          const suggestion: AIRevisionSuggestion = {
            segmentId: result.segmentId,
            templateId,
            originalText: segment.text,
            revisedText: result.revisedText,
            status: "pending",
            changes: result.changes,
            changeSummary: result.changeSummary,
            reasoning: result.reasoning,
          };

          set({
            aiRevisionSuggestions: [...currentState.aiRevisionSuggestions, suggestion],
          });
        },
      })
        .then(() => {
          set({ aiRevisionIsProcessing: false });
        })
        .catch((error: Error) => {
          if (error.name === "AbortError") return;
          set({
            aiRevisionError: error.message ?? "Batch revision failed",
            aiRevisionIsProcessing: false,
          });
        });
    });
  },

  cancelRevision: () => {
    const state = get();
    if (state.aiRevisionAbortController) {
      state.aiRevisionAbortController.abort();
    }
    set({
      aiRevisionIsProcessing: false,
      aiRevisionAbortController: null,
    });
  },

  acceptRevision: (segmentId) => {
    const state = get();
    const suggestion = state.aiRevisionSuggestions.find(
      (s) => s.segmentId === segmentId && s.status === "pending",
    );

    if (!suggestion) return;

    // Update segment text through the segments slice (includes history)
    state.updateSegmentText(segmentId, suggestion.revisedText);

    // Mark suggestion as accepted
    set({
      aiRevisionSuggestions: state.aiRevisionSuggestions.map((s) =>
        s.segmentId === segmentId && s.status === "pending" ? { ...s, status: "accepted" } : s,
      ),
    });
  },

  rejectRevision: (segmentId) => {
    const state = get();
    set({
      aiRevisionSuggestions: state.aiRevisionSuggestions.map((s) =>
        s.segmentId === segmentId && s.status === "pending" ? { ...s, status: "rejected" } : s,
      ),
    });
  },

  acceptAllRevisions: () => {
    const state = get();
    const pendingSuggestions = state.aiRevisionSuggestions.filter((s) => s.status === "pending");

    // Batch update all segment texts
    const updates = pendingSuggestions.map((s) => ({
      id: s.segmentId,
      text: s.revisedText,
    }));

    if (updates.length > 0) {
      state.updateSegmentsTexts(updates);
    }

    // Mark all as accepted
    set({
      aiRevisionSuggestions: state.aiRevisionSuggestions.map((s) =>
        s.status === "pending" ? { ...s, status: "accepted" } : s,
      ),
    });
  },

  rejectAllRevisions: () => {
    const state = get();
    set({
      aiRevisionSuggestions: state.aiRevisionSuggestions.map((s) =>
        s.status === "pending" ? { ...s, status: "rejected" } : s,
      ),
    });
  },

  clearRevisions: () => {
    set({
      aiRevisionSuggestions: [],
      aiRevisionError: null,
    });
  },

  // ==================== Template Management ====================

  addRevisionTemplate: (template) => {
    const state = get();
    const newTemplate: AIRevisionTemplate = {
      ...template,
      id: generateTemplateId(),
      isDefault: false, // Custom templates are never default
    };

    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        templates: [...state.aiRevisionConfig.templates, newTemplate],
      },
    });
  },

  updateRevisionTemplate: (id, updates) => {
    const state = get();
    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        templates: state.aiRevisionConfig.templates.map((t) =>
          t.id === id ? { ...t, ...updates, id, isDefault: t.isDefault } : t,
        ),
      },
    });
  },

  deleteRevisionTemplate: (id) => {
    const state = get();
    const template = state.aiRevisionConfig.templates.find((t) => t.id === id);

    // Cannot delete default templates
    if (template?.isDefault) {
      console.warn("[AIRevision] Cannot delete default template:", id);
      return;
    }

    const updatedTemplates = state.aiRevisionConfig.templates.filter((t) => t.id !== id);
    const updatedQuickAccess = state.aiRevisionConfig.quickAccessTemplateIds.filter(
      (tid) => tid !== id,
    );

    // If deleted template was the default, reset to first available
    let newDefaultId = state.aiRevisionConfig.defaultTemplateId;
    if (newDefaultId === id) {
      newDefaultId = updatedTemplates[0]?.id ?? null;
    }

    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        templates: updatedTemplates,
        quickAccessTemplateIds: updatedQuickAccess,
        defaultTemplateId: newDefaultId,
      },
    });
  },

  setDefaultRevisionTemplate: (id) => {
    const state = get();
    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        defaultTemplateId: id,
      },
    });
  },

  setQuickAccessTemplates: (ids) => {
    const state = get();
    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        quickAccessTemplateIds: ids,
      },
    });
  },

  toggleQuickAccessTemplate: (id) => {
    const state = get();
    const currentIds = state.aiRevisionConfig.quickAccessTemplateIds;
    const newIds = currentIds.includes(id)
      ? currentIds.filter((tid) => tid !== id)
      : [...currentIds, id];

    set({
      aiRevisionConfig: {
        ...state.aiRevisionConfig,
        quickAccessTemplateIds: newIds,
      },
    });
  },
});

