/**
 * Structured Batch Response Parser
 *
 * Parses and validates the `structured-batch` response envelope used by AI
 * features that opt into `responseFormat: "structured-batch"`. Unlike the
 * lenient `parseResponse`/`recoverPartialArray` helpers, this parser performs
 * no partial recovery: the model must explicitly report `ok`, `empty`, or
 * `error`, and any envelope or data-schema violation is reported as a
 * `SCHEMA_MISMATCH` failure with diagnostics.
 *
 * @module ai/parsing/structuredBatchResponse
 */

import { extractJSON } from "./jsonParser";
import type {
  ParseErrorCode,
  SimpleSchema,
  StructuredBatchModelErrorCode,
  StructuredBatchParseResult,
  StructuredBatchParserFailure,
} from "./types";
import { ParseError, type ValidationError } from "./types";
import { validate } from "./validator";

// ==================== Retryability Table ====================

/**
 * Fixed retryability for each model-reported structured-batch error code.
 * This is the single source of truth the parser validates `retryable`
 * against for `status: "error"` envelopes.
 */
export const STRUCTURED_BATCH_MODEL_ERROR_RETRYABILITY = {
  MISSING_REQUIRED_INPUT: false,
  INVALID_INPUT_SHAPE: false,
  CONTRADICTORY_INPUT: false,
  UNSUPPORTED_TASK: false,
  OUTPUT_TRUNCATED: true,
  TEMPORARY_FAILURE: true,
} as const satisfies Readonly<Record<StructuredBatchModelErrorCode, boolean>>;

const KNOWN_MODEL_ERROR_CODES = Object.keys(
  STRUCTURED_BATCH_MODEL_ERROR_RETRYABILITY,
) as StructuredBatchModelErrorCode[];

// ==================== Helpers ====================

function failure<TItem>(
  code: ParseErrorCode,
  message: string,
  diagnostics: ValidationError[] = [],
): StructuredBatchParseResult<TItem> {
  const error: StructuredBatchParserFailure = { code, message, diagnostics };
  return { success: false, error };
}

function schemaFailure<TItem>(diagnostics: ValidationError[]): StructuredBatchParseResult<TItem> {
  return failure<TItem>(
    "SCHEMA_MISMATCH",
    "Structured batch envelope did not match the expected schema",
    diagnostics,
  );
}

function isModelErrorCode(value: unknown): value is StructuredBatchModelErrorCode {
  return typeof value === "string" && (KNOWN_MODEL_ERROR_CODES as string[]).includes(value);
}

// ==================== Main Parser ====================

/**
 * Parse and validate a structured-batch response envelope.
 *
 * @param input - Raw AI response string
 * @param dataSchema - Schema for the full `data` array (e.g. `{ type: "array", items: {...} }`)
 * @returns A discriminated result: either the validated envelope or a parser failure
 *
 * @example
 * ```ts
 * const result = parseStructuredBatchResponse<SpeakerSuggestion>(response, {
 *   type: "array",
 *   items: { type: "object", required: ["tag"], properties: { tag: { type: "string" } } },
 * });
 *
 * if (result.success && result.response.status === "ok") {
 *   console.log(result.response.data);
 * }
 * ```
 */
export function parseStructuredBatchResponse<TItem>(
  input: string,
  dataSchema: SimpleSchema,
): StructuredBatchParseResult<TItem> {
  let extracted: unknown;
  try {
    extracted = extractJSON(input);
  } catch (rawError) {
    if (rawError instanceof ParseError) {
      return failure(rawError.code, rawError.message);
    }
    const message = rawError instanceof Error ? rawError.message : String(rawError);
    return failure("INVALID_JSON", message);
  }

  if (extracted === null || typeof extracted !== "object" || Array.isArray(extracted)) {
    return schemaFailure([
      {
        path: "root",
        message: "Expected a JSON object envelope",
        expected: "object",
        actual: extracted,
      },
    ]);
  }

  const envelope = extracted as Record<string, unknown>;

  const structuralDiagnostics: ValidationError[] = [];
  for (const field of ["status", "retryable", "data", "error"] as const) {
    if (!(field in envelope)) {
      structuralDiagnostics.push({
        path: field,
        message: `Required field missing: ${field}`,
        expected: "value",
        actual: undefined,
      });
    }
  }
  if (structuralDiagnostics.length > 0) {
    return schemaFailure(structuralDiagnostics);
  }

  const { status, retryable, data, error } = envelope;

  if (status !== "ok" && status !== "empty" && status !== "error") {
    return schemaFailure([
      {
        path: "status",
        message: `Unknown status: ${String(status)}`,
        expected: "ok | empty | error",
        actual: status,
      },
    ]);
  }

  if (typeof retryable !== "boolean") {
    structuralDiagnostics.push({
      path: "retryable",
      message: "Expected boolean",
      expected: "boolean",
      actual: retryable,
    });
  }

  if (!Array.isArray(data)) {
    structuralDiagnostics.push({
      path: "data",
      message: "Expected array",
      expected: "array",
      actual: data,
    });
  }

  if (structuralDiagnostics.length > 0) {
    return schemaFailure(structuralDiagnostics);
  }

  const dataArray = data as unknown[];

  if (status === "ok") {
    return parseOkEnvelope<TItem>(dataArray, retryable as boolean, error, dataSchema);
  }

  if (status === "empty") {
    return parseEmptyEnvelope<TItem>(dataArray, retryable as boolean, error);
  }

  return parseErrorEnvelope<TItem>(dataArray, retryable as boolean, error);
}

