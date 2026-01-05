/**
 * Parsing Types
 *
 * Type definitions for AI response parsing and validation.
 *
 * @module ai/parsing/types
 */

// ==================== Parse Result ====================

/**
 * Result of parsing an AI response.
 */
export interface ParseResult<T> {
  /** Whether parsing was successful */
  success: boolean;

  /** Parsed data (if successful) */
  data?: T;

  /** Error information (if failed) */
  error?: Error | ParseError;

  /** Raw input that was parsed */
  rawInput: string;

  /** Metadata about the parsing process */
  metadata: {
    /** Method used to extract data */
    extractionMethod: "direct" | "json-block" | "code-block" | "lenient";
    /** Whether validation was applied */
    validated: boolean;
    /** Validation warnings (non-fatal issues) */
    warnings: string[];
  };
}

// ==================== Parse Error ====================

/**
 * Error that occurred during parsing.
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly code: ParseErrorCode,
    public readonly position?: number,
    public readonly context?: string,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Error codes for parsing failures.
 */
export type ParseErrorCode =
  | "NO_JSON_FOUND"
  | "INVALID_JSON"
  | "SCHEMA_MISMATCH"
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_TYPE"
  | "EMPTY_RESPONSE"
  | "UNEXPECTED_FORMAT";

// ==================== Validation ====================

/**
 * Result of validating parsed data against a schema.
 */
export interface ValidationResult<T> {
  /** Whether validation passed */
  valid: boolean;

  /** Validated and potentially transformed data */
  data?: T;

  /** Validation errors */
  errors: ValidationError[];

  /** Non-fatal warnings */
  warnings: string[];
}

/**
 * A single validation error.
 */
export interface ValidationError {
  /** Path to the invalid field (e.g., "items[0].name") */
  path: string;

  /** Error message */
  message: string;

  /** Expected type or value */
  expected?: string;

  /** Actual value received */
  actual?: unknown;
}

// ==================== Schema Types ====================

/**
 * Simple schema for response validation.
 * Supports basic JSON structure validation without external dependencies.
 */
export interface SimpleSchema {
  type: "object" | "array" | "string" | "number" | "boolean";
  properties?: Record<string, SimpleSchema>;
  items?: SimpleSchema;
  required?: string[];
  enum?: (string | number | boolean)[];
  default?: unknown;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  // Lax validation options (optional, feature-specific)
  /**
   * If type is "array" and items.type is "string":
   * allow incoming values like [1, 2, 3] and coerce them to strings.
   */
  allowNumericToStringArray?: boolean;
  /**
   * If type is "array": allow a single non-array value and wrap it into an array.
   * For example: "id-1" → ["id-1"], or 1 → [1].
   */
  allowSingleValueAsArray?: boolean;
}

// ==================== Parser Options ====================

/**
 * Options for the JSON parser.
 */
export interface JsonParserOptions {
  /** Whether to attempt lenient parsing */
  lenient?: boolean;

  /** Whether to extract from markdown code blocks */
  extractFromCodeBlocks?: boolean;

  /** Maximum depth for nested JSON */
  maxDepth?: number;
}

/**
 * Options for response parsing.
 */
export interface ResponseParserOptions<T> {
  /** Schema for validation (optional) */
  schema?: SimpleSchema;

  /** JSON parser options */
  jsonOptions?: JsonParserOptions;

  /** Whether to apply default values from schema */
  applyDefaults?: boolean;

  /** Custom transform function to apply after parsing */
  transform?: (data: unknown) => T;
}
