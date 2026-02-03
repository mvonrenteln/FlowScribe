/**
 * AI Feature Service
 *
 * Unified service for executing AI features.
 * Provides a consistent interface for all AI operations including
 * single execution, batch processing, and cancellation.
 *
 * @module ai/core/aiFeatureService
 */

import type { PromptVariables, SimpleSchema } from "@/lib/ai";
import { compileTemplate, getFeatureOrThrow, parseResponse } from "@/lib/ai";
import { initializeSettings } from "@/lib/settings/settingsStorage";
import type { ChatMessage } from "../providers/types";
import { AICancellationError, isCancellationError, toAIError } from "./errors";
import { type ProviderResolveOptions, resolveProvider } from "./providerResolver";
import type {
  AIBatchResult,
  AIFeatureOptions,
  AIFeatureResult,
  AIFeatureType,
  BatchCallbacks,
  RetryAttemptInfo,
} from "./types";

// ==================== Main Service ====================

/**
 * Execute an AI feature with the given input.
 *
 * @param featureId - ID of the feature to execute
 * @param variables - Variables to substitute into prompts
 * @param options - Execution options (provider, model, etc.)
 * @returns Promise resolving to feature result
 *
 * @example
 * ```ts
 * const result = await executeFeature<SpeakerSuggestion[]>(
 *   "speaker-classification",
 *   {
 *     speakers: "Alice, Bob, [SL]",
 *     segments: "[1] Hello there...",
 *   },
 *   { model: "gpt-4" }
 * );
 *
 * if (result.success) {
 *   console.log(result.data); // SpeakerSuggestion[]
 * }
 * ```
 */
export async function executeFeature<TOutput>(
  featureId: AIFeatureType,
  variables: PromptVariables,
  options: AIFeatureOptions = {},
): Promise<AIFeatureResult<TOutput>> {
  const startTime = Date.now();
  const config = getFeatureOrThrow(featureId);

  // Get retry count from global settings
  const settings = initializeSettings();
  const maxRetries = settings.parseRetryCount ?? 3;

  // Resolve provider using unified resolver
  const resolveOptions: ProviderResolveOptions = {
    providerId: options.providerId ?? options.provider?.id,
    model: options.model,
  };

  const { config: providerConfig, service: provider } = await resolveProvider(resolveOptions);

  // Build messages
  const systemPrompt = options.customPrompt?.systemPrompt ?? config.systemPrompt;
  const userPromptTemplate = options.customPrompt?.userPromptTemplate ?? config.userPromptTemplate;

  const compiledSystem = compileTemplate(systemPrompt, variables);
  const compiledUser = compileTemplate(userPromptTemplate, variables);

  const messages: ChatMessage[] = [
    { role: "system", content: compiledSystem },
    { role: "user", content: compiledUser },
  ];

  // Retry loop for parse failures
  let attempt = 0;
  let lastParseError: string | null = null;
  let lastRawResponse: string | undefined;

  while (attempt <= maxRetries) {
    const attemptStartTime = Date.now();
    attempt++;

    try {
      // Execute chat request
      const response = await provider.chat(messages, {
        ...options.chatOptions,
        signal: options.signal,
      });

      lastRawResponse = response.content;

      // Parse response based on feature type
      if (config.responseSchema) {
        // Structured response - parse and validate
        const parseResult = parseResponse<TOutput>(response.content, {
          schema: config.responseSchema,
        });

        if (parseResult.success && parseResult.data) {
          // Success - return result
          const metadata = buildMetadata(featureId, providerConfig, startTime, response.usage);
          if (attempt > 1) {
            metadata.retryAttempts = attempt - 1;
          }

          return {
            success: true,
            data: parseResult.data,
            rawResponse: response.content,
            metadata,
          };
        }

        // Parse failed - check if we should retry
        lastParseError = parseResult.error?.message ?? "Failed to parse response";

        // Log the parse failure
        logParseFailure(featureId, providerConfig, response.content, parseResult, attempt);

        // If we have retries left, try again
        if (attempt <= maxRetries) {
          console.warn(
            `[AIFeatureService] Parse failed, retrying (attempt ${attempt}/${maxRetries + 1})`,
          );

          // Notify caller about retry
          if (options.onRetry) {
            const retryInfo: RetryAttemptInfo = {
              attempt,
              maxAttempts: maxRetries + 1,
              errorMessage: lastParseError,
              attemptDurationMs: Date.now() - attemptStartTime,
            };
            options.onRetry(retryInfo);
          }

          continue; // Try again
        }

        // All retries exhausted - try lenient recovery as last resort
        const lenientResult = tryLenientRecovery<TOutput>(
          featureId,
          config,
          response,
          variables,
          providerConfig,
          startTime,
          parseResult,
          attempt - 1,
        );

        if (lenientResult) {
          return lenientResult;
        }

        // Lenient recovery also failed - return error
        const metadata = buildMetadata(featureId, providerConfig, startTime, response.usage);
        (metadata as Record<string, unknown>).parseErrors = parseResult.error
          ? [{ message: parseResult.error.message }]
          : [];
        (metadata as Record<string, unknown>).parseWarnings = parseResult.metadata?.warnings ?? [];
        if (attempt > 1) {
          metadata.retryAttempts = attempt - 1;
        }

        return {
          success: false,
          error: lastParseError,
          rawResponse: response.content,
          metadata,
        };
      } else {
        // Plain text response (e.g., text revision) - no parsing needed
        const metadata = buildMetadata(featureId, providerConfig, startTime, response.usage);
        if (attempt > 1) {
          metadata.retryAttempts = attempt - 1;
        }

        return {
          success: true,
          data: response.content as unknown as TOutput,
          rawResponse: response.content,
          metadata,
        };
      }
    } catch (error) {
      // Handle cancellation - don't retry
      if (isCancellationError(error)) {
        const cancelError = new AICancellationError();
        return {
          success: false,
          error: cancelError.toUserMessage(),
          metadata: buildMetadata(featureId, providerConfig, startTime),
        };
      }

      // Connection/network errors - don't retry (only retry parse failures)
      const aiError = toAIError(error);
      const metadata = buildMetadata(featureId, providerConfig, startTime);
      if (attempt > 1) {
        metadata.retryAttempts = attempt - 1;
      }

      return {
        success: false,
        error: aiError.toUserMessage(),
        rawResponse: lastRawResponse,
        metadata,
      };
    }
  }

  // Should not reach here, but just in case
  return {
    success: false,
    error: lastParseError ?? "Unknown error after retries",
    rawResponse: lastRawResponse,
    metadata: buildMetadata(featureId, providerConfig, startTime),
  };
}

