/**
 * AI Speaker Service
 *
 * Pure service module for communicating with Ollama API to classify
 * transcript segment speakers. Uses iterative batching and lenient
 * JSON parsing to handle various LLM response formats.
 */

import type { AISpeakerConfig, AISpeakerSuggestion, Segment } from "./store/types";

// ==================== Default Prompt Template ====================

export const DEFAULT_SYSTEM_PROMPT = `You are a classifier for role-playing game transcripts.

TASK
-----
You receive a list of text sections ("sections") with unique IDs.
For EACH section, assign exactly ONE speaker tag from the available speakers list below.

OUTPUT FORMAT
-------------
Return ONLY valid JSON:

[
  {
    "id": <number from input>,
    "tag": "<one of the available tags>",
    "confidence": <number between 0 and 1>,
    "reason": "<brief reasoning in one sentence>"
  },
  ...
]

IMPORTANT:
- Only JSON, NO additional text.
- Use the ID exactly as provided in the input.
- "confidence": 0.9-1.0 = very confident, 0.6-0.89 = medium, below = uncertain.
- "reason" should be kept brief (one sentence max).
- If unsure, prefer lower confidence over guessing.

HEURISTICS FOR SPEAKER RECOGNITION
----------------------------------
Use these hints when available in the input context:

[SL] - Game master narration, world description, scene setting
[OOC] - Out of character: rule discussions, meta comments, dice rolls

For player characters: Look for speech patterns, themes, personality traits
that match known character descriptions from context.

IMPORTANT NOTE ON HUMOR
-----------------------
Humor is IN CHARACTER as long as it could be spoken or thought by the character.
Only use [OOC] if clearly player-level: meta comments, rules, off-topic.

DECISION STEPS FOR EACH SECTION
-------------------------------
1. Does it sound like in-game dialogue or action from a character?
   → use character tag

2. Does it describe world, environment, NPCs, or events generally?
   → use [SL]

3. Is it meta-level discussion, rules, or off-topic?
   → use [OOC]

4. Clearly identifiable NPC with name or function?
   → use the NPC name/function

5. Uncertain which character?
   → use [Unknown?] with low confidence`;

export const DEFAULT_USER_PROMPT_TEMPLATE = `AVAILABLE SPEAKERS
------------------
{{speakers}}

SECTIONS TO CLASSIFY
--------------------
{{segments}}

Respond with ONLY the JSON array as specified.`;

// ==================== Types for Internal Use ====================

interface OllamaResponseItem {
  id: number;
  tag: string;
  confidence?: number;
  reason?: string;
}

interface BatchSegment {
  simpleId: number;
  segmentId: string;
  speaker: string;
  text: string;
}

interface ParsedSuggestionsResult {
  suggestions: AISpeakerSuggestion[];
  rawItemCount: number;
  issues: string[];
  unchangedAssignments: number;
}

export class AISpeakerResponseError extends Error {
  constructor(
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AISpeakerResponseError";
  }
}

// ==================== Helpers ====================

function normalizeSpeakerTag(tag: string): string {
  let result = "";
  for (let i = 0; i < tag.length; i++) {
    const code = tag.charCodeAt(i);
    if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      result += tag[i].toLowerCase();
    }
  }
  return result;
}

function resolveSuggestedSpeaker(
  rawTag: string,
  availableSpeakers: Iterable<string>,
): string | null {
  const normalizedRaw = normalizeSpeakerTag(rawTag);
  if (!normalizedRaw) return null;

  let match: string | null = null;
  const iterator = availableSpeakers[Symbol.iterator]();
  for (let next = iterator.next(); !next.done; next = iterator.next()) {
    const speaker = next.value;
    const normalizedSpeaker = normalizeSpeakerTag(speaker);
    if (!normalizedSpeaker) {
      continue;
    }
    if (normalizedRaw === normalizedSpeaker || normalizedSpeaker.includes(normalizedRaw)) {
      if (match && match !== speaker) {
        return null;
      }
      match = speaker;
    }
  }

  return match;
}
function markNewSpeaker(tag: string): { name: string; isNew: boolean } {
  const cleaned = tag.replace(/^\[|\]$/g, "").trim();
  return { name: cleaned, isNew: true };
}

// ==================== Lenient JSON Parsing ====================

/**
 * Extracts JSON array from LLM response, handling various malformed outputs.
 * Strategy:
 * 1. Try direct JSON.parse
 * 2. Extract content between first [ and last ]
 * 3. Fall back to regex extraction for individual objects
 */
