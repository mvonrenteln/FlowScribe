/**
 * AI Revision Service
 *
 * Service for revising transcript segments using AI.
 * Uses the unified AI Provider interface for backend communication.
 */

import { computeTextChanges, summarizeChanges } from "@/lib/diffUtils";
import { initializeSettings } from "@/lib/settings/settingsStorage";
import type { AIRevisionTemplate, Segment, TextChange } from "@/lib/store/types";
import { createAIProvider } from "./aiProviderService";
import type { AIProviderConfig } from "./aiProviderTypes";

// ==================== Types ====================

export interface RevisionResult {
  segmentId: string;
  revisedText: string;
  changes: TextChange[];
  changeSummary?: string;
  reasoning?: string;
}

export interface SingleRevisionParams {
  segment: Segment;
  prompt: AIRevisionTemplate;
  previousSegment?: Segment;
  nextSegment?: Segment;
  signal?: AbortSignal;
}

export interface BatchRevisionParams {
  segments: Segment[];
  allSegments: Segment[];
  prompt: AIRevisionTemplate;
  signal?: AbortSignal;
  onProgress?: (processed: number, total: number) => void;
  onResult?: (result: RevisionResult) => void;
}

// ==================== Prompt Building ====================

/**
 * Build the prompt from template with context substitution.
 */
function buildPrompt(
  template: string,
  context: {
    text: string;
    previousText?: string;
    nextText?: string;
    speaker?: string;
  },
): string {
  let result = template;

  // Simple template substitution (Handlebars-like)
  result = result.replace(/\{\{text\}\}/g, context.text);

  // Handle conditional blocks for previousText
  if (context.previousText) {
    result = result.replace(/\{\{#if previousText\}\}([\s\S]*?)\{\{\/if\}\}/g, "$1");
    result = result.replace(/\{\{previousText\}\}/g, context.previousText);
  } else {
    result = result.replace(/\{\{#if previousText\}\}[\s\S]*?\{\{\/if\}\}/g, "");
  }

  // Handle conditional blocks for nextText
  if (context.nextText) {
    result = result.replace(/\{\{#if nextText\}\}([\s\S]*?)\{\{\/if\}\}/g, "$1");
    result = result.replace(/\{\{nextText\}\}/g, context.nextText);
  } else {
    result = result.replace(/\{\{#if nextText\}\}[\s\S]*?\{\{\/if\}\}/g, "");
  }

  // Speaker substitution
  if (context.speaker) {
    result = result.replace(/\{\{speaker\}\}/g, context.speaker);
  }

  return result.trim();
}

/**
 * Parse the AI response to extract the revised text.
 * Handles common formatting issues from LLMs.
 */
function parseRevisionResponse(response: string, originalText: string): string {
  let text = response.trim();

  // Remove common wrapper artifacts
  // Remove leading/trailing quotes
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1);
  }

  // Remove markdown code blocks
  if (text.startsWith("```") && text.endsWith("```")) {
    text = text.slice(3, -3).trim();
    // Remove language identifier if present
    const firstNewline = text.indexOf("\n");
    if (firstNewline > 0 && firstNewline < 20) {
      const firstLine = text.slice(0, firstNewline).toLowerCase();
      if (!firstLine.includes(" ")) {
        text = text.slice(firstNewline + 1).trim();
      }
    }
  }

  // If the response is significantly different in structure, it might be an error
  // Fall back to original if response looks like an error message
  const looksLikeError =
    text.toLowerCase().includes("i cannot") ||
    text.toLowerCase().includes("i'm sorry") ||
    text.toLowerCase().includes("as an ai") ||
    text.toLowerCase().includes("error:");

  if (looksLikeError) {
    console.warn("[AIRevision] Response looks like error, returning original:", text.slice(0, 100));
    return originalText;
  }

  return text;
}

// ==================== Provider Resolution ====================

function getActiveProvider(): AIProviderConfig {
  const settings = initializeSettings();
  const defaultId = settings.defaultAIProviderId;
  const provider = settings.aiProviders.find((p) => p.id === defaultId) ?? settings.aiProviders[0];

  if (!provider) {
    throw new Error("No AI provider configured. Please add a provider in settings.");
  }

  return provider;
}

// ==================== Main Functions ====================

/**
 * Revise a single segment using AI.
 */
export async function runRevision(params: SingleRevisionParams): Promise<RevisionResult> {
  const { segment, prompt, previousSegment, nextSegment, signal } = params;

  console.log("[AIRevision] Starting revision for segment:", segment.id);
  console.log("[AIRevision] Prompt:", prompt.name, prompt.id);

  const providerConfig = getActiveProvider();
  console.log("[AIRevision] Using provider:", providerConfig.name, providerConfig.type);

  const provider = createAIProvider(providerConfig);

  const userPrompt = buildPrompt(prompt.userPromptTemplate, {
    text: segment.text,
    previousText: previousSegment?.text,
    nextText: nextSegment?.text,
    speaker: segment.speaker,
  });

  const response = await provider.chat(
    [
      { role: "system", content: prompt.systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { signal },
  );

  console.log("[AIRevision] Received response:", response.content?.slice(0, 100));

  const revisedText = parseRevisionResponse(response.content, segment.text);
  const changes = computeTextChanges(segment.text, revisedText);
  const changeSummary = summarizeChanges(changes, segment.text, revisedText);

  return {
    segmentId: segment.id,
    revisedText,
    changes,
    changeSummary,
  };
}

/**
 * Revise multiple segments in batch.
 * Processes one at a time for better error handling and progress tracking.
 */
export async function runBatchRevision(params: BatchRevisionParams): Promise<void> {
  const { segments, allSegments, prompt, signal, onProgress, onResult } = params;

  const total = segments.length;

  for (let i = 0; i < segments.length; i++) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const segment = segments[i];
    const segmentIndex = allSegments.findIndex((s) => s.id === segment.id);
    const previousSegment = segmentIndex > 0 ? allSegments[segmentIndex - 1] : undefined;
    const nextSegment =
      segmentIndex < allSegments.length - 1 ? allSegments[segmentIndex + 1] : undefined;

    try {
      const result = await runRevision({
        segment,
        prompt,
        previousSegment,
        nextSegment,
        signal,
      });

      onResult?.(result);
    } catch (error) {
      // Log but continue with next segment
      console.error(`[AIRevision] Failed to revise segment ${segment.id}:`, error);
    }

    onProgress?.(i + 1, total);
  }
}
