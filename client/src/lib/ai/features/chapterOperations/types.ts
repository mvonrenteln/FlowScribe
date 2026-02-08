/**
 * Unified Chapter Operations Types
 *
 * Shared types for all chapter-related AI operations:
 * - Chapter Detection
 * - Chapter Rewrite
 * - Chapter Metadata (Title, Summary, Notes)
 *
 * @module ai/features/chapterOperations/types
 */

/**
 * Chapter operation type discriminator.
 */
export type ChapterOperation = "detection" | "rewrite" | "metadata";

/**
 * Unified Chapter Prompt.
 * All chapter-related prompts use this structure.
 */
export interface ChapterPrompt {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Type for storage/routing (always 'chapter-detect') */
  type: "chapter-detect";
  /** Operation discriminator */
  operation: ChapterOperation;

  // For detection & metadata (Handlebars templates → JSON response)
  /** System prompt (defines behavior) */
  systemPrompt?: string;
  /** User prompt template with {{variables}} */
  userPromptTemplate?: string;

  // For rewrite (instructions → plain text response)
  /** Rewrite instructions (freeform text) */
  instructions?: string;

  /** Whether this is a built-in prompt */
  isBuiltIn: boolean;
  /** Show in quick access menu */
  quickAccess?: boolean;
}

// ==================== Response Structures ====================

/**
 * Chapter Detection Response (existing structure, kept for compatibility)
 */
export interface ChapterDetectionResponse {
  chapters: Array<{
    title: string;
    summary?: string;
    notes?: string;
    tags?: string[];
    start: number;
    end: number;
  }>;
  chapterContinuation?: {
    lastChapterTitle: string;
    endsAtSimpleId: number;
    continuesIntoNextBatch: boolean;
  };
}

/**
 * Chapter Rewrite Response (plain text)
 */
export type ChapterRewriteResponse = string;

/**
 * Chapter Metadata Response (for Title/Summary/Notes generation)
 */
export interface ChapterMetadataResponse {
  /** Operation type discriminator */
  operation: "title" | "summary" | "notes";
  /** Title options (only for operation='title', 2-3 items) */
  titleOptions?: string[];
  /** Generated/improved summary (only for operation='summary') */
  summary?: string;
  /** Generated notes (only for operation='notes') */
  notes?: string;
  /** Optional AI reasoning (can be ignored) */
  reasoning?: string;
}

// ==================== Request/Context Types ====================

/**
 * Context for metadata generation.
 */
export interface MetadataContext {
  /** Chapter ID */
  chapterId: string;
  /** Serialized chapter segments */
  chapterSegments: string;
  /** Current chapter title */
  chapterTitle?: string;
  /** Current summary (for improvement) */
  currentSummary?: string;
  /** Current notes (for improvement) */
  currentNotes?: string;
}

/**
 * Parsed results for title suggestions.
 */
export interface TitleSuggestionsResult {
  /** Array of 2-3 title options */
  options: string[];
}

/**
 * Parsed result for summary generation.
 */
export interface SummaryResult {
  /** Generated or improved summary */
  summary: string;
}

/**
 * Parsed result for notes generation.
 */
export interface NotesResult {
  /** Generated notes */
  notes: string;
}

// ==================== Validation ====================

/**
 * Validate that a prompt has required fields for its operation.
 */
export function validateChapterPrompt(prompt: ChapterPrompt): string[] {
  const errors: string[] = [];

  if (!prompt.name?.trim()) {
    errors.push("Prompt name is required");
  }

  switch (prompt.operation) {
    case "detection":
    case "metadata":
      if (!prompt.systemPrompt?.trim()) {
        errors.push(`System prompt is required for ${prompt.operation} operation`);
      }
      if (!prompt.userPromptTemplate?.trim()) {
        errors.push(`User prompt template is required for ${prompt.operation} operation`);
      }
      break;

    case "rewrite":
      if (!prompt.instructions?.trim()) {
        errors.push("Instructions are required for rewrite operation");
      }
      break;
  }

  return errors;
}

/**
 * Get expected response structure description for an operation.
 */
export function getExpectedResponseFormat(operation: ChapterOperation): string {
  switch (operation) {
    case "detection":
      return `{
  "chapters": [{
    "title": "...",
    "summary": "...",
    "notes": "...",
    "tags": ["tag-id"],
    "start": 1,
    "end": 10
  }]
}`;

    case "rewrite":
      return "Plain text (rewritten chapter content)";

    case "metadata":
      return `{
  "operation": "title|summary|notes",
  "titleOptions": ["..."],  // only for title
  "summary": "...",         // only for summary
  "notes": "..."            // only for notes
}`;
  }
}