export function extractJsonArray(raw: string): OllamaResponseItem[] {
  const trimmed = raw.trim();

  // Strategy 1: Direct parse
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Extract array from surrounding text
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");

  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const jsonPart = trimmed.slice(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(jsonPart);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 3: Regex extraction for individual objects
  const objectPattern =
    /\{\s*"id"\s*:\s*(\d+)\s*,\s*"tag"\s*:\s*"([^"]+)"(?:\s*,\s*"confidence"\s*:\s*([\d.]+))?(?:\s*,\s*"reason"\s*:\s*"([^"]*)")?\s*\}/gi;
  const items: OllamaResponseItem[] = [];
  let match: RegExpExecArray | null = objectPattern.exec(trimmed);

  while (match) {
    items.push({
      id: Number.parseInt(match[1], 10),
      tag: match[2],
      confidence: match[3] ? Number.parseFloat(match[3]) : undefined,
      reason: match[4] || undefined,
    });

    match = objectPattern.exec(trimmed);
  }

  return items;
}

/**
 * Parses Ollama response and maps back to actual segment IDs.
 */
export function parseOllamaResponse(
  raw: string,
  idMapping: Map<number, string>,
  currentSpeakers: Map<string, string>,
  availableSpeakers: Iterable<string>,
): ParsedSuggestionsResult {
  const items = extractJsonArray(raw);
  const speakerPool = new Set(availableSpeakers);
  const currentIterator = currentSpeakers.values();
  for (let next = currentIterator.next(); !next.done; next = currentIterator.next()) {
    speakerPool.add(next.value);
  }
  const suggestions: AISpeakerSuggestion[] = [];
  const issues: string[] = [];
  let unchangedAssignments = 0;

  if (items.length === 0) {
    recordIssue(issues, "error", "Response did not contain any parseable speaker entries", {
      rawPreview: previewResponse(raw),
    });
    return { suggestions, rawItemCount: 0, issues };
  }

  const seenIds = new Set<number>();

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const entryLabel = `item #${index + 1}`;

    const numericId =
      typeof item.id === "number" ? item.id : Number.parseInt(String(item.id ?? Number.NaN), 10);
    if (!Number.isFinite(numericId)) {
      recordIssue(issues, "warn", `${entryLabel} is missing a numeric "id" attribute`, { item });
      continue;
    }

    if (seenIds.has(numericId)) {
      recordIssue(issues, "warn", `Duplicate response id ${numericId} detected`, { item });
      continue;
    }
    seenIds.add(numericId);

    const segmentId = idMapping.get(numericId);
    if (!segmentId) {
      recordIssue(issues, "warn", `No segment matches response id ${numericId}`, {
        expectedIds: Array.from(idMapping.keys()),
      });
      continue;
    }

    const rawTag = typeof item.tag === "string" ? item.tag : "";
    if (!rawTag.trim()) {
      recordIssue(issues, "warn", `Missing speaker "tag" for segment ${segmentId}`, { item });
      continue;
    }

    const currentSpeaker = currentSpeakers.get(segmentId) ?? "";
    const cleanedTag = rawTag.replace(/^\[|\]$/g, "").trim();
    if (!cleanedTag) {
      recordIssue(issues, "warn", `Empty speaker tag after cleanup for segment ${segmentId}`, {
        rawTag,
      });
      continue;
    }

    const resolvedSpeaker = resolveSuggestedSpeaker(cleanedTag, speakerPool);
    const targetSpeakerInfo = resolvedSpeaker
      ? { name: resolvedSpeaker, isNew: false }
      : markNewSpeaker(cleanedTag);
    if (!resolvedSpeaker) {
      console.info("[AI Speaker] AI speaker suggestion introduces new speaker", {
        segmentId,
        tag: item.tag,
      });
    }

    const confidence = normalizeConfidence(item.confidence, numericId, issues);
    const reason = typeof item.reason === "string" ? item.reason : undefined;

    if (targetSpeakerInfo.name.toLowerCase() !== currentSpeaker.toLowerCase()) {
      suggestions.push({
        segmentId,
        currentSpeaker,
        suggestedSpeaker: targetSpeakerInfo.name,
        status: "pending",
        confidence,
        reason,
        isNewSpeaker: targetSpeakerInfo.isNew,
      });
    } else {
      unchangedAssignments++;
    }
  }

  return { suggestions, rawItemCount: items.length, issues, unchangedAssignments };
}

// ==================== Ollama API Communication ====================