/**
 * Log parse failure details for debugging.
 */
function logParseFailure(
  featureId: AIFeatureType,
  providerConfig: { id: string; model: string },
  rawContent: string,
  parseResult: { error?: { message: string }; metadata?: { warnings?: string[] } },
  attempt: number,
): void {
  try {
    const content = rawContent
      ? typeof rawContent === "string"
        ? rawContent
        : JSON.stringify(rawContent)
      : "";

    const MAX_PREVIEW = 15000;
    const rawResponsePreview =
      content.length <= MAX_PREVIEW
        ? content
        : `${content.slice(0, MAX_PREVIEW / 2)}\n\n... [${content.length - MAX_PREVIEW} chars omitted] ...\n\n${content.slice(-MAX_PREVIEW / 2)}`;

    console.warn(
      `[AIFeatureService] Structured parse failed for feature (attempt ${attempt}):`,
      featureId,
      {
        providerId: providerConfig.id,
        model: providerConfig.model,
        error: parseResult.error?.message,
        parseErrors: parseResult.error ? [{ message: parseResult.error.message }] : [],
        rawResponsePreview,
        rawResponseLength: content.length,
        parseMetadata: parseResult.metadata,
      },
    );
  } catch (logEx) {
    console.warn(
      "[AIFeatureService] Failed to log parse failure details:",
      logEx instanceof Error ? logEx.message : String(logEx),
    );
  }
}

/**
 * Attempt lenient recovery when strict parsing fails.
 * Returns a successful result if recovery worked, null otherwise.
 */
