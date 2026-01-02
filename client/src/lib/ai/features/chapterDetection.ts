/**
 * Chapter Detection Feature Configuration (Placeholder)
 *
 * Configuration for the AI chapter detection feature.
 * This is a placeholder for Phase 4B implementation.
 *
 * @module ai/features/chapterDetection
 */

import type { AIFeatureConfig } from "../core/types";

// ==================== Default Prompts ====================

export const CHAPTER_SYSTEM_PROMPT = `You analyze transcripts to identify natural chapter boundaries.

TASK
----
Read the transcript and identify logical chapter divisions based on:
- Topic shifts
- Speaker changes
- Content structure
- Semantic coherence

For each chapter, provide:
- Start time
- End time  
- Title (short, descriptive)
- Summary (1-2 sentences)
- Key points (optional, 2-4 bullet points)

OUTPUT FORMAT
-------------
Return JSON array of chapters:
[
  {
    "startTime": 0.0,
    "endTime": 180.5,
    "title": "Introduction",
    "summary": "Overview of the main topic...",
    "keyPoints": ["Point 1", "Point 2"]
  }
]`;

export const CHAPTER_USER_PROMPT_TEMPLATE = `TRANSCRIPT
----------
Duration: {{duration}} seconds
Total Segments: {{segmentCount}}
Granularity: {{granularity}}

{{transcriptText}}

Identify chapters and return as JSON array.`;

// ==================== Response Schema ====================

export const chapterResponseSchema = {
  type: "array" as const,
  items: {
    type: "object" as const,
    properties: {
      startTime: { type: "number" as const },
      endTime: { type: "number" as const },
      title: { type: "string" as const },
      summary: { type: "string" as const },
      keyPoints: { type: "array" as const, items: { type: "string" as const } },
    },
    required: ["startTime", "endTime", "title"],
  },
};

// ==================== Feature Configuration ====================

export const chapterDetectionConfig: AIFeatureConfig = {
  id: "chapter-detection",
  name: "Chapter Detection",
  category: "structural",

  systemPrompt: CHAPTER_SYSTEM_PROMPT,
  userPromptTemplate: CHAPTER_USER_PROMPT_TEMPLATE,

  batchable: false, // Process entire transcript at once
  streamable: true, // Can stream for long transcripts
  defaultBatchSize: 1,

  shortcut: "Alt+C",
  icon: "book-open",
  requiresConfirmation: true,

  availablePlaceholders: ["duration", "segmentCount", "granularity", "transcriptText"],

  responseSchema: chapterResponseSchema,
};

// ==================== Types ====================

/**
 * A detected chapter.
 */
export interface Chapter {
  startTime: number;
  endTime: number;
  title: string;
  summary?: string;
  keyPoints?: string[];
}

/**
 * Input for chapter detection.
 */
export interface ChapterDetectionInput {
  transcriptText: string;
  duration: number;
  segmentCount: number;
  granularity: "coarse" | "medium" | "fine";
}

/**
 * Output from chapter detection.
 */
export type ChapterDetectionOutput = Chapter[];

/**
 * Granularity levels for chapter detection.
 */
export const CHAPTER_GRANULARITY = {
  coarse: { label: "Coarse", chaptersPerHour: "3-5" },
  medium: { label: "Medium", chaptersPerHour: "6-10" },
  fine: { label: "Fine", chaptersPerHour: "10+" },
} as const;
