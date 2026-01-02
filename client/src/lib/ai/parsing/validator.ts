/**
 * Schema Validator
 *
 * Validates parsed data against a simple schema definition.
 * Provides type checking, required field validation, and default values.
 *
 * @module ai/parsing/validator
 */

import type { SimpleSchema, ValidationError, ValidationResult } from "./types";

// ==================== Main Validator ====================

/**
 * Validate data against a schema.
 *
 * @param data - Data to validate
 * @param schema - Schema to validate against
 * @param applyDefaults - Whether to apply default values
 * @returns Validation result with typed data
 *
 * @example
 * ```ts
 * const schema: SimpleSchema = {
 *   type: "object",
 *   properties: {
 *     name: { type: "string" },
 *     age: { type: "number", default: 0 },
 *   },
 *   required: ["name"],
 * };
 *
 * const result = validate({ name: "Alice" }, schema);
 * // result.valid === true
 * // result.data === { name: "Alice", age: 0 }
 * ```
 */
export function validate<T>(
  data: unknown,
  schema: SimpleSchema,
  applyDefaults = true,
): ValidationResult<T> {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  const validatedData = validateNode(data, schema, "", errors, warnings, applyDefaults);

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? (validatedData as T) : undefined,
    errors,
    warnings,
  };
}

// ==================== Node Validation ====================

/**
 * Validate a single node in the data structure.
 */
function validateNode(
  data: unknown,
  schema: SimpleSchema,
  path: string,
  errors: ValidationError[],
  warnings: string[],
  applyDefaults: boolean,
): unknown {
  // Handle null/undefined
  if (data === null || data === undefined) {
    if (schema.default !== undefined && applyDefaults) {
      return schema.default;
    }
    // Will be caught by required check at parent level
    return data;
  }

  // Type check
  const actualType = getType(data);
  if (actualType !== schema.type) {
    // Special case: allow number for string if it's a numeric string
    if (schema.type === "string" && actualType === "number") {
      warnings.push(`${path || "root"}: number coerced to string`);
      return String(data);
    }

    // Special case: allow string for number if parseable
    if (schema.type === "number" && actualType === "string") {
      const parsed = Number(data);
      if (!Number.isNaN(parsed)) {
        warnings.push(`${path || "root"}: string coerced to number`);
        return parsed;
      }
    }

    errors.push({
      path: path || "root",
      message: `Expected ${schema.type}, got ${actualType}`,
      expected: schema.type,
      actual: data,
    });
    return data;
  }

  // Enum check
  if (schema.enum && !schema.enum.includes(data as string | number | boolean)) {
    errors.push({
      path: path || "root",
      message: `Value must be one of: ${schema.enum.join(", ")}`,
      expected: schema.enum.join(" | "),
      actual: data,
    });
  }

  // Type-specific validation
  switch (schema.type) {
    case "object":
      return validateObject(
        data as Record<string, unknown>,
        schema,
        path,
        errors,
        warnings,
        applyDefaults,
      );

    case "array":
      return validateArray(data as unknown[], schema, path, errors, warnings, applyDefaults);

    case "string":
      return validateString(data as string, schema, path, errors);

    case "number":
      return validateNumber(data as number, schema, path, errors);

    default:
      return data;
  }
}

// ==================== Type-Specific Validators ====================

/**
 * Validate an object.
 */
function validateObject(
  data: Record<string, unknown>,
  schema: SimpleSchema,
  path: string,
  errors: ValidationError[],
  warnings: string[],
  applyDefaults: boolean,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data };

  // Check required fields
  if (schema.required) {
    for (const requiredField of schema.required) {
      if (data[requiredField] === undefined || data[requiredField] === null) {
        // Check for default value
        if (schema.properties?.[requiredField]?.default !== undefined && applyDefaults) {
          result[requiredField] = schema.properties[requiredField].default;
        } else {
          errors.push({
            path: path ? `${path}.${requiredField}` : requiredField,
            message: `Required field missing: ${requiredField}`,
            expected: "value",
            actual: undefined,
          });
        }
      }
    }
  }

  // Validate properties
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const propPath = path ? `${path}.${key}` : key;
      const propValue = data[key];

      if (propValue !== undefined) {
        result[key] = validateNode(
          propValue,
          propSchema,
          propPath,
          errors,
          warnings,
          applyDefaults,
        );
      } else if (propSchema.default !== undefined && applyDefaults) {
        result[key] = propSchema.default;
      }
    }
  }

  return result;
}

/**
 * Validate an array.
 */
function validateArray(
  data: unknown[],
  schema: SimpleSchema,
  path: string,
  errors: ValidationError[],
  warnings: string[],
  applyDefaults: boolean,
): unknown[] {
  if (!schema.items) {
    return data;
  }

  return data.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    return validateNode(item, schema.items!, itemPath, errors, warnings, applyDefaults);
  });
}

/**
 * Validate a string.
 */
function validateString(
  data: string,
  schema: SimpleSchema,
  path: string,
  errors: ValidationError[],
): string {
  if (schema.minLength !== undefined && data.length < schema.minLength) {
    errors.push({
      path: path || "root",
      message: `String too short (min: ${schema.minLength})`,
      expected: `length >= ${schema.minLength}`,
      actual: data.length,
    });
  }

  if (schema.maxLength !== undefined && data.length > schema.maxLength) {
    errors.push({
      path: path || "root",
      message: `String too long (max: ${schema.maxLength})`,
      expected: `length <= ${schema.maxLength}`,
      actual: data.length,
    });
  }

  return data;
}

/**
 * Validate a number.
 */
function validateNumber(
  data: number,
  schema: SimpleSchema,
  path: string,
  errors: ValidationError[],
): number {
  if (schema.minimum !== undefined && data < schema.minimum) {
    errors.push({
      path: path || "root",
      message: `Number too small (min: ${schema.minimum})`,
      expected: `>= ${schema.minimum}`,
      actual: data,
    });
  }

  if (schema.maximum !== undefined && data > schema.maximum) {
    errors.push({
      path: path || "root",
      message: `Number too large (max: ${schema.maximum})`,
      expected: `<= ${schema.maximum}`,
      actual: data,
    });
  }

  return data;
}

// ==================== Helpers ====================

/**
 * Get the type of a value for schema comparison.
 */
function getType(value: unknown): SimpleSchema["type"] {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "object"; // Treat null as object for JSON compatibility
  }
  const type = typeof value;
  if (type === "object") {
    return "object";
  }
  if (type === "string") {
    return "string";
  }
  if (type === "number") {
    return "number";
  }
  if (type === "boolean") {
    return "boolean";
  }
  return "string"; // Default fallback
}
