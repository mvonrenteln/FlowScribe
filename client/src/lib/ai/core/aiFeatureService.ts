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
import { createLogger } from "@/lib/logging";
import {
  getAIRequestTimeoutMs,
  getAITemperature,
  getEffectiveAIRequestConcurrency,
  initializeSettings,
} from "@/lib/settings/settingsStorage";
import { parseStructuredBatchResponse } from "../parsing/structuredBatchResponse";
import type { ChatMessage } from "../providers/types";
import { runConcurrentOrdered } from "./batch";
import { buildCorrectiveRetryMessages } from "./correctiveRetry";
import {
  AICancellationError,
  AIConfigurationError,
  type AIError,
  AIParseError,
  isCancellationError,
  isRetryableAIError,
  toAIError,
} from "./errors";
import {
  type ProviderResolveOptions,
  type ResolvedProvider,
  resolveProvider,
} from "./providerResolver";
import type {
  AIBatchResult,
  AIFeatureOptions,
  AIFeatureResult,
  AIFeatureType,
  BatchCallbacks,
  RetryAttemptInfo,
} from "./types";

const logger = createLogger({ feature: "AIFeatureService" });

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
 * const logger = createLogger({ feature: "AIFeatureService" });
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
 *   logger.info("AI feature result received.", { data: result.data });
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
  const requestTimeoutMs = getAIRequestTimeoutMs(settings);
  const temperature = getAITemperature(settings);

  // Resolve provider using unified resolver
  const resolveOptions: ProviderResolveOptions = {
    providerId: options.providerId ?? options.provider?.id,
    model: options.model,
  };

  let providerConfig: ResolvedProvider["config"];
  let provider: ResolvedProvider["service"];
  try {
    ({ config: providerConfig, service: provider } = await resolveProvider(resolveOptions));
  } catch (error) {
    if (config.responseFormat !== "structured-batch") {
      throw error;
    }
    const aiError = toAIError(error);
    return {
      success: false,
      status: "error",
      retryable: isRetryableAIError(aiError),
      errorSource: "provider",
      error: aiError.toUserMessage(),
      errorCode: aiError.code,
      metadata: buildMetadata(featureId, { id: "unknown", model: "unknown" }, startTime),
    };
  }

  // Build messages
  const systemPrompt = options.customPrompt?.systemPrompt ?? config.systemPrompt;
  const userPromptTemplate = options.customPrompt?.userPromptTemplate ?? config.userPromptTemplate;

  const compiledSystem = compileTemplate(systemPrompt, variables);
  const compiledUser = compileTemplate(userPromptTemplate, variables);

  let messages: ChatMessage[] = [
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
      const requestController = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      const providerPromise = provider.chat(messages, {
        ...options.chatOptions,
        temperature: options.chatOptions?.temperature ?? temperature,
        signal: requestController.signal,
      });

      if (options.signal) {
        if (options.signal.aborted) {
          requestController.abort(options.signal.reason);
        } else {
          options.signal.addEventListener(
            "abort",
            () => requestController.abort(options.signal?.reason),
            { once: true },
          );
        }
      }

      const timeoutPromise =
        requestTimeoutMs > 0
          ? new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                timedOut = true;
                requestController.abort(
                  new Error(`Request timed out after ${Math.round(requestTimeoutMs / 1000)}s`),
                );
                reject(
                  new Error(`Request timed out after ${Math.round(requestTimeoutMs / 1000)}s`),
                );
              }, requestTimeoutMs);
            })
          : null;

      let response: Awaited<typeof providerPromise>;
      try {
        response = timeoutPromise
          ? await Promise.race([providerPromise, timeoutPromise])
          : await providerPromise;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (timedOut) {
          providerPromise.catch(() => {});
        }
      }

      lastRawResponse = response.content;

      // Structured-batch response contract - opted-in features only
      if (config.responseFormat === "structured-batch") {
        if (!config.responseSchema) {
          // Defensive guard for a misconfigured feature (responseSchema is
          // optional on AIFeatureConfig but required for structured-batch).
          // Returned explicitly rather than thrown so it isn't mislabeled as
          // a provider failure by the generic catch below.
          const configError = new AIConfigurationError(
            `Feature "${featureId}" uses responseFormat "structured-batch" but has no responseSchema configured`,
          );
          return {
            success: false,
            status: "error",
            retryable: false,
            errorSource: "provider",
            error: configError.toUserMessage(),
            errorCode: configError.code,
            rawResponse: response.content,
            metadata: buildMetadata(featureId, providerConfig, startTime, response.usage),
          };
        }

        const parsed = parseStructuredBatchResponse<unknown>(
          response.content,
          config.responseSchema,
        );

        if (parsed.success) {
          const metadata = buildMetadata(featureId, providerConfig, startTime, response.usage);
          if (attempt > 1) {
            metadata.retryAttempts = attempt - 1;
          }

          if (parsed.response.status === "ok" || parsed.response.status === "empty") {
            return {
              success: true,
              status: parsed.response.status,
              retryable: false,
              data: parsed.response.data as TOutput,
              rawResponse: response.content,
              metadata,
            };
          }

          // status === "error" - the model itself reported a failure
          if (parsed.response.retryable && attempt <= maxRetries) {
            logger.warn("Structured batch model error, retrying.", {
              attempt,
              maxAttempts: maxRetries + 1,
              errorCode: parsed.response.error.code,
            });

            if (options.onRetry) {
              const retryInfo: RetryAttemptInfo = {
                attempt,
                maxAttempts: maxRetries + 1,
                errorMessage: parsed.response.error.message,
                attemptDurationMs: Date.now() - attemptStartTime,
                retryCategory: "model",
                corrective: false,
              };
              options.onRetry(retryInfo);
            }

            continue;
          }

          return {
            success: false,
            status: "error",
            retryable: parsed.response.retryable,
            errorSource: "model",
            error: parsed.response.error.message,
            errorCode: parsed.response.error.code,
            rawResponse: response.content,
            metadata,
          };
        }

        // Parser failure - retain the existing parse-attempt counting/callback.
        // Structured-batch responses never fall back to lenient recovery.
        const parserFailure = parsed.error;
        lastParseError = parserFailure.message;

        logParseFailure(
          featureId,
          providerConfig,
          response.content,
          { error: { message: parserFailure.message }, metadata: undefined },
          attempt,
        );

        if (attempt <= maxRetries) {
          logger.warn("Structured batch parse failed, retrying.", {
            attempt,
            maxAttempts: maxRetries + 1,
            parserFailureCode: parserFailure.code,
          });

          if (options.onRetry) {
            const retryInfo: RetryAttemptInfo = {
              attempt,
              maxAttempts: maxRetries + 1,
              errorMessage: parserFailure.message,
              attemptDurationMs: Date.now() - attemptStartTime,
              parserFailureCode: parserFailure.code,
              parserFailureDiagnostics: parserFailure.diagnostics,
              retryCategory: "parser",
              corrective: true,
            };
            options.onRetry(retryInfo);
          }

          messages = buildCorrectiveRetryMessages(messages, response.content, parserFailure);
          continue; // Try again
        }

        // All retry attempts exhausted - report as a retryable parser failure
        const metadata = buildMetadata(featureId, providerConfig, startTime, response.usage);
        if (attempt > 1) {
          metadata.retryAttempts = attempt - 1;
        }

        return {
          success: false,
          status: "error",
          retryable: true,
          errorSource: "parser",
          error: new AIParseError(parserFailure.message, response.content).toUserMessage(),
          errorCode: "PARSE_ERROR",
          parserFailure,
          rawResponse: response.content,
          metadata,
        };
      }

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
          logger.warn("Parse failed, retrying.", {
            attempt,
            maxAttempts: maxRetries + 1,
          });

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

        // All retries exhausted - try lenient recovery as last resort.
        // Structured-batch features never enter lenient recovery.
        if (config.responseFormat !== "structured-batch") {
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
          error: new AIParseError(lastParseError ?? "Failed to parse response").toUserMessage(),
          errorCode: "PARSE_ERROR",
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
        const structuredCancellationFields: Partial<AIFeatureResult<TOutput>> =
          config.responseFormat === "structured-batch"
            ? { status: "error", retryable: false, errorSource: "provider" }
            : {};
        return {
          success: false,
          ...structuredCancellationFields,
          error: cancelError.toUserMessage(),
          errorCode: cancelError.code,
          metadata: buildMetadata(featureId, providerConfig, startTime),
        };
      }

      // Connection/network errors - don't retry (only retry parse failures)
      const aiError = toAIError(error);

      if (
        config.responseFormat === "structured-batch" &&
        isRetryableAIError(aiError) &&
        attempt <= maxRetries
      ) {
        const delayMs = getProviderRetryDelayMs(aiError);
        await waitForRetryDelay(delayMs, options.signal);

        if (options.signal?.aborted) {
          const cancelError = new AICancellationError();
          return {
            success: false,
            status: "error",
            retryable: false,
            errorSource: "provider",
            error: cancelError.toUserMessage(),
            errorCode: cancelError.code,
            metadata: buildMetadata(featureId, providerConfig, startTime),
          };
        }

        logger.warn("Structured batch provider failure, retrying.", {
          attempt,
          maxAttempts: maxRetries + 1,
          errorCode: aiError.code,
          delayMs,
        });

        if (options.onRetry) {
          const retryInfo: RetryAttemptInfo = {
            attempt,
            maxAttempts: maxRetries + 1,
            errorMessage: aiError.toUserMessage(),
            attemptDurationMs: Date.now() - attemptStartTime,
            retryCategory: "provider",
            corrective: false,
          };
          options.onRetry(retryInfo);
        }

        continue;
      }

      const metadata = buildMetadata(featureId, providerConfig, startTime);
      if (attempt > 1) {
        metadata.retryAttempts = attempt - 1;
      }

      // Normalize structured fields only for features that opted into the
      // structured-batch contract; legacy features keep the plain shape.
      const structuredProviderFields: Partial<AIFeatureResult<TOutput>> =
        config.responseFormat === "structured-batch"
          ? {
              status: "error",
              retryable: isRetryableAIError(aiError),
              errorSource: "provider",
            }
          : {};

      return {
        success: false,
        ...structuredProviderFields,
        error: aiError.toUserMessage(),
        errorCode: aiError.code,
        rawResponse:
          lastRawResponse ??
          (typeof aiError.details?.originalError === "string"
            ? aiError.details.originalError
            : undefined),
        metadata,
      };
    }
  }

  // Should not reach here, but just in case
  return {
    success: false,
    error: new AIParseError(lastParseError ?? "Unknown error after retries").toUserMessage(),
    errorCode: "PARSE_ERROR",
    rawResponse: lastRawResponse,
    metadata: buildMetadata(featureId, providerConfig, startTime),
  };
}

