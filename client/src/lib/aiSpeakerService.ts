/**
 * AI Speaker Service
 *
 * Pure service module for communicating with AI providers to classify
 * transcript segment speakers. Uses iterative batching and lenient
 * JSON parsing to handle various LLM response formats.
 *
 * Provider-agnostic: Uses the unified AIProviderService interface.
 */

import { type AIProviderConfig, createAIProvider } from "./services/aiProviderService";
import { initializeSettings } from "./settings/settingsStorage";
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
    "tag": "<one of the available tags>",
    "confidence": <number between 0 and 1>,
    "reason": "<brief reasoning in one sentence>"
  },
  ...
]

IMPORTANT:
- Output order MUST match the order of the provided sections 1:1.
- Do not skip or add entries.
- Only JSON, NO additional text.
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
  tag: string;
  confidence?: number;
  reason?: string;
}

interface BatchSegment {
  segmentId: string;
  speaker: string;
  text: string;
}

interface BatchIssue {
  level: "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}

interface ParsedSuggestionsResult {
  suggestions: AISpeakerSuggestion[];
  rawItemCount: number; // actual items returned by model
  issues: BatchIssue[];
  unchangedAssignments: number;
  fatal: boolean;
  ignoredCount?: number;
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
      return parsed as OllamaResponseItem[];
    }
    if (parsed && typeof parsed === "object") {
      return [parsed as OllamaResponseItem];
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
        return parsed as OllamaResponseItem[];
      }
      if (parsed && typeof parsed === "object") {
        return [parsed as OllamaResponseItem];
      }
    } catch {
      // Continue
    }
  }

  // Strategy 3: Regex extraction order-based
  const objectPattern =
    /\{\s*"tag"\s*:\s*"([^"]+)"(?:\s*,\s*"confidence"\s*:\s*([\d.]+))?(?:\s*,\s*"reason"\s*:\s*"([^"]*)")?\s*\}/gi;
  const items: OllamaResponseItem[] = [];
  let match: RegExpExecArray | null = objectPattern.exec(trimmed);

  while (match) {
    items.push({
      tag: match[1],
      confidence: match[2] ? Number.parseFloat(match[2]) : undefined,
      reason: match[3] || undefined,
    });

    match = objectPattern.exec(trimmed);
  }

  return items;
}

