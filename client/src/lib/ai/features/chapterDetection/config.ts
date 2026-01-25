/**
 * Chapter Detection Feature Configuration
 *
 * Provides the default prompts and response schema for AI chapter detection.
 * AI output is segment-range based and must not include real segment IDs.
 *
 * @module ai/features/chapterDetection/config
 */

import type { AIFeatureConfig } from "@/lib/ai/core/types";

export const CHAPTER_DETECTION_SYSTEM_PROMPT = `You analyze transcripts to identify natural chapter boundaries.

TASK
----
Split the transcript into non-overlapping chapters based on:
- topic shifts
- structural shifts (agenda sections, Q&A, wrap-up)
- significant speaker or mode changes

CONSTRAINTS
-----------
- Chapters must be contiguous and non-overlapping.
- Use segment simple IDs only (numbers). Never invent IDs.
- Keep titles short (3–8 words) and descriptive.
- Write summaries as 1 sentence, content-focused.
- Tags (if any) must be from the provided list of tag IDs.

OUTPUT
------
Return JSON that matches the schema.`;

export const CHAPTER_DETECTION_USER_PROMPT_TEMPLATE = `TRANSCRIPT (BATCH)
------------------
Batch: {{batchIndex}} / {{totalBatches}}
Batch size: {{batchSize}}
Min chapter length (segments): {{minChapterLength}}
Max chapter length (segments): {{maxChapterLength}}

AVAILABLE TAG IDS
-----------------
{{tagsAvailable}}

{{previousChapter}}

SEGMENTS (SimpleID | Speaker | Text)
-----------------------------------
{{segments}}

Return JSON in this exact format:
{
  "chapters": [
    {
      "title": "…",
      "summary": "…",
      "tags": ["tag-id-1"],
      "start": 1,
      "end": 3
    }
  ]
}`;

export const chapterDetectionResponseSchema = {
  type: "object" as const,
  properties: {
    chapters: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const },
          summary: { type: "string" as const },
          notes: { type: "string" as const },
          tags: { type: "array" as const, items: { type: "string" as const } },
          start: { type: "number" as const },
          end: { type: "number" as const },
        },
        required: ["title", "start", "end"],
      },
    },
    chapterContinuation: {
      type: "object" as const,
      properties: {
        lastChapterTitle: { type: "string" as const },
        endsAtSimpleId: { type: "number" as const },
        continuesIntoNextBatch: { type: "boolean" as const },
      },
      required: ["lastChapterTitle", "endsAtSimpleId", "continuesIntoNextBatch"],
    },
  },
  required: ["chapters"],
};

export const chapterDetectionConfig: AIFeatureConfig = {
  id: "chapter-detection",
  name: "Chapter Detection",
  category: "structural",
  systemPrompt: CHAPTER_DETECTION_SYSTEM_PROMPT,
  userPromptTemplate: CHAPTER_DETECTION_USER_PROMPT_TEMPLATE,
  batchable: false,
  streamable: true,
  defaultBatchSize: 100,
  shortcut: "Alt+C",
  icon: "book-open",
  requiresConfirmation: true,
  availablePlaceholders: [
    "batchIndex",
    "totalBatches",
    "batchSize",
    "minChapterLength",
    "maxChapterLength",
    "tagsAvailable",
    "segments",
    "previousChapter",
  ],
  responseSchema: chapterDetectionResponseSchema,
};
