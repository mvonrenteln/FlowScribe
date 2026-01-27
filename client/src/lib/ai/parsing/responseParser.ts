/**
 * Response Parser
 *
 * Combines JSON extraction and schema validation to parse AI responses.
 * Provides a unified interface for processing LLM outputs.
 *
 * @module ai/parsing/responseParser
 */

import { extractArrayItems, extractJSON } from "./jsonParser";
import type { RecoveryStrategy } from "./recoveryStrategies";
import { applyRecoveryStrategies, createStandardStrategies } from "./recoveryStrategies";
import type { ParseResult, ResponseParserOptions, SimpleSchema } from "./types";
import { validate } from "./validator";

// ==================== Main Parser ====================

/**
 * Parse an AI response string into typed data.
 *
 * @param input - Raw AI response string
 * @param options - Parser and validation options
 * @returns ParseResult with typed data or error
 *
 * @example
 * ```ts
 * interface SpeakerSuggestion {
 *   tag: string;
 *   confidence: number;
 * }
 *
 * const result = parseResponse<SpeakerSuggestion[]>(response, {
 *   schema: {
 *     type: "array",
 *     items: {
 *       type: "object",
 *       properties: {
 *         tag: { type: "string" },
 *         confidence: { type: "number" },
 *       },
 *       required: ["tag"],
 *     },
 *   },
 * });
 *
 * if (result.success) {
 *   console.log(result.data); // SpeakerSuggestion[]
 * }
 * ```
 */
export function parseResponse<T>(
  input: string,
  options: ResponseParserOptions<T> = {},
): ParseResult<T> {
  const { schema, jsonOptions, applyDefaults = true, transform } = options;

  const warnings: string[] = [];
  let extractionMethod: ParseResult<T>["metadata"]["extractionMethod"] = "direct";

  // Step 1: Extract JSON
  let extracted: unknown;
  try {
    extracted = extractJSON(input, jsonOptions);

    // Determine extraction method for metadata
    if (input.includes("```")) {
      extractionMethod = "code-block";
    } else if (input.trim().startsWith("{") || input.trim().startsWith("[")) {
      extractionMethod = "direct";
    } else {
      extractionMethod = "lenient";
    }
  } catch (error) {
    // If extraction failed, we may still attempt recovery for arrays when requested.
    // Support both top-level arrays and arrays nested inside an object (e.g., { chapters: [...] }).
    if (options.recoverPartial && schema) {
      try {
        // Top-level array schema
        if (schema.type === "array" && schema.items) {
          const typeGuard = createTypeGuard(schema.items);
          const strategies = createStandardStrategies(schema, typeGuard);
          const recovery = applyRecoveryStrategies<T>(input, strategies as RecoveryStrategy<T>[]);

          if (recovery.data && recovery.data.length > 0) {
            return {
              success: true,
              data: recovery.data as unknown as T,
              rawInput: input,
              metadata: {
                extractionMethod: "lenient",
                validated: false,
                warnings: [],
                parseStatus: "MALFORMED",
                recovery: {
                  usedStrategy: recovery.usedStrategy,
                  attemptedStrategies: recovery.attemptedStrategies,
                },
              },
            } as ParseResult<T>;
          }
        }

        // Object schema with an array property (try to recover that property)
        if (schema.type === "object" && schema.properties) {
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            if (propSchema.type === "array" && propSchema.items) {
              const typeGuard = createTypeGuard(propSchema.items);
              const strategies = createStandardStrategies(propSchema, typeGuard);
              const recovery = applyRecoveryStrategies<any>(input, strategies);

              if (recovery.data && recovery.data.length > 0) {
                // Build candidate object with the recovered array
                const candidate: Record<string, unknown> = { [propName]: recovery.data };
                // Validate candidate against the full object schema
                const validation = validate<any>(candidate, schema, applyDefaults);
                if (validation.valid && validation.data) {
                  return {
                    success: true,
                    data: validation.data as unknown as T,
                    rawInput: input,
                    metadata: {
                      extractionMethod: "lenient",
                      validated: false,
                      warnings: [],
                      parseStatus: "MALFORMED",
                      recovery: {
                        usedStrategy: recovery.usedStrategy,
                        attemptedStrategies: recovery.attemptedStrategies,
                        skipped: 0,
                      },
                    },
                  } as ParseResult<T>;
                }
              }
            }
          }
        }
      } catch {
        // fall through to return original parse error
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      rawInput: input,
      metadata: {
        extractionMethod: "direct",
        validated: false,
        warnings: [],
        parseStatus: "INVALID",
      },
    } as ParseResult<T>;
  }

  // Step 2: Validate against schema (if provided)
  let validated: T;
  let wasValidated = false;

  if (schema) {
    const validationResult = validate<T>(extracted, schema, applyDefaults);
    wasValidated = true;

    if (!validationResult.valid || !validationResult.data) {
      // If caller requested recovery, attempt partial recovery for arrays.
      if (options.recoverPartial && schema) {
        try {
          // Top-level array schema
          if (schema.type === "array" && schema.items) {
            const typeGuard = createTypeGuard(schema.items);
            const strategies = createStandardStrategies(schema, typeGuard);
            const recovery = applyRecoveryStrategies<T>(input, strategies as RecoveryStrategy<T>[]);

            if (recovery.data && recovery.data.length > 0) {
              return {
                success: true,
                data: recovery.data as unknown as T,
                rawInput: input,
                metadata: {
                  extractionMethod,
                  validated: false,
                  warnings: validationResult.warnings,
                  parseStatus: "MALFORMED",
                  recovery: {
                    usedStrategy: recovery.usedStrategy,
                    attemptedStrategies: recovery.attemptedStrategies,
                  },
                },
              } as ParseResult<T>;
            }
          }

          // Object schema with an array property (try to recover that property)
          if (schema.type === "object" && schema.properties) {
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
              if (propSchema.type === "array" && propSchema.items) {
                const typeGuard = createTypeGuard(propSchema.items);
                const strategies = createStandardStrategies(propSchema, typeGuard);
                const recovery = applyRecoveryStrategies<any>(
                  input,
                  strategies as RecoveryStrategy<any>[],
                );

                if (recovery.data && recovery.data.length > 0) {
                  const candidate: Record<string, unknown> = { [propName]: recovery.data };
                  const validation = validate<any>(candidate, schema, applyDefaults);
                  if (validation.valid && validation.data) {
                    return {
                      success: true,
                      data: validation.data as unknown as T,
                      rawInput: input,
                      metadata: {
                        extractionMethod,
                        validated: false,
                        warnings: validationResult.warnings,
                        parseStatus: "MALFORMED",
                        recovery: {
                          usedStrategy: recovery.usedStrategy,
                          attemptedStrategies: recovery.attemptedStrategies,
                        },
                      },
                    } as ParseResult<T>;
                  }
                }
              }
            }
          }
        } catch {
          // fall through to return invalid
        }
      }

      return {
        success: false,
        error: new Error(
          `Validation failed: ${validationResult.errors.map((e) => e.message).join(", ")}`,
        ),
        rawInput: input,
        metadata: {
          extractionMethod,
          validated: true,
          warnings: validationResult.warnings,
          parseStatus: "INVALID",
        },
      } as ParseResult<T>;
    }

    validated = validationResult.data;
    warnings.push(...validationResult.warnings);
  } else {
    // No schema, use extracted data as-is
    validated = extracted as T;
  }

  // Step 3: Apply custom transform (if provided)
  if (transform) {
    try {
      validated = transform(validated);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        rawInput: input,
        metadata: {
          extractionMethod,
          validated: wasValidated,
          warnings,
        },
      } as ParseResult<T>;
    }
  }

  return {
    success: true,
    data: validated,
    rawInput: input,
    metadata: {
      extractionMethod,
      validated: wasValidated,
      warnings,
    },
  };
}