/**
 * Upper bound on how long a structured-batch provider retry will wait for,
 * regardless of what the provider's `Retry-After` timing suggests.
 */
const MAX_PROVIDER_RETRY_DELAY_MS = 30_000;

/**
 * Compute the delay (in milliseconds) to wait before retrying a retryable
 * provider failure, honoring the provider's normalized `retryAfter` (seconds)
 * when present. Only `AIRateLimitError` carries `retryAfter`; other
 * retryable provider errors (connection, provider-unavailable, non-rate-limit
 * request errors) have no timing and retry immediately (0ms).
 *
 * @param error - The normalized AI error from the failed attempt.
 * @returns Delay in milliseconds, capped at {@link MAX_PROVIDER_RETRY_DELAY_MS}.
 */
function getProviderRetryDelayMs(error: AIError): number {
  const retryAfter = error.details?.retryAfter;
  if (typeof retryAfter !== "number" || !Number.isFinite(retryAfter) || retryAfter <= 0) {
    return 0;
  }
  return Math.min(retryAfter * 1000, MAX_PROVIDER_RETRY_DELAY_MS);
}

/**
 * Wait for a provider retry delay, abortable via `signal`. Resolves (never
 * rejects) whether the wait completes normally or is aborted early, and
 * always clears its timer and removes its own abort listener so no dangling
 * timer or listener remains after it resolves.
 *
 * @param delayMs - Delay to wait, in milliseconds. No-op if `<= 0` or the
 *   signal is already aborted.
 * @param signal - Optional abort signal for external cancellation.
 */