// ==================== Status Branch Handlers ====================

function parseOkEnvelope<TItem>(
  dataArray: unknown[],
  retryable: boolean,
  error: unknown,
  dataSchema: SimpleSchema,
): StructuredBatchParseResult<TItem> {
  const diagnostics: ValidationError[] = [];

  if (retryable !== false) {
    diagnostics.push({
      path: "retryable",
      message: "ok status requires retryable=false",
      expected: "false",
      actual: retryable,
    });
  }
  if (error !== null) {
    diagnostics.push({
      path: "error",
      message: "ok status requires error=null",
      expected: "null",
      actual: error,
    });
  }
  if (dataArray.length === 0) {
    diagnostics.push({
      path: "data",
      message: "ok status requires a non-empty data array",
      expected: "non-empty array",
      actual: dataArray,
    });
  }

  if (diagnostics.length > 0) {
    return schemaFailure(diagnostics);
  }

  const validation = validate<TItem[]>(dataArray, dataSchema, false);
  if (!validation.valid || !validation.data) {
    return schemaFailure(validation.errors);
  }

  return {
    success: true,
    response: { status: "ok", retryable: false, data: validation.data, error: null },
  };
}

function parseEmptyEnvelope<TItem>(
  dataArray: unknown[],
  retryable: boolean,
  error: unknown,
): StructuredBatchParseResult<TItem> {
  const diagnostics: ValidationError[] = [];

  if (retryable !== false) {
    diagnostics.push({
      path: "retryable",
      message: "empty status requires retryable=false",
      expected: "false",
      actual: retryable,
    });
  }
  if (error !== null) {
    diagnostics.push({
      path: "error",
      message: "empty status requires error=null",
      expected: "null",
      actual: error,
    });
  }
  if (dataArray.length !== 0) {
    diagnostics.push({
      path: "data",
      message: "empty status requires an empty data array",
      expected: "[]",
      actual: dataArray,
    });
  }

  if (diagnostics.length > 0) {
    return schemaFailure(diagnostics);
  }

  return { success: true, response: { status: "empty", retryable: false, data: [], error: null } };
}

function parseErrorEnvelope<TItem>(
  dataArray: unknown[],
  retryable: boolean,
  error: unknown,
): StructuredBatchParseResult<TItem> {
  const diagnostics: ValidationError[] = [];

  if (dataArray.length !== 0) {
    diagnostics.push({
      path: "data",
      message: "error status requires an empty data array",
      expected: "[]",
      actual: dataArray,
    });
  }

  let code: StructuredBatchModelErrorCode | undefined;
  let message: string | undefined;

  if (error === null || typeof error !== "object" || Array.isArray(error)) {
    diagnostics.push({
      path: "error",
      message: "error status requires an error object",
      expected: "object",
      actual: error,
    });
  } else {
    const errorObject = error as Record<string, unknown>;

    if (isModelErrorCode(errorObject.code)) {
      code = errorObject.code;
    } else {
      diagnostics.push({
        path: "error.code",
        message: `Unknown or missing error code: ${String(errorObject.code)}`,
        expected: KNOWN_MODEL_ERROR_CODES.join(" | "),
        actual: errorObject.code,
      });
    }

    if (typeof errorObject.message === "string" && errorObject.message.length > 0) {
      message = errorObject.message;
    } else {
      diagnostics.push({
        path: "error.message",
        message: "error.message must be a non-empty string",
        expected: "non-empty string",
        actual: errorObject.message,
      });
    }
  }

  if (code !== undefined) {
    const expectedRetryable = STRUCTURED_BATCH_MODEL_ERROR_RETRYABILITY[code];
    if (retryable !== expectedRetryable) {
      diagnostics.push({
        path: "retryable",
        message: `retryable must be ${expectedRetryable} for code ${code}`,
        expected: String(expectedRetryable),
        actual: retryable,
      });
    }
  }

  if (diagnostics.length > 0 || code === undefined || message === undefined) {
    return schemaFailure(diagnostics);
  }

  return {
    success: true,
    response: {
      status: "error",
      retryable: STRUCTURED_BATCH_MODEL_ERROR_RETRYABILITY[code],
      data: [],
      error: { code, message },
    },
  };
}