// ==================== Convenience Parsers ====================

/**
 * Parse a response expecting an array.
 */
export function parseArrayResponse<T>(input: string, itemSchema?: SimpleSchema): ParseResult<T[]> {
  const schema: SimpleSchema = {
    type: "array",
    items: itemSchema,
  };

  return parseResponse<T[]>(input, { schema });
}

/**
 * Parse a response expecting an object.
 */
export function parseObjectResponse<T>(
  input: string,
  properties?: Record<string, SimpleSchema>,
  required?: string[],
): ParseResult<T> {
  const schema: SimpleSchema = {
    type: "object",
    properties,
    required,
  };

  return parseResponse<T>(input, { schema });
}

/**
 * Parse a response and extract a specific field.
 */
export function parseFieldResponse<T>(
  input: string,
  fieldName: string,
  fieldSchema?: SimpleSchema,
): ParseResult<T> {
  const result = parseResponse<Record<string, unknown>>(input, {
    schema: {
      type: "object",
      properties: fieldSchema ? { [fieldName]: fieldSchema } : undefined,
      required: [fieldName],
    },
  });

  if (!result.success || !result.data) {
    return result as unknown as ParseResult<T>;
  }

  return {
    ...result,
    data: result.data[fieldName] as T,
  };
}

// ==================== Recovery Strategies ====================

/**
 * Attempt to recover partial data from a failed parse.
 * Useful for batch responses where some items may be valid.
 */
export function recoverPartialArray<T>(
  input: string,
  itemValidator: (item: unknown) => item is T,
): { recovered: T[]; skipped: number } {
  const recovered: T[] = [];
  let skipped = 0;

  try {
    // First try to extract fully-formed top-level items from a possibly-truncated array
    const items = extractArrayItems(input);
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (itemValidator(item)) {
          recovered.push(item as T);
        } else {
          skipped++;
        }
      }
      return { recovered, skipped };
    }

    // Fallback: leniently parse whole JSON and filter valid items
    const extracted = extractJSON(input, { lenient: true });

    if (Array.isArray(extracted)) {
      for (const item of extracted) {
        if (itemValidator(item)) {
          recovered.push(item as T);
        } else {
          skipped++;
        }
      }
    }
  } catch {
    // Extraction failed completely
  }

  return { recovered, skipped };
}

/**
 * Create a type guard function for a schema.
 */
export function createTypeGuard<T>(schema: SimpleSchema): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    const result = validate<T>(value, schema, false);
    return result.valid;
  };
}
