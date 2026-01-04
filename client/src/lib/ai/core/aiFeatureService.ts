/**
 * AI Feature Service
 *
 * Unified service for executing AI features.
 * Provides a consistent interface for all AI operations including
 * single execution, batch processing, and cancellation.
 *
 * @module ai/core/aiFeatureService
 */

import { parseResponse } from "../parsing/responseParser";
import { compileTemplate } from "../prompts/promptBuilder";
import type { PromptVariables } from "../prompts/types";
import type { ChatMessage } from "../providers/types";
import { AICancellationError, isCancellationError, toAIError } from "./errors";
import { getFeatureOrThrow } from "./featureRegistry";
import { type ProviderResolveOptions, resolveProvider } from "./providerResolver";
import type {
  AIBatchResult,
  AIFeatureOptions,
  AIFeatureResult,
  AIFeatureType,
  BatchCallbacks,
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

  try {
    // Execute chat request
    const response = await provider.chat(messages, {
      ...options.chatOptions,
      signal: options.signal,
    });

    // Parse response based on feature type
    let data: TOutput;

    if (config.responseSchema) {
      // Structured response - parse and validate
      const parseResult = parseResponse<TOutput>(response.content, {
        schema: config.responseSchema,
      });

      if (!parseResult.success || !parseResult.data) {
        // Detailed logging for debugging malformed provider outputs
        try {
          console.warn("[AIFeatureService] Structured parse failed for feature:", featureId, {
            providerId: providerConfig.id,
            model: providerConfig.model,
            error: parseResult.error?.message,
            // parseResult does not expose a list of errors; expose the top-level error message instead
            parseErrors: parseResult.error ? [{ message: parseResult.error.message }] : [],
            rawResponsePreview: response.content ? (typeof response.content === "string" ? response.content.slice(0, 5000) : JSON.stringify(response.content).slice(0, 5000)) : undefined,
            parseMetadata: parseResult.metadata,
          });

           // Try a lenient parse to show what can be extracted
           try {
             const lenient = parseResponse(response.content, { jsonOptions: { lenient: true } });
             console.warn("[AIFeatureService] Lenient parse result:", {
               success: lenient.success,
               dataPreview: lenient.data ? (Array.isArray(lenient.data) ? (lenient.data as any[]).slice(0, 5) : lenient.data) : undefined,
               metadata: lenient.metadata,
               error: lenient.error?.message,
             });

             // If lenient extraction produced usable data, try normalization for known features
             if (lenient.success && lenient.data) {
              // Feature-specific normalization: segment-merge often returns variant types
              if (featureId === "segment-merge") {
                try {
                  const raw = lenient.data as any[];
                  const normalized = raw.map((item) => {
                    const segIdsRaw = item.segmentIds ?? item.segmentId ?? item.segment_ids ?? item.ids ?? [];
                    let segIdsArray = Array.isArray(segIdsRaw) ? segIdsRaw : [segIdsRaw];
                    segIdsArray = segIdsArray.map((v) => (v === undefined || v === null ? "" : String(v)));

                    const confidenceRaw = item.confidence ?? item.conf ?? undefined;
                    const confidenceNum = typeof confidenceRaw === "number" ? confidenceRaw : Number(confidenceRaw);

                    return {
                      segmentIds: segIdsArray,
                      confidence: Number.isNaN(confidenceNum) ? undefined : confidenceNum,
                      reason: item.reason ?? item.explanation ?? item.note ?? "",
                      smoothedText: item.smoothedText ?? item.smoothed_text ?? item.smooth ?? undefined,
                      smoothingChanges: item.smoothingChanges ?? item.smoothing_changes ?? item.changes ?? undefined,
                    };
                  });

                  // Try to validate normalized data against the schema
                  const validateAttempt = parseResponse<any>(JSON.stringify(normalized), { schema: config.responseSchema });
                  if (validateAttempt.success && validateAttempt.data) {
                    const metadata = buildMetadata(featureId, providerConfig, startTime, response.usage);
                    (metadata as any).parseWarnings = parseResult.metadata?.warnings ?? [];
                    (metadata as any).lenient = true;

                    return {
                      success: true,
                      data: validateAttempt.data as unknown as TOutput,
                      rawResponse: response.content,
                      metadata,
                    };
                  } else {
                    console.warn("[AIFeatureService] Normalized validation failed:", validateAttempt.error?.message, validateAttempt.metadata?.warnings);
                  }
                } catch (normEx) {
                  console.warn("[AIFeatureService] Normalization for segment-merge failed:", normEx instanceof Error ? normEx.message : String(normEx));
                }
              }

              const metadata = buildMetadata(featureId, providerConfig, startTime, response.usage);
              (metadata as any).parseWarnings = parseResult.metadata?.warnings ?? [];
              (metadata as any).lenient = true;

              return {
                success: true,
                data: lenient.data as unknown as TOutput,
                rawResponse: response.content,
                metadata,
              };
            }
          } catch (lenEx) {
            console.warn("[AIFeatureService] Lenient parse failed:", lenEx instanceof Error ? lenEx.message : String(lenEx));
          }
        } catch (logEx) {
          console.warn("[AIFeatureService] Failed to log parse failure details:", logEx instanceof Error ? logEx.message : String(logEx));
        }

        const metadata = buildMetadata(featureId, providerConfig, startTime, response.usage);
        // Attach parse diagnostics to metadata for callers
        (metadata as any).parseErrors = parseResult.error ? [{ message: parseResult.error.message }] : [];
        (metadata as any).parseWarnings = parseResult.metadata?.warnings ?? [];

        return {
          success: false,
          error: parseResult.error?.message ?? "Failed to parse response",
          rawResponse: response.content,
          metadata,
        };
      }

      data = parseResult.data;
    } else {
      // Plain text response (e.g., text revision)
      data = response.content as unknown as TOutput;
    }

    return {
      success: true,
      data,
      rawResponse: response.content,
      metadata: buildMetadata(featureId, providerConfig, startTime, response.usage),
    };
  } catch (error) {
    // Handle cancellation
    if (isCancellationError(error)) {
      const cancelError = new AICancellationError();
      return {
        success: false,
        error: cancelError.toUserMessage(),
        metadata: buildMetadata(featureId, providerConfig, startTime),
      };
    }

    // Convert to unified error
    const aiError = toAIError(error);
    return {
      success: false,
      error: aiError.toUserMessage(),
      metadata: buildMetadata(featureId, providerConfig, startTime),
    };
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