function tryLenientRecovery<TOutput>(
  featureId: AIFeatureType,
  config: { responseSchema?: SimpleSchema },
  response: {
    content: string;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  },
  variables: Record<string, unknown>,
  providerConfig: { id: string; model: string },
  startTime: number,
  originalParseResult: { metadata?: { warnings?: string[] } },
  retryAttempts: number,
): AIFeatureResult<TOutput> | null {
  try {
    const lenient = parseResponse(response.content, {
      jsonOptions: { lenient: true },
      recoverPartial: true,
    });

    console.warn("[AIFeatureService] Lenient parse result:", {
      success: lenient.success,
      dataPreview: lenient.data
        ? Array.isArray(lenient.data)
          ? (lenient.data as unknown[]).slice(0, 5)
          : lenient.data
        : undefined,
      metadata: lenient.metadata,
      error: lenient.error?.message,
    });

    if (!lenient.success || !lenient.data) {
      return null;
    }

    // Try to construct pairIndexMap from provided variables when available
    let pairIndexMap: Record<number, string[]> | undefined;
    if (config.responseSchema && typeof variables.segmentPairsJson === "string") {
      try {
        const parsedPairs = JSON.parse(variables.segmentPairsJson) as
          | Array<{ pairIndex: number; segmentIds: string[] }>
          | undefined;
        if (Array.isArray(parsedPairs) && parsedPairs.length > 0) {
          pairIndexMap = parsedPairs.reduce<Record<number, string[]>>((acc, entry) => {
            if (Array.isArray(entry.segmentIds) && entry.segmentIds.length >= 2) {
              acc[entry.pairIndex] = entry.segmentIds.map((s) => String(s));
            }
            return acc;
          }, {});
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Feature-specific normalization: segment-merge often returns variant types
    if (featureId === "segment-merge" && Array.isArray(lenient.data)) {
      const normalizedResult = normalizeSegmentMergeResponse(
        lenient.data,
        pairIndexMap,
        config.responseSchema,
      );
      if (normalizedResult) {
        const metadata = buildMetadata(featureId, providerConfig, startTime, response.usage);
        (metadata as Record<string, unknown>).parseWarnings =
          originalParseResult.metadata?.warnings ?? [];
        (metadata as Record<string, unknown>).lenient = true;
        if (retryAttempts > 0) {
          metadata.retryAttempts = retryAttempts;
        }

        return {
          success: true,
          data: normalizedResult as unknown as TOutput,
          rawResponse: response.content,
          metadata,
        };
      }
    }

    // Generic lenient recovery
    const metadata = buildMetadata(featureId, providerConfig, startTime, response.usage);
    (metadata as Record<string, unknown>).parseWarnings =
      originalParseResult.metadata?.warnings ?? [];
    (metadata as Record<string, unknown>).lenient = true;
    if (retryAttempts > 0) {
      metadata.retryAttempts = retryAttempts;
    }

    return {
      success: true,
      data: lenient.data as unknown as TOutput,
      rawResponse: response.content,
      metadata,
    };
  } catch (lenEx) {
    console.warn(
      "[AIFeatureService] Lenient parse failed:",
      lenEx instanceof Error ? lenEx.message : String(lenEx),
    );
    return null;
  }
}

/**
 * Normalize segment-merge response data to match expected schema.
 */
function normalizeSegmentMergeResponse(
  rawData: unknown[],
  pairIndexMap: Record<number, string[]> | undefined,
  responseSchema: SimpleSchema | undefined,
): unknown[] | null {
  try {
    const normalized = rawData
      .map((itemUnknown) => {
        const item = itemUnknown as Record<string, unknown>;
        let segIdsArray: string[] = [];

        const pairIdx = item.pairId ?? item.pairIndex ?? item.pair;
        if (typeof pairIdx === "number" && pairIndexMap && pairIndexMap[pairIdx]) {
          segIdsArray = [...pairIndexMap[pairIdx]];
        }

        if (segIdsArray.length === 0 && item.mergeId !== undefined) {
          const mergeIdNum =
            typeof item.mergeId === "number"
              ? item.mergeId
              : parseInt(String(item.mergeId).split("-")[0], 10);
          if (!Number.isNaN(mergeIdNum) && pairIndexMap && pairIndexMap[mergeIdNum]) {
            segIdsArray = [...pairIndexMap[mergeIdNum]];
          }
        }

        if (
          segIdsArray.length === 0 &&
          typeof item.segmentA === "object" &&
          item.segmentA &&
          "id" in item.segmentA &&
          typeof item.segmentB === "object" &&
          item.segmentB &&
          "id" in item.segmentB
        ) {
          segIdsArray = [
            String((item.segmentA as Record<string, unknown>).id),
            String((item.segmentB as Record<string, unknown>).id),
          ];
        }

        if (segIdsArray.length === 0 && Array.isArray(item.segmentIds)) {
          segIdsArray = item.segmentIds.map((id: unknown) => String(id));
        }

        if (segIdsArray.length < 2) {
          return null;
        }

        const confidenceRaw = item.confidence ?? item.conf ?? undefined;
        const confidenceNum =
          typeof confidenceRaw === "number" ? confidenceRaw : Number(confidenceRaw);

        const smoothingRaw = item.smoothingChanges ?? item.smoothing_changes ?? item.changes;
        const smoothingChanges = Array.isArray(smoothingRaw)
          ? smoothingRaw.join("; ")
          : smoothingRaw;

        return {
          segmentIds: segIdsArray,
          confidence: Number.isNaN(confidenceNum) ? 0.5 : confidenceNum,
          reason:
            item.reason ?? item.explanation ?? item.note ?? item.summary ?? "AI merge suggestion",
          smoothedText: item.smoothedText ?? item.smoothed_text ?? item.smooth ?? undefined,
          smoothingChanges,
        };
      })
      .filter(Boolean);

    // Validate normalized data against schema
    const validateAttempt = parseResponse<unknown>(JSON.stringify(normalized), {
      schema: responseSchema,
    });

    if (validateAttempt.success && validateAttempt.data) {
      return validateAttempt.data as unknown[];
    }

    console.warn(
      "[AIFeatureService] Normalized validation failed:",
      validateAttempt.error?.message,
      validateAttempt.metadata?.warnings,
    );
    return null;
  } catch (normEx) {
    console.warn(
      "[AIFeatureService] Normalization for segment-merge failed:",
      normEx instanceof Error ? normEx.message : String(normEx),
    );
    return null;
  }
}

// ==================== Batch Processing ====================

/**
 * Execute an AI feature on multiple inputs.
 *
 * @param featureId - ID of the feature to execute
 * @param inputs - Array of variable sets to process
 * @param options - Execution options
 * @param callbacks - Progress and result callbacks
 * @returns Promise resolving to batch result
 *
 * @example
 * ```ts
 * const result = await executeBatch<SpeakerSuggestion[]>(
 *   "speaker-classification",
 *   [{ speakers: "...", segments: "..." }, ...],
 *   { model: "gpt-4" },
 *   {
 *     onProgress: (done, total) => console.log(`${done}/${total}`),
 *     onItemComplete: (i, result) => console.log(`Item ${i} done`),
 *   }
 * );
 * ```
 */
export async function executeBatch<TOutput>(
  featureId: AIFeatureType,
  inputs: PromptVariables[],
  options: AIFeatureOptions = {},
  callbacks: BatchCallbacks<TOutput> = {},
): Promise<AIBatchResult<TOutput>> {
  const startTime = Date.now();
  const results: AIFeatureResult<TOutput>[] = [];

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < inputs.length; i++) {
    // Check for cancellation
    if (options.signal?.aborted) {
      // Mark remaining as cancelled
      for (let j = i; j < inputs.length; j++) {
        results.push({
          success: false,
          error: "Operation cancelled",
          metadata: {
            featureId,
            providerId: "cancelled",
            model: "cancelled",
            durationMs: 0,
          },
        });
        failed++;
      }
      break;
    }

    try {
      const result = await executeFeature<TOutput>(featureId, inputs[i], options);
      results.push(result);

      if (result.success) {
        succeeded++;
      } else {
        failed++;
        callbacks.onItemError?.(i, new Error(result.error ?? "Unknown error"));
      }

      callbacks.onItemComplete?.(i, result);
    } catch (error) {
      const errorResult: AIFeatureResult<TOutput> = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          featureId,
          providerId: "error",
          model: "error",
          durationMs: 0,
        },
      };
      results.push(errorResult);
      failed++;

      callbacks.onItemError?.(i, error instanceof Error ? error : new Error(String(error)));
      callbacks.onItemComplete?.(i, errorResult);
    }

    callbacks.onProgress?.(i + 1, inputs.length);
  }

  return {
    results,
    summary: {
      total: inputs.length,
      succeeded,
      failed,
      durationMs: Date.now() - startTime,
    },
  };
}

