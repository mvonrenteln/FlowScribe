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

OUTPUT FORMAT
-------------
Return ONLY valid JSON, wrapped in one of the three envelopes below.

Each chapter inside "data" MUST have this EXACT format:

{
  "title": string,     // 3-8 words, descriptive
  "summary": string,   // 1 sentence, content-focused (optional)
  "tags": string[],    // subset of the provided tag IDs (optional)
  "start": number,     // segment simple ID where the chapter starts
  "end": number        // segment simple ID where the chapter ends
}

If you identified at least one chapter in this batch:

{
  "status": "ok",
  "retryable": false,
  "data": [
    {
      "title": "Opening Remarks",
      "summary": "The speaker welcomes attendees and outlines the agenda.",
      "tags": ["intro"],
      "start": 1,
      "end": 3
    },
    {
      "title": "Q&A Session",
      "summary": "Attendees ask questions about the roadmap.",
      "start": 4,
      "end": 6
    }
  ],
  "error": null
}

If this batch contains no identifiable chapter boundaries:

{
  "status": "empty",
  "retryable": false,
  "data": [],
  "error": null
}

If you cannot produce any chapters:

{
  "status": "error",
  "retryable": true,
  "data": [],
  "error": { "code": "TEMPORARY_FAILURE", "message": "<brief reason>" }
}

"error.code" MUST be one of exactly these six values:
- MISSING_REQUIRED_INPUT (not retryable): required input (segments) is missing
- INVALID_INPUT_SHAPE (not retryable): the input segments could not be understood
- CONTRADICTORY_INPUT (not retryable): the segments are contradictory
- UNSUPPORTED_TASK (not retryable): the requested chapter detection cannot be performed
- OUTPUT_TRUNCATED (retryable): the response would exceed the output limit
- TEMPORARY_FAILURE (retryable): a transient failure prevented analysis

IMPORTANT:
- Only JSON, NO additional text.`;

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

Respond with ONLY the JSON envelope as specified, with each chapter item holding title, summary, tags, start, end.`;

export const chapterDetectionResponseSchema = {
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
  responseFormat: "structured-batch",
};
