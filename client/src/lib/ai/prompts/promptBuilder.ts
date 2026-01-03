/**
 * Prompt Builder
 *
 * Compiles prompt templates with variable substitution.
 * Supports Handlebars-like syntax for placeholders and conditionals.
 *
 * Syntax:
 * - `{{variable}}` - Simple substitution
 * - `{{#if variable}}...{{/if}}` - Conditional block
 * - `{{#each items}}...{{/each}}` - Iteration (limited support)
 *
 * @module ai/prompts/promptBuilder
 */

import type { CompiledPrompt, PromptTemplate, PromptVariables } from "./types";

// ==================== Template Compilation ====================

/**
 * Compile a template string with variables.
 *
 * @param template - Template string with placeholders
 * @param variables - Variables to substitute
 * @returns Compiled string
 *
 * @example
 * ```ts
 * const result = compileTemplate(
 *   "Hello {{name}}, you have {{count}} messages.",
 *   { name: "Alice", count: 5 }
 * );
 * // Returns: "Hello Alice, you have 5 messages."
 * ```
 */
export function compileTemplate(template: string, variables: PromptVariables): string {
  let result = template;

  // Process conditional blocks first ({{#if}}...{{/if}})
  result = processConditionals(result, variables);

  // Process each blocks ({{#each}}...{{/each}})
  result = processEachBlocks(result, variables);

  // Process simple variable substitutions ({{variable}})
  result = processVariables(result, variables);

  // Clean up any remaining unmatched placeholders
  result = cleanupUnmatchedPlaceholders(result);

  return result.trim();
}

/**
 * Process conditional blocks in template.
 * Supports: {{#if variable}}content{{/if}}
 * Handles nested conditionals by processing innermost first.
 * Does not support else clauses.
 */
function processConditionals(template: string, variables: PromptVariables): string {
  // Process innermost conditionals first (no nested #if inside)
  const innerConditionalRegex = /\{\{#if\s+(\w+)}}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if}}/g;

  let result = template;
  let previousResult = "";

  // Keep processing until no more changes (handles nested conditionals)
  while (result !== previousResult) {
    previousResult = result;
    result = result.replace(innerConditionalRegex, (_match, varName, content) => {
      const value = variables[varName];

      // Check if value is truthy
      if (value !== undefined && value !== null && value !== "" && value !== false) {
        return content;
      }

      // Condition not met, remove entire block
      return "";
    });
  }

  return result;
}

/**
 * Process each blocks for arrays.
 * Supports: {{#each items}}...{{/each}}
 * Inside the block, use {{this}} for current item or {{@index}} for index.
 */
function processEachBlocks(template: string, variables: PromptVariables): string {
  const eachRegex = /\{\{#each\s+(\w+)}}([\s\S]*?)\{\{\/each}}/g;

  return template.replace(eachRegex, (_match, varName, content) => {
    const value = variables[varName];

    if (!Array.isArray(value)) {
      return "";
    }

    return value
      .map((item, index) => {
        let itemContent = content;

        // Replace {{this}} with current item
        itemContent = itemContent.replace(/\{\{this}}/g, String(item));

        // Replace {{@index}} with current index
        itemContent = itemContent.replace(/\{\{@index}}/g, String(index));

        // If item is an object, allow property access
        if (typeof item === "object" && item !== null) {
          for (const [key, val] of Object.entries(item)) {
            const propRegex = new RegExp(`\\{\\{this\\.${key}\\}\\}`, "g");
            itemContent = itemContent.replace(propRegex, String(val));
          }
        }

        return itemContent;
      })
      .join("");
  });
}

/**
 * Process simple variable substitutions.
 * Replaces {{variable}} with the variable value.
 */
function processVariables(template: string, variables: PromptVariables): string {
  const variableRegex = /\{\{(\w+)}}/g;

  return template.replace(variableRegex, (match, varName) => {
    const value = variables[varName];

    if (value === undefined || value === null) {
      // Keep placeholder if no value (will be cleaned up later)
      return match;
    }

    // Convert to string
    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  });
}

/**
 * Remove any remaining unmatched placeholders.
 */
function cleanupUnmatchedPlaceholders(template: string): string {
  // Remove empty conditional blocks that might remain
  const emptyConditionalRegex = /\{\{#if\s+\w+}}\s*\{\{\/if}}/g;
  let result = template.replace(emptyConditionalRegex, "");

  // Remove unsubstituted variables (optional - keep for debugging)
  // const unmatchedVarRegex = /\{\{\w+\}\}/g;
  // result = result.replace(unmatchedVarRegex, '');

  // Clean up multiple consecutive newlines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}

// ==================== Prompt Compilation ====================

/**
 * Compile a full prompt template with variables.
 *
 * @param template - Prompt template to compile
 * @param variables - Variables to substitute
 * @returns Compiled prompt ready for AI provider
 *
 * @example
 * ```ts
 * const compiled = compilePrompt(revisionTemplate, {
 *   text: "Hello wrold",
 *   speaker: "Alice",
 * });
 * ```
 */
export function compilePrompt(
  template: PromptTemplate,
  variables: PromptVariables,
): CompiledPrompt {
  const systemPrompt = compileTemplate(template.systemPrompt, variables);
  const userPrompt = compileTemplate(template.userPromptTemplate, variables);

  return {
    systemPrompt,
    userPrompt,
    templateId: template.id,
    variables,
    compiledAt: new Date(),
  };
}

// ==================== Placeholder Extraction ====================

/**
 * Extract all placeholder names from a template string.
 *
 * @param template - Template string to analyze
 * @returns Array of placeholder names
 *
 * @example
 * ```ts
 * const placeholders = extractPlaceholders("Hello {{name}}, {{#if age}}age: {{age}}{{/if}}");
 * // Returns: ["name", "age"]
 * ```
 */
export function extractPlaceholders(template: string): string[] {
  const placeholders = new Set<string>();

  // Match simple variables: {{variable}}
  const simpleVarRegex = /\{\{(\w+)}}/g;
  let match: RegExpExecArray | null = simpleVarRegex.exec(template);
  while (match !== null) {
    // Exclude special keywords
    if (!["this", "@index"].includes(match[1])) {
      placeholders.add(match[1]);
    }
    match = simpleVarRegex.exec(template);
  }

  // Match conditional variables: {{#if variable}}
  const conditionalRegex = /\{\{#if\s+(\w+)}}/g;
  match = conditionalRegex.exec(template);
  while (match !== null) {
    placeholders.add(match[1]);
    match = conditionalRegex.exec(template);
  }

  // Match each variables: {{#each variable}}
  const eachRegex = /\{\{#each\s+(\w+)}}/g;
  match = eachRegex.exec(template);
  while (match !== null) {
    placeholders.add(match[1]);
    match = eachRegex.exec(template);
  }

  return Array.from(placeholders);
}

// ==================== Validation ====================

/**
 * Validate that all required placeholders have values.
 *
 * @param template - Template to validate against
 * @param variables - Variables provided
 * @returns Object with validation result and missing placeholders
 */
export function validateVariables(
  template: PromptTemplate,
  variables: PromptVariables,
): {
  valid: boolean;
  missing: string[];
} {
  const requiredPlaceholders = template.placeholders;
  const missing: string[] = [];

  for (const placeholder of requiredPlaceholders) {
    if (variables[placeholder] === undefined || variables[placeholder] === null) {
      missing.push(placeholder);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
