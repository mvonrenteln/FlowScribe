/**
 * Response Recovery Strategies
 *
 * Provides fallback mechanisms for recovering data from malformed AI responses.
 * Uses Strategy Pattern for flexible, testable recovery logic.
 *
 * @module ai/parsing/recoveryStrategies
 */

import { parseResponse, recoverPartialArray } from "./responseParser";
import type { SimpleSchema } from "./types";

/**
 * Recovery strategy for extracting data from malformed responses
 */
export interface RecoveryStrategy<T> {
  /**
   * Strategy name for logging
   */
  name: string;

  /**
   * Attempt to recover data from raw response
   * @returns Recovered data or null if strategy failed
   */
  attempt: (rawResponse: string) => T[] | null;
}

/**
 * Result of applying recovery strategies
 */
export interface RecoveryResult<T> {
  /**
   * Recovered data (null if all strategies failed)
   */
  data: T[] | null;

  /**
   * Name of successful strategy (null if none succeeded)
   */
  usedStrategy: string | null;

  /**
   * Number of strategies attempted
   */
  attemptedStrategies: number;
}

/**
 * Apply recovery strategies in sequence until one succeeds
 *
 * @param rawResponse - Raw string response from AI
 * @param strategies - Array of strategies to try
 * @returns Recovery result
 *
 * @example
 * ```ts
 * const logger = createLogger({ feature: "RecoveryStrategies" });
 * const result = applyRecoveryStrategies(rawText, [
 *   lenientParseStrategy(schema),
 *   partialArrayStrategy(typeGuard),
 *   jsonSubstringStrategy(),
 * ]);
 *
 * if (result.data) {
 *   logger.info("Recovered using strategy.", { strategy: result.usedStrategy });
 * }
 * ```
 */
export function applyRecoveryStrategies<T>(
  rawResponse: string,
  strategies: RecoveryStrategy<T>[],
): RecoveryResult<T> {
  for (const strategy of strategies) {
    try {
      const result = strategy.attempt(rawResponse);
      if (result && result.length > 0) {
        return {
          data: result,
          usedStrategy: strategy.name,
          attemptedStrategies: strategies.indexOf(strategy) + 1,
        };
      }
    } catch (_error) {
      // Strategy threw error, try next
    }
  }

  return {
    data: null,
    usedStrategy: null,
    attemptedStrategies: strategies.length,
  };
}

/**
 * Create a lenient parse strategy
 *
 * Attempts to parse with lenient JSON options and schema validation.
 *
 * @param schema - Zod schema for validation
 * @returns Recovery strategy
 */
export function lenientParseStrategy<T>(schema: SimpleSchema): RecoveryStrategy<T> {
  return {
    name: "lenient-parse",
    attempt: (rawResponse: string) => {
      const result = parseResponse<T[]>(rawResponse, {
        schema,
        applyDefaults: true,
        jsonOptions: { lenient: true },
      });

      return result.success && result.data ? result.data : null;
    },
  };
}

/**
 * Create a partial array recovery strategy
 *
 * Attempts to extract valid items from a malformed array using a type guard.
 *
 * @param typeGuard - Function to check if item is valid
 * @returns Recovery strategy
 */
export function partialArrayStrategy<T>(
  typeGuard: (item: unknown) => item is T,
): RecoveryStrategy<T> {
  return {
    name: "partial-array",
    attempt: (rawResponse: string) => {
      try {
        const { recovered } = recoverPartialArray(rawResponse, typeGuard);
        return recovered.length > 0 ? recovered : null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Create a JSON substring extraction strategy
 *
 * Attempts to find and parse the first valid JSON array in the response.
 *
 * @returns Recovery strategy
 */
export function jsonSubstringStrategy<T>(): RecoveryStrategy<T> {
  return {
    name: "json-substring",
    attempt: (rawResponse: string) => {
      const firstBracket = rawResponse.indexOf("[");
      const lastBracket = rawResponse.lastIndexOf("]");

      if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
        return null;
      }

      const jsonCandidate = rawResponse.slice(firstBracket, lastBracket + 1);
      try {
        const parsed = JSON.parse(jsonCandidate);
        return Array.isArray(parsed) && parsed.length > 0 ? (parsed as T[]) : null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Create standard recovery strategies for structured responses
 *
 * Includes lenient parse, partial array, and JSON substring strategies.
 *
 * @param schema - Zod schema for validation
 * @param typeGuard - Function to validate individual items
 * @returns Array of recovery strategies
 *
 * @example
 * ```ts
 * const strategies = createStandardStrategies(
 *   mergeSuggestionSchema,
 *   (item): item is RawSuggestion =>
 *     typeof item === "object" && "segmentIds" in item
 * );
 * ```
 */
export function createStandardStrategies<T>(
  schema: SimpleSchema,
  typeGuard: (item: unknown) => item is T,
): RecoveryStrategy<T>[] {
  return [
    lenientParseStrategy<T>(schema),
    partialArrayStrategy<T>(typeGuard),
    jsonSubstringStrategy<T>(),
  ];
}
