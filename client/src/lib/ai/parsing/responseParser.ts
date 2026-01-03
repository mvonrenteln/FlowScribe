/**
 * Response Parser
 *
 * Combines JSON extraction and schema validation to parse AI responses.
 * Provides a unified interface for processing LLM outputs.
 *
 * @module ai/parsing/responseParser
 */

import { extractJSON } from "./jsonParser";
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
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      rawInput: input,
      metadata: {
        extractionMethod: "direct",
        validated: false,
        warnings: [],
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
    const extracted = extractJSON(input, { lenient: true });

    if (Array.isArray(extracted)) {
      for (const item of extracted) {
        if (itemValidator(item)) {
          recovered.push(item);
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
