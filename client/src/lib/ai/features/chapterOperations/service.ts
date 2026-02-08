/**
 * Unified Chapter Operations Service
 *
 * Routes chapter operations (detection, rewrite, metadata) based on prompt type.
 *
 * @module ai/features/chapterOperations/service
 */

import { executeFeature } from "../../core";
import type {
  ChapterMetadataResponse,
  ChapterPrompt,
  MetadataContext,
  NotesResult,
  SummaryResult,
  TitleSuggestionsResult,
} from "./types";

/**
 * Generate metadata using AI.
 */
/**
 * Generate metadata using AI.
 */
export async function generateMetadata(
  prompt: ChapterPrompt,
  context: MetadataContext,
  options?: {
    providerId?: string;
    model?: string;
    signal?: AbortSignal;
  },
): Promise<ChapterMetadataResponse> {
  if (prompt.operation !== "metadata") {
    throw new Error('Prompt operation must be "metadata"');
  }

  if (!prompt.systemPrompt || !prompt.userPromptTemplate) {
    throw new Error("Metadata prompts require systemPrompt and userPromptTemplate");
  }

  // Build variables for template
  const variables = {
    chapterSegments: context.chapterSegments,
    chapterTitle: context.chapterTitle,
    currentSummary: context.currentSummary,
    currentNotes: context.currentNotes,
    summary: context.currentSummary, // alias for notes generation
  };

  // Execute AI feature
  // Since responseSchema is defined in config, result.data will be the parsed object
  const result = await executeFeature<ChapterMetadataResponse>("chapter-metadata", variables, {
    customPrompt: {
      systemPrompt: prompt.systemPrompt,
      userPromptTemplate: prompt.userPromptTemplate,
    },
    signal: options?.signal,
    providerId: options?.providerId,
    model: options?.model,
  });

  if (!result.success || !result.data) {
    throw new Error(result.error ?? "Metadata generation failed");
  }

  const response = result.data;

  // Determine expected operation from prompt definition (fallback to heuristic if needed)
  let expectedOperation: "title" | "summary" | "notes" = "title";
  if (prompt.name.toLowerCase().includes("summary")) {
    expectedOperation = "summary";
  } else if (prompt.name.toLowerCase().includes("notes")) {
    expectedOperation = "notes";
  }

  // Validate operation matches expected
  // Note: AI might return a different operation if prompt is ambiguous, strictly enforcing might be too rigid?
  // But for now, let's ensure we got what we asked for.
  if (response.operation && response.operation !== expectedOperation) {
    // Optional: Log warning but accept if data is present?
    // For now, let's trust the data structure.
  }

  // Validate required fields based on expected operation
  switch (expectedOperation) {
    case "title":
      if (
        !response.titleOptions &&
        !Array.isArray(response["titles" as keyof ChapterMetadataResponse])
      ) {
        // Fallback for older prompts or hallucinations
        if (Array.isArray(response["titles" as keyof ChapterMetadataResponse])) {
          response.titleOptions = response["titles" as keyof ChapterMetadataResponse] as string[];
          response.operation = "title";
        } else {
          throw new Error("titleOptions array is required for title operation");
        }
      }
      break;
    case "summary":
      if (!response.summary || typeof response.summary !== "string") {
        throw new Error("summary string is required for summary operation");
      }
      break;
    case "notes":
      if (!response.notes || typeof response.notes !== "string") {
        throw new Error("notes string is required for notes operation");
      }
      break;
  }

  // Ensure operation is set correctly in return value
  response.operation = expectedOperation;

  return response;
}

/**
 * Suggest chapter titles.
 */
export async function suggestTitles(
  prompt: ChapterPrompt,
  context: MetadataContext,
  options?: {
    providerId?: string;
    model?: string;
    signal?: AbortSignal;
  },
): Promise<TitleSuggestionsResult> {
  const response = await generateMetadata(prompt, context, options);

  if (response.operation !== "title" || !response.titleOptions) {
    throw new Error("Invalid response: expected title suggestions");
  }

  return {
    options: response.titleOptions,
  };
}

/**
 * Generate or improve chapter summary.
 */
export async function generateSummary(
  prompt: ChapterPrompt,
  context: MetadataContext,
  options?: {
    providerId?: string;
    model?: string;
    signal?: AbortSignal;
  },
): Promise<SummaryResult> {
  const response = await generateMetadata(prompt, context, options);

  if (response.operation !== "summary" || !response.summary) {
    throw new Error("Invalid response: expected summary");
  }

  return {
    summary: response.summary,
  };
}

/**
 * Generate chapter notes.
 */
export async function generateNotes(
  prompt: ChapterPrompt,
  context: MetadataContext,
  options?: {
    providerId?: string;
    model?: string;
    signal?: AbortSignal;
  },
): Promise<NotesResult> {
  const response = await generateMetadata(prompt, context, options);

  if (response.operation !== "notes" || !response.notes) {
    throw new Error("Invalid response: expected notes");
  }

  return {
    notes: response.notes,
  };
}