/**
 * Calls Ollama API with the given prompt.
 */
export async function callOllama(
  url: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  signal: AbortSignal,
): Promise<string> {
  const apiUrl = `${url.replace(/\/$/, "")}/api/generate`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: userPrompt,
        system: systemPrompt,
        stream: false,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      const message = `Ollama API error (${response.status}): ${errorText}`;
      console.error("[AI Speaker] Ollama API responded with an error", {
        status: response.status,
        body: errorText,
      });
      throw new AISpeakerResponseError(message, {
        status: response.status,
        body: errorText,
      });
    }

    const data = await response.json();
    return data.response ?? "";
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    if (error instanceof AISpeakerResponseError) {
      throw error;
    }
    console.error("[AI Speaker] Failed to communicate with the Ollama API", error);
    throw new AISpeakerResponseError("Failed to communicate with the Ollama API", {
      causeMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

// ==================== Batch Processing ====================

/**
 * Prepares a batch of segments with simple IDs for Ollama.
 */
function prepareBatch(segments: Segment[], startIndex: number, batchSize: number): BatchSegment[] {
  const batch: BatchSegment[] = [];
  const endIndex = Math.min(startIndex + batchSize, segments.length);

  for (let i = startIndex; i < endIndex; i++) {
    batch.push({
      simpleId: i - startIndex + 1, // 1-based simple ID
      segmentId: segments[i].id,
      speaker: segments[i].speaker,
      text: segments[i].text,
    });
  }

  return batch;
}

/**
 * Formats batch segments for the prompt.
 */
function formatSegmentsForPrompt(batch: BatchSegment[]): string {
  return batch.map((s) => `ID ${s.simpleId}: [${s.speaker}] "${s.text}"`).join("\n");
}

/**
 * Formats available speakers list for the prompt.
 */
function formatSpeakersForPrompt(speakers: string[]): string {
  return speakers.map((s) => `[${s}]`).join(", ");
}

/**
 * Builds the user prompt from template.
 */
function buildUserPrompt(template: string, speakers: string[], batch: BatchSegment[]): string {
  return template
    .replace("{{speakers}}", formatSpeakersForPrompt(speakers))
    .replace("{{segments}}", formatSegmentsForPrompt(batch));
}

// ==================== Main Analysis Function ====================

export interface AnalysisOptions {
  segments: Segment[];
  speakers: string[];
  config: AISpeakerConfig;
  selectedSpeakers: string[];
  excludeConfirmed: boolean;
  signal: AbortSignal;
  onProgress?: (processed: number, total: number) => void;
  onBatchComplete?: (suggestions: AISpeakerSuggestion[]) => void;
  onError?: (error: Error) => void;
  onBatchInfo?: (info: {
    batchIndex: number;
    batchSize: number;
    rawItemCount: number;
    unchangedAssignments: number;
    suggestionCount: number;
    processedTotal: number;
    totalExpected: number;
  }) => void;
}

/**
 * Filters segments based on selection criteria.
 */
export function filterSegmentsForAnalysis(
  segments: Segment[],
  selectedSpeakers: string[],
  excludeConfirmed: boolean,
): Segment[] {
  return segments.filter((segment) => {
    // Exclude confirmed segments if requested
    if (excludeConfirmed && segment.confirmed) {
      return false;
    }

    // Include only selected speakers (if any selected)
    if (selectedSpeakers.length > 0) {
      return selectedSpeakers.some(
        (speaker) => speaker.toLowerCase() === segment.speaker.toLowerCase(),
      );
    }

    return true;
  });
}

/**
 * Async generator that yields batches of suggestions progressively.
 */
export async function* analyzeSegmentsBatched(
  options: AnalysisOptions,
): AsyncGenerator<AISpeakerSuggestion[], void, unknown> {
  const {
    segments,
    speakers,
    config,
    selectedSpeakers,
    excludeConfirmed,
    signal,
    onProgress,
    onBatchInfo,
  } = options;

  // Filter segments
  const filteredSegments = filterSegmentsForAnalysis(segments, selectedSpeakers, excludeConfirmed);

  if (filteredSegments.length === 0) {
    return;
  }

  // Get active template
  const activeTemplate = config.templates.find((t) => t.id === config.activeTemplateId);
  const systemPrompt = activeTemplate?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const userPromptTemplate = activeTemplate?.userPromptTemplate ?? DEFAULT_USER_PROMPT_TEMPLATE;

  const total = filteredSegments.length;
  let processed = 0;

  for (let i = 0; i < total; i += config.batchSize) {
    if (signal.aborted) {
      return;
    }

    const batch = prepareBatch(filteredSegments, i, config.batchSize);

    // Build ID mapping (simple ID -> actual segment ID)
    const idMapping = new Map<number, string>();
    const currentSpeakers = new Map<string, string>();
    for (const item of batch) {
      idMapping.set(item.simpleId, item.segmentId);
      currentSpeakers.set(item.segmentId, item.speaker);
    }

    // Build prompt
    const userPrompt = buildUserPrompt(userPromptTemplate, speakers, batch);

    try {
      // Call Ollama
      const response = await callOllama(
        config.ollamaUrl,
        config.model,
        systemPrompt,
        userPrompt,
        signal,
      );

      // Parse response
      const parseResult = parseOllamaResponse(response, idMapping, currentSpeakers, speakers);
      const responseIssues = [...parseResult.issues];

      if (parseResult.rawItemCount !== batch.length) {
        recordIssue(
          responseIssues,
          "warn",
          `Expected ${batch.length} response items but received ${parseResult.rawItemCount}`,
          {
            batchSize: batch.length,
            receivedItems: parseResult.rawItemCount,
          },
        );
      }

      if (responseIssues.length > 0) {
        const error = buildResponseError(responseIssues, response, {
          batchSize: batch.length,
          receivedItems: parseResult.rawItemCount,
        });
        console.error("[AI Speaker] Aborting batch due to response issues", error.details);
        throw error;
      }

      const suggestions = parseResult.suggestions;

      processed = Math.min(i + config.batchSize, total);
      onProgress?.(processed, total);
      onBatchInfo?.({
        batchIndex: Math.floor(i / config.batchSize),
        batchSize: batch.length,
        rawItemCount: parseResult.rawItemCount,
        unchangedAssignments: parseResult.unchangedAssignments,
        suggestionCount: suggestions.length,
        processedTotal: processed,
        totalExpected: total,
      });

      if (suggestions.length > 0) {
        yield suggestions;
      }
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      if (!(error instanceof AISpeakerResponseError)) {
        console.error("[AI Speaker] Unexpected error while processing AI speaker batch", error);
      }
      throw error;
    }
  }
}

/**
 * Runs the full analysis, calling callbacks for progress and results.
 * This is a convenience wrapper around the generator for use in the store.
 */
export async function runAnalysis(options: AnalysisOptions): Promise<void> {
  const { onBatchComplete, onError, signal } = options;

  try {
    for await (const suggestions of analyzeSegmentsBatched(options)) {
      if (signal.aborted) {
        return;
      }
      onBatchComplete?.(suggestions);
    }
  } catch (_error) {
    if (!signal.aborted) {
      console.error("[AI Speaker] Analysis failed", _error);
      onError?.(_error instanceof Error ? _error : new Error(String(_error)));
    }
  }
}

function recordIssue(
  list: string[],
  level: "warn" | "error",
  message: string,
  context?: Record<string, unknown>,
): void {
  list.push(message);
  const log = level === "error" ? console.error : console.warn;
  log(`[AI Speaker] ${message}`, context);
}

function previewResponse(raw: string, maxLength = 600): string {
  if (!raw) return "<empty>";
  return raw.length <= maxLength ? raw : `${raw.slice(0, maxLength)}…`;
}

function summarizeIssues(issues: string[]): string {
  if (issues.length <= 3) {
    return issues.join("; ");
  }
  const head = issues.slice(0, 3).join("; ");
  return `${head} (+${issues.length - 3} more)`;
}

function buildResponseError(
  issues: string[],
  rawResponse: string,
  meta?: Record<string, unknown>,
): AISpeakerResponseError {
  const message = `AI speaker response invalid: ${summarizeIssues(issues)}`;
  return new AISpeakerResponseError(message, {
    issues,
    rawResponsePreview: previewResponse(rawResponse),
    ...meta,
  });
}

function normalizeConfidence(
  confidenceValue: unknown,
  responseId: number,
  issues: string[],
): number | undefined {
  if (confidenceValue === undefined || confidenceValue === null) {
    return undefined;
  }

  const normalized =
    typeof confidenceValue === "number"
      ? confidenceValue
      : Number.parseFloat(String(confidenceValue));

  if (Number.isFinite(normalized)) {
    return normalized;
  }

  recordIssue(issues, "warn", `Invalid confidence value for response id ${responseId}`, {
    confidence: confidenceValue,
  });
  return undefined;
}
