/**
 * JSON Parser
 *
 * Extracts and parses JSON from AI responses.
 * Handles various formats including markdown code blocks,
 * partial JSON, and common LLM response patterns.
 *
 * @module ai/parsing/jsonParser
 */

import { type JsonParserOptions, ParseError } from "./types";

// ==================== Main Parser ====================

/**
 * Extract and parse JSON from an AI response string.
 *
 * @param input - Raw AI response string
 * @param options - Parser options
 * @returns Parsed JSON object or array
 * @throws ParseError if no valid JSON can be extracted
 *
 * @example
 * ```ts
 * // Direct JSON
 * extractJSON('{"name": "Alice"}'); // { name: "Alice" }
 *
 * // From markdown code block
 * extractJSON('```json\n{"name": "Alice"}\n```'); // { name: "Alice" }
 *
 * // With surrounding text
 * extractJSON('Here is the result: [1, 2, 3]'); // [1, 2, 3]
 * ```
 */
export function extractJSON(input: string, options: JsonParserOptions = {}): unknown {
  const { lenient = true, extractFromCodeBlocks = true, maxDepth = 10 } = options;

  if (!input || input.trim() === "") {
    throw new ParseError("Empty response", "EMPTY_RESPONSE");
  }

  const trimmed = input.trim();

  // Try 1: Direct JSON parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to other methods
  }

  // Try 2: Extract from markdown code blocks
  if (extractFromCodeBlocks) {
    const codeBlockResult = extractFromCodeBlock(trimmed);
    if (codeBlockResult !== null) {
      return codeBlockResult;
    }
  }

  // Try 3: Find JSON object or array in text
  const jsonMatch = findJSONInText(trimmed, maxDepth);
  if (jsonMatch !== null) {
    return jsonMatch;
  }

  // Try 4: Lenient parsing (fix common issues)
  if (lenient) {
    const lenientResult = lenientParse(trimmed);
    if (lenientResult !== null) {
      return lenientResult;
    }
  }

  throw new ParseError(
    "No valid JSON found in response",
    "NO_JSON_FOUND",
    undefined,
    trimmed.substring(0, 100),
  );
}

// ==================== Extraction Methods ====================

/**
 * Extract JSON from markdown code blocks.
 * Supports ```json, ```, and indented code blocks.
 */
function extractFromCodeBlock(input: string): unknown | null {
  // Pattern 1: ```json ... ``` or ```JSON ... ```
  const jsonBlockMatch = input.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch {
      // Continue
    }
  }

  // Pattern 2: Generic ``` ... ``` (try to parse as JSON)
  const genericBlockMatch = input.match(/```\s*\n?([\s\S]*?)\n?```/);
  if (genericBlockMatch) {
    try {
      return JSON.parse(genericBlockMatch[1].trim());
    } catch {
      // Continue
    }
  }

  return null;
}

/**
 * Find JSON object or array in surrounding text.
 * Uses bracket matching to find valid JSON boundaries.
 */
function findJSONInText(input: string, maxDepth: number): unknown | null {
  // Find the first { or [ that could start JSON
  const objectStart = input.indexOf("{");
  const arrayStart = input.indexOf("[");

  // Determine which comes first
  let start = -1;
  let isArray = false;

  if (objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart)) {
    start = objectStart;
    isArray = false;
  } else if (arrayStart >= 0) {
    start = arrayStart;
    isArray = true;
  }

  if (start < 0) {
    return null;
  }

  // Find matching closing bracket
  const end = findMatchingBracket(input, start, isArray ? "[" : "{", isArray ? "]" : "}", maxDepth);

  if (end < 0) {
    return null;
  }

  const jsonCandidate = input.substring(start, end + 1);

  try {
    return JSON.parse(jsonCandidate);
  } catch {
    return null;
  }
}

/**
 * Find the matching closing bracket for an opening bracket.
 */