export function parseOllamaResponse(
  raw: string,
  batch: BatchSegment[],
  currentSpeakers: Map<string, string>,
  availableSpeakers: Iterable<string>,
): ParsedSuggestionsResult {
  const items = extractJsonArray(raw);
  const issues: BatchIssue[] = [];

  if (items.length === 0) {
    recordIssue(issues, "error", "Response did not contain any parseable speaker entries", {
      rawPreview: previewResponse(raw),
    });
    return { suggestions: [], rawItemCount: 0, issues, unchangedAssignments: 0, fatal: true };
  }

  const suggestions: AISpeakerSuggestion[] = [];
  let unchangedAssignments = 0;
  const fatal = false;

  const speakerPool = new Set(availableSpeakers);
  for (const speaker of currentSpeakers.values()) {
    speakerPool.add(speaker);
  }

  for (let index = 0; index < batch.length; index++) {
    const segmentEntry = batch[index];
    const segmentId = segmentEntry.segmentId;

    const item = items[index];
    if (!item) {
      recordIssue(issues, "warn", `Missing response entry for segment ${segmentId}`, {
        position: index + 1,
      });
      continue;
    }

    const rawTag = typeof item.tag === "string" ? item.tag : "";
    if (!rawTag.trim()) {
      recordIssue(issues, "warn", `Missing speaker "tag" for segment ${segmentId}`, { item });
      continue;
    }

    const currentSpeaker = currentSpeakers.get(segmentId) ?? "";
    const cleanedTag = rawTag.replace(/^[[<(\s]+|[\]>)(\s]+$/g, "").trim();
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

    const confidence = normalizeConfidence(item.confidence, index + 1, issues);
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

  if (items.length > batch.length) {
    const extra = items.length - batch.length;
    recordIssue(issues, "warn", `Model returned ${extra} extra entries which were ignored`, {
      rawPreview: previewResponse(raw),
      returned: items.length,
      batchSize: batch.length,
      ignoredCount: extra,
    });
  }

  return {
    suggestions,
    rawItemCount: items.length,
    issues,
    unchangedAssignments,
    fatal,
    ignoredCount: Math.max(0, items.length - batch.length),
  };
}

// ==================== AI Provider Communication ====================

/**
 * Resolves which AI provider to use based on config.
 * Priority: selectedProviderId > default provider > first provider
 */
function resolveAIProvider(config: AISpeakerConfig): AIProviderConfig | null {
  const settings = initializeSettings();

  // 1. Try selectedProviderId from config
  if (config.selectedProviderId) {
    const provider = settings.aiProviders.find((p) => p.id === config.selectedProviderId);
    if (provider) return provider;
  }

  // 2. Try default provider
  if (settings.defaultAIProviderId) {
    const provider = settings.aiProviders.find((p) => p.id === settings.defaultAIProviderId);
    if (provider) return provider;
  }

  // 3. Try any provider marked as default
  const defaultProvider = settings.aiProviders.find((p) => p.isDefault);
  if (defaultProvider) return defaultProvider;

  // 4. Fall back to first provider
  return settings.aiProviders[0] ?? null;
}

/**
 * Calls an AI provider with the given prompt.
 * Uses the unified AIProviderService interface for provider-agnostic communication.
 */
export async function callAIProvider(
  providerConfig: AIProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  signal: AbortSignal,
): Promise<string> {
  try {
    const provider = createAIProvider(providerConfig);
    const response = await provider.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { signal },
    );
    return response.content;
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    console.error("[AI Speaker] Failed to communicate with AI provider", error);
    throw new AISpeakerResponseError("Failed to communicate with AI provider", {
      causeMessage: error instanceof Error ? error.message : String(error),
      providerType: providerConfig.type,
      providerName: providerConfig.name,
    });
  }
}

// ==================== Ollama API Communication (Legacy) ====================

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
  return batch.map((s, idx) => `Section #${idx + 1}: [${s.speaker}] "${s.text}"`).join("\n");
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
    issues?: BatchIssue[];
    fatal?: boolean;
    rawResponsePreview?: string;
    ignoredCount?: number;
    batchDurationMs?: number;
    elapsedMs?: number;
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

  // Resolve AI provider
  const providerConfig = resolveAIProvider(config);
  if (!providerConfig) {
    throw new AISpeakerResponseError(
      "No AI provider configured. Please add a provider in Settings.",
      { config },
    );
  }

  // Get active template
  const activeTemplate = config.templates.find((t) => t.id === config.activeTemplateId);
  const systemPrompt = activeTemplate?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const userPromptTemplate = activeTemplate?.userPromptTemplate ?? DEFAULT_USER_PROMPT_TEMPLATE;

  const total = filteredSegments.length;
  let processed = 0;
  const overallStart = Date.now();

  for (let i = 0; i < total; i += config.batchSize) {
    if (signal.aborted) {
      return;
    }

    const batch = prepareBatch(filteredSegments, i, config.batchSize);

    const currentSpeakers = new Map<string, string>();
    for (const item of batch) {
      currentSpeakers.set(item.segmentId, item.speaker);
    }

    // Build prompt
    const userPrompt = buildUserPrompt(userPromptTemplate, speakers, batch);

    const batchStart = Date.now();
    try {
      // Call AI provider (provider-agnostic)
      const response = await callAIProvider(providerConfig, systemPrompt, userPrompt, signal);

      // Parse response
      const parseResult = parseOllamaResponse(response, batch, currentSpeakers, speakers);
      const { issues, fatal } = parseResult;

      if (issues.some((issue) => issue.level === "error") || fatal) {
        console.warn("[AI Speaker] Batch returned issues", { batch: i / config.batchSize, issues });
      }

      const suggestions = parseResult.suggestions;

      processed = Math.min(i + config.batchSize, total);
      const batchEnd = Date.now();
      const batchDurationMs = batchEnd - batchStart;
      const elapsedMs = batchEnd - overallStart;
      onProgress?.(processed, total);
      onBatchInfo?.({
        batchIndex: Math.floor(i / config.batchSize),
        batchSize: batch.length,
        rawItemCount: parseResult.rawItemCount,
        unchangedAssignments: parseResult.unchangedAssignments,
        suggestionCount: suggestions.length,
        processedTotal: processed,
        totalExpected: total,
        issues,
        fatal,
        rawResponsePreview: previewResponse(response),
        ignoredCount: parseResult.ignoredCount ?? 0,
        batchDurationMs,
        elapsedMs,
      });

      if (fatal) {
        continue;
      }

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
  list: BatchIssue[],
  level: "warn" | "error",
  message: string,
  context?: Record<string, unknown>,
): void {
  list.push({ level, message, context });
  const log = level === "error" ? console.error : console.warn;
  log(`[AI Speaker] ${message}`, context);
}

function previewResponse(raw: string, maxLength = 600): string {
  if (!raw) return "<empty>";
  return raw.length <= maxLength ? raw : `${raw.slice(0, maxLength)}…`;
}

export function summarizeIssues(issues: BatchIssue[] | undefined): string {
  const msgs = (issues || []).map((i) => String(i.message)).filter(Boolean);
  if (msgs.length === 0) return "";
  if (msgs.length <= 3) return msgs.join("; ");
  const head = msgs.slice(0, 3).join("; ");
  return `${head} (+${msgs.length - 3} more)`;
}

export function summarizeAiSpeakerError(error: Error): string {
  if ("details" in error && error.details && typeof error.details === "object") {
    const details = error.details as Record<string, unknown>;
    const rawIssues = details.issues;
    if (Array.isArray(rawIssues) && rawIssues.length > 0) {
      const msgs: string[] = rawIssues
        .map((i) => {
          if (typeof i === "string") return i;
          if (i && typeof i === "object") {
            const rec = i as Record<string, unknown>;
            const candidate =
              rec.message ?? rec.msg ?? rec.msgText ?? rec.error ?? JSON.stringify(rec);
            return String(candidate);
          }
          return String(i);
        })
        .filter(Boolean);
      if (msgs.length === 0) return `${error.message}: ${String(rawIssues[0])}`;
      const summary =
        msgs.length <= 3
          ? msgs.join("; ")
          : `${msgs.slice(0, 3).join("; ")} (+${msgs.length - 3} more)`;
      return `${error.message}: ${summary}`;
    }
  }
  return error.message;
}

function normalizeConfidence(
  confidenceValue: unknown,
  responseId: number,
  issues: BatchIssue[],
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