async function waitForRetryDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0 || signal?.aborted) return;
  await new Promise<void>((resolve) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timeoutId);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
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

    logger.warn("Structured parse failed for feature.", {
      attempt,
      featureId,
      providerId: providerConfig.id,
      model: providerConfig.model,
      error: parseResult.error?.message,
      parseErrors: parseResult.error ? [{ message: parseResult.error.message }] : [],
      rawResponsePreview,
      rawResponseLength: content.length,
      parseMetadata: parseResult.metadata,
    });
  } catch (logEx) {
    logger.warn("Failed to log parse failure details.", {
      error: logEx instanceof Error ? logEx.message : String(logEx),
    });
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

    logger.warn("Lenient parse result.", {
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
    logger.warn("Lenient parse failed.", {
      error: lenEx instanceof Error ? lenEx.message : String(lenEx),
    });
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

    logger.warn("Normalized validation failed.", {
      error: validateAttempt.error?.message,
      warnings: validateAttempt.metadata?.warnings,
    });
    return null;
  } catch (normEx) {
    logger.warn("Normalization for segment-merge failed.", {
      error: normEx instanceof Error ? normEx.message : String(normEx),
    });
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
 * const logger = createLogger({ feature: "AIFeatureService" });
 * const result = await executeBatch<SpeakerSuggestion[]>(
 *   "speaker-classification",
 *   [{ speakers: "...", segments: "..." }, ...],
 *   { model: "gpt-4" },
 *   {
 *     onProgress: (done, total) =>
 *       logger.info("Batch progress.", { done, total }),
 *     onItemComplete: (i, result) =>
 *       logger.info("Item completed.", { index: i, result }),
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
  const results: Array<AIFeatureResult<TOutput> | undefined> = new Array(inputs.length);

  let succeeded = 0;
  let failed = 0;
  let completed = 0;

  const concurrency = getEffectiveAIRequestConcurrency(initializeSettings());

  const tasks = inputs.map((input) => async (): Promise<AIFeatureResult<TOutput>> => {
    try {
      return await executeFeature<TOutput>(featureId, input, options);
    } catch (error) {
      const aiError = toAIError(error);
      return {
        success: false,
        error: aiError.toUserMessage(),
        errorCode: aiError.code,
        metadata: {
          featureId,
          providerId: "error",
          model: "error",
          durationMs: 0,
        },
      };
    }
  });

  await runConcurrentOrdered(tasks, {
    concurrency,
    signal: options.signal,
    onItemComplete: (index, result) => {
      results[index] = result;
      completed++;

      if (result.success) {
        succeeded++;
      } else {
        failed++;
        callbacks.onItemError?.(index, new Error(result.error ?? "Unknown error"));
      }

      callbacks.onItemComplete?.(index, result);
      callbacks.onProgress?.(completed, inputs.length);
    },
    onItemError: (index, error) => {
      const aiError = toAIError(error);
      const errorResult: AIFeatureResult<TOutput> = {
        success: false,
        error: aiError.toUserMessage(),
        errorCode: aiError.code,
        metadata: {
          featureId,
          providerId: "error",
          model: "error",
          durationMs: 0,
        },
      };
      results[index] = errorResult;
      completed++;
      failed++;
      callbacks.onItemError?.(index, error);
      callbacks.onItemComplete?.(index, errorResult);
      callbacks.onProgress?.(completed, inputs.length);
    },
  });

  if (options.signal?.aborted) {
    for (let i = 0; i < inputs.length; i++) {
      if (results[i]) continue;
      results[i] = {
        success: false,
        error: "Operation cancelled",
        errorCode: "CANCELLED",
        metadata: {
          featureId,
          providerId: "cancelled",
          model: "cancelled",
          durationMs: 0,
        },
      };
      failed++;
    }
  }

  return {
    results: results.filter((result): result is AIFeatureResult<TOutput> => Boolean(result)),
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