// ==================== Helpers ====================

/**
 * Build result metadata.
 */
function buildMetadata(
  featureId: AIFeatureType,
  providerConfig: { id: string; model: string },
  startTime: number,
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number },
): AIFeatureResult<unknown>["metadata"] {
  return {
    featureId,
    providerId: providerConfig.id,
    model: providerConfig.model,
    durationMs: Date.now() - startTime,
    tokenUsage: usage
      ? {
          prompt: usage.promptTokens ?? 0,
          completion: usage.completionTokens ?? 0,
          total: usage.totalTokens ?? 0,
        }
      : undefined,
  };
}

// ==================== Feature-Specific Wrappers ====================

/**
 * Execute speaker classification.
 */
export async function classifySpeakers(
  segments: Array<{ id: string; speaker: string; text: string }>,
  availableSpeakers: string[],
  options: AIFeatureOptions = {},
): Promise<AIFeatureResult<Array<{ tag: string; confidence: number; reason?: string }>>> {
  // Format segments for prompt
  const segmentsText = segments.map((s, i) => `[${i + 1}] [${s.speaker}]: "${s.text}"`).join("\n");

  const speakersText = availableSpeakers.join(", ");

  return executeFeature(
    "speaker-classification",
    {
      segments: segmentsText,
      speakers: speakersText,
    },
    options,
  );
}

/**
 * Execute text revision.
 */
export async function reviseText(
  text: string,
  context: { previousText?: string; nextText?: string; speaker?: string } = {},
  options: AIFeatureOptions = {},
): Promise<AIFeatureResult<string>> {
  return executeFeature(
    "text-revision",
    {
      text,
      ...context,
    },
    options,
  );
}
