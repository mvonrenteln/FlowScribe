/**
 * Text Response Parser
 *
 * Utilities for parsing text-based AI responses.
 * Handles common LLM output artifacts like quotes, markdown, etc.
 *
 * @module ai/parsing/text
 */

// ==================== Types ====================

/**
 * Options for text parsing.
 */
export interface TextParseOptions {
  /**
   * Original text for fallback comparison.
   * If provided, parser can detect error-like responses and return original.
   */
  originalText?: string;

  /**
   * Remove leading/trailing quotes from response.
   * @default true
   */
  removeQuotes?: boolean;

  /**
   * Remove markdown code blocks from response.
   * @default true
   */
  removeCodeBlocks?: boolean;

  /**
   * Detect and handle error-like responses.
   * @default true
   */
  detectErrors?: boolean;

  /**
   * Custom error patterns to detect.
   */
  errorPatterns?: string[];
}

/**
 * Result of text parsing.
 */
export interface TextParseResult {
  /** Parsed text content */
  text: string;

  /** Whether the response was detected as an error */
  wasError: boolean;

  /** Whether fallback to original was used */
  usedFallback: boolean;

  /** Any warnings during parsing */
  warnings: string[];
}

// ==================== Constants ====================

/**
 * Default patterns that indicate an error response from the LLM.
 */
const DEFAULT_ERROR_PATTERNS = [
  "i cannot",
  "i can't",
  "i'm sorry",
  "i am sorry",
  "as an ai",
  "as a language model",
  "i don't have",
  "i do not have",
  "error:",
  "apologies",
  "unfortunately",
];

// ==================== Main Functions ====================

/**
 * Parse a text response from an AI model.
 *
 * Handles common LLM artifacts:
 * - Leading/trailing quotes
 * - Markdown code blocks
 * - Error-like responses
 *
 * @param response - Raw response from AI
 * @param options - Parsing options
 * @returns Parsed text result
 *
 * @example
 * ```ts
 * const result = parseTextResponse('"Hello, world!"');
 * // result.text === 'Hello, world!'
 *
 * const result2 = parseTextResponse(
 *   "I'm sorry, I cannot help with that.",
 *   { originalText: "Original text", detectErrors: true }
 * );
 * // result2.text === 'Original text'
 * // result2.wasError === true
 * // result2.usedFallback === true
 * ```
 */
export function parseTextResponse(
  response: string,
  options: TextParseOptions = {},
): TextParseResult {
  const {
    originalText,
    removeQuotes = true,
    removeCodeBlocks = true,
    detectErrors = true,
    errorPatterns = DEFAULT_ERROR_PATTERNS,
  } = options;

  const warnings: string[] = [];
  let text = response.trim();
  let wasError = false;
  let usedFallback = false;

  // Remove leading/trailing quotes
  if (removeQuotes) {
    text = stripQuotes(text);
  }

  // Remove markdown code blocks
  if (removeCodeBlocks) {
    text = stripCodeBlocks(text);
  }

  // Detect error-like responses
  if (detectErrors) {
    const lowerText = text.toLowerCase();
    const isError = errorPatterns.some((pattern) => lowerText.includes(pattern));

    if (isError) {
      wasError = true;
      warnings.push(`Response appears to be an error: "${text.slice(0, 100)}..."`);

      if (originalText) {
        text = originalText;
        usedFallback = true;
        warnings.push("Falling back to original text");
      }
    }
  }

  return {
    text,
    wasError,
    usedFallback,
    warnings,
  };
}

/**
 * Simple text parsing without result object.
 * Convenience function for simple use cases.
 *
 * @param response - Raw response from AI
 * @param originalText - Original text for fallback
 * @returns Parsed text string
 */
export function parseTextSimple(response: string, originalText?: string): string {
  const result = parseTextResponse(response, { originalText });
  return result.text;
}

// ==================== Helper Functions ====================

/**
 * Remove leading/trailing quotes from text.
 */
export function stripQuotes(text: string): string {
  let result = text.trim();

  // Single or double quotes at both ends
  if (
    (result.startsWith('"') && result.endsWith('"')) ||
    (result.startsWith("'") && result.endsWith("'"))
  ) {
    result = result.slice(1, -1);
  }

  // Smart quotes (using Unicode escapes for proper parsing)
  // \u201C = " (left double quotation mark)
  // \u201D = " (right double quotation mark)
  // \u2018 = ' (left single quotation mark)
  // \u2019 = ' (right single quotation mark)
  if (
    (result.startsWith("\u201C") && result.endsWith("\u201D")) ||
    (result.startsWith("\u2018") && result.endsWith("\u2019"))
  ) {
    result = result.slice(1, -1);
  }

  return result;
}

/**
 * Remove markdown code blocks from text.
 */
export function stripCodeBlocks(text: string): string {
  let result = text.trim();

  // Simple case: entire response is wrapped in ```
  if (result.startsWith("```") && result.endsWith("```")) {
    result = result.slice(3, -3).trim();

    // Remove language identifier if present (e.g., ```text\n...)
    const firstNewline = result.indexOf("\n");
    if (firstNewline > 0 && firstNewline < 20) {
      const firstLine = result.slice(0, firstNewline).toLowerCase();
      // If first line is just a word (no spaces), it's likely a language identifier
      if (!firstLine.includes(" ")) {
        result = result.slice(firstNewline + 1).trim();
      }
    }
  }

  // Inline code blocks: `text` → text
  if (result.startsWith("`") && result.endsWith("`") && !result.includes("\n")) {
    result = result.slice(1, -1);
  }

  return result;
}

/**
 * Check if response looks like an error message.
 */
export function looksLikeError(text: string, patterns: string[] = DEFAULT_ERROR_PATTERNS): boolean {
  const lowerText = text.toLowerCase();
  return patterns.some((pattern) => lowerText.includes(pattern));
}

/**
 * Extract the first paragraph from a response.
 * Useful when LLM adds explanations after the actual content.
 */
export function extractFirstParagraph(text: string): string {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs[0]?.trim() || text;
}

/**
 * Remove common LLM prefixes like "Here is the revised text:" etc.
 */
export function removePreamble(text: string): string {
  const preamblePatterns = [
    /^here is the (?:revised|corrected|fixed|updated) (?:text|version|transcript)[:\s]*/i,
    /^(?:revised|corrected|fixed|updated) (?:text|version|transcript)[:\s]*/i,
    /^the (?:revised|corrected|fixed) (?:text|version) is[:\s]*/i,
    /^here(?:'s| is) (?:the|your) (?:revised|corrected) (?:text|version)[:\s]*/i,
  ];

  let result = text;
  for (const pattern of preamblePatterns) {
    result = result.replace(pattern, "");
  }

  return result.trim();
}