function findMatchingBracket(
  input: string,
  start: number,
  openChar: string,
  closeChar: string,
  maxDepth: number,
): number {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < input.length; i++) {
    const char = input[i];

    // Handle escape sequences
    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    // Handle strings
    if (char === '"') {
      inString = !inString;
      continue;
    }

    // Only process brackets outside of strings
    if (!inString) {
      if (char === openChar) {
        depth++;
        if (depth > maxDepth) {
          return -1; // Too deeply nested
        }
      } else if (char === closeChar) {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
  }

  return -1; // No matching bracket found
}

/**
 * Attempt lenient parsing with common fixes.
 */
function lenientParse(input: string): unknown | null {
  let fixed = input;

  // Fix 1: Remove trailing commas before closing brackets
  fixed = fixed.replace(/,\s*([}\]])/g, "$1");

  // Fix 2: Add missing closing brackets at end
  const openBraces = (fixed.match(/{/g) || []).length;
  const closeBraces = (fixed.match(/}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/]/g) || []).length;

  if (openBraces > closeBraces) {
    fixed += "}".repeat(openBraces - closeBraces);
  }
  if (openBrackets > closeBrackets) {
    fixed += "]".repeat(openBrackets - closeBrackets);
  }

  // Fix 3: Handle single quotes instead of double quotes
  // Only if no double quotes are present
  if (!fixed.includes('"') && fixed.includes("'")) {
    fixed = fixed.replace(/'/g, '"');
  }

  // Fix 4: Handle unquoted keys (simple cases)
  // e.g., {name: "value"} -> {"name": "value"}
  fixed = fixed.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

  try {
    return JSON.parse(fixed);
  } catch {
    return null;
  }
}

// ==================== Type Checking ====================

/**
 * Check if a parsed value is an object (not null, not array).
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Check if a parsed value is an array.
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Safely get a property from a parsed object.
 */
export function getProperty<T>(obj: unknown, key: string, defaultValue: T): T {
  if (!isObject(obj)) {
    return defaultValue;
  }

  const value = obj[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }

  return value as T;
}

/**
 * Extract complete top-level items from a JSON array in text, stopping at the
 * first incomplete/truncated item. Returns array of parsed items or null if
 * no array start was found.
 */
export function extractArrayItems(input: string, maxDepth = 10): unknown[] | null {
  const firstBracket = input.indexOf("[");
  if (firstBracket === -1) return null;

  const items: unknown[] = [];
  let i = firstBracket + 1;
  const len = input.length;

  // Helper to skip whitespace
  const skipWS = () => {
    while (i < len && /\s/.test(input[i])) i++;
  };

  skipWS();

  while (i < len) {
    skipWS();
    if (i >= len) break;

    const ch = input[i];
    if (ch === "]") {
      // End of array
      break;
    }

    // Determine item start
    if (ch === "{" || ch === "[") {
      const end = findMatchingBracket(input, i, ch, ch === "{" ? "}" : "]", maxDepth);
      if (end < 0) break; // truncated item
      const itemText = input.substring(i, end + 1);
      try {
        items.push(JSON.parse(itemText));
      } catch {
        break;
      }
      i = end + 1;
    } else if (ch === '"') {
      // string primitive
      let j = i + 1;
      let isEscaped = false;
      for (; j < len; j++) {
        if (isEscaped) {
          isEscaped = false;
          continue;
        }
        const c = input[j];
        if (c === "\\") {
          isEscaped = true;
          continue;
        }
        if (c === '"') {
          break;
        }
      }
      if (j >= len) break; // truncated
      const itemText = input.substring(i, j + 1);
      try {
        items.push(JSON.parse(itemText));
      } catch {
        break;
      }
      i = j + 1;
    } else {
      // number, true, false, null - find comma or closing bracket
      let j = i;
      for (; j < len; j++) {
        const c = input[j];
        if (c === "," || c === "]") break;
      }
      const itemText = input.substring(i, j).trim();
      if (!itemText) break;
      try {
        items.push(JSON.parse(itemText));
      } catch {
        break;
      }
      i = j;
    }

    // Skip whitespace and optional comma
    skipWS();
    if (input[i] === ",") {
      i++;
    }
    skipWS();
  }

  return items;
}
