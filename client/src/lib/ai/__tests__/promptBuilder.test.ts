/**
 * Prompt Builder Tests
 *
 * Tests for template compilation and variable substitution.
 */

import { describe, expect, it } from "vitest";
import {
  compileTemplate,
  compilePrompt,
  extractPlaceholders,
  validateVariables,
} from "../prompts/promptBuilder";
import type { PromptTemplate, PromptVariables } from "../prompts/types";

describe("compileTemplate", () => {
  describe("simple variable substitution", () => {
    it("should replace single variable", () => {
      const result = compileTemplate("Hello {{name}}!", { name: "Alice" });
      expect(result).toBe("Hello Alice!");
    });

    it("should replace multiple variables", () => {
      const result = compileTemplate("{{greeting}} {{name}}!", {
        greeting: "Hello",
        name: "Bob",
      });
      expect(result).toBe("Hello Bob!");
    });

    it("should handle missing variables gracefully", () => {
      const result = compileTemplate("Hello {{name}}!", {});
      expect(result).toBe("Hello {{name}}!");
    });

    it("should convert numbers to strings", () => {
      const result = compileTemplate("Count: {{count}}", { count: 42 });
      expect(result).toBe("Count: 42");
    });

    it("should handle null and undefined", () => {
      const result = compileTemplate("Value: {{value}}", { value: null });
      expect(result).toBe("Value: {{value}}");
    });
  });

  describe("conditional blocks", () => {
    it("should include block when condition is truthy", () => {
      const result = compileTemplate(
        "Hello{{#if name}}, {{name}}{{/if}}!",
        { name: "Alice" }
      );
      expect(result).toBe("Hello, Alice!");
    });

    it("should exclude block when condition is falsy", () => {
      const result = compileTemplate(
        "Hello{{#if name}}, {{name}}{{/if}}!",
        {}
      );
      expect(result).toBe("Hello!");
    });

    it("should handle empty string as falsy", () => {
      const result = compileTemplate(
        "{{#if text}}Has text{{/if}}",
        { text: "" }
      );
      expect(result).toBe("");
    });

    it("should handle nested conditionals", () => {
      const result = compileTemplate(
        "{{#if a}}A{{#if b}}B{{/if}}{{/if}}",
        { a: true, b: true }
      );
      expect(result).toBe("AB");
    });

    it("should handle multiline conditional blocks", () => {
      const template = `{{#if context}}
CONTEXT:
{{context}}
{{/if}}
TEXT: {{text}}`;

      const result = compileTemplate(template, {
        context: "Previous sentence",
        text: "Current text",
      });

      expect(result).toContain("CONTEXT:");
      expect(result).toContain("Previous sentence");
      expect(result).toContain("TEXT: Current text");
    });
  });

  describe("each blocks", () => {
    it("should iterate over array with {{this}}", () => {
      const result = compileTemplate(
        "Items: {{#each items}}{{this}}, {{/each}}",
        { items: ["a", "b", "c"] }
      );
      expect(result).toBe("Items: a, b, c,");
    });

    it("should provide index with {{@index}}", () => {
      const result = compileTemplate(
        "{{#each items}}{{@index}}: {{this}}\n{{/each}}",
        { items: ["first", "second"] }
      );
      expect(result).toContain("0: first");
      expect(result).toContain("1: second");
    });

    it("should handle empty arrays", () => {
      const result = compileTemplate(
        "Items: {{#each items}}{{this}}{{/each}}",
        { items: [] }
      );
      expect(result).toBe("Items:");
    });

    it("should handle non-array values", () => {
      const result = compileTemplate(
        "Items: {{#each items}}{{this}}{{/each}}",
        { items: "not an array" }
      );
      expect(result).toBe("Items:");
    });

    it("should access object properties in each", () => {
      const result = compileTemplate(
        "{{#each users}}{{this.name}}: {{this.role}}\n{{/each}}",
        { users: [{ name: "Alice", role: "Admin" }, { name: "Bob", role: "User" }] }
      );
      expect(result).toContain("Alice: Admin");
      expect(result).toContain("Bob: User");
    });
  });

  describe("edge cases", () => {
    it("should handle empty template", () => {
      const result = compileTemplate("", { name: "test" });
      expect(result).toBe("");
    });

    it("should handle template with no placeholders", () => {
      const result = compileTemplate("Just plain text", {});
      expect(result).toBe("Just plain text");
    });

    it("should clean up multiple newlines", () => {
      const result = compileTemplate("Line 1\n\n\n\nLine 2", {});
      expect(result).toBe("Line 1\n\nLine 2");
    });

    it("should trim result", () => {
      const result = compileTemplate("  text  ", {});
      expect(result).toBe("text");
    });
  });
});

describe("compilePrompt", () => {
  const template: PromptTemplate = {
    id: "test-prompt",
    name: "Test Prompt",
    featureType: "text-revision",
    systemPrompt: "You are a {{role}}.",
    userPromptTemplate: "Please process: {{text}}",
    isBuiltIn: true,
    quickAccess: true,
    isDefault: true,
    placeholders: ["role", "text"],
  };

  it("should compile both system and user prompts", () => {
    const result = compilePrompt(template, { role: "editor", text: "Hello" });

    expect(result.systemPrompt).toBe("You are a editor.");
    expect(result.userPrompt).toBe("Please process: Hello");
  });

  it("should include metadata", () => {
    const result = compilePrompt(template, { role: "editor", text: "Hello" });

    expect(result.templateId).toBe("test-prompt");
    expect(result.variables).toEqual({ role: "editor", text: "Hello" });
    expect(result.compiledAt).toBeInstanceOf(Date);
  });
});

describe("extractPlaceholders", () => {
  it("should extract simple placeholders", () => {
    const result = extractPlaceholders("Hello {{name}}, you have {{count}} items.");
    expect(result).toContain("name");
    expect(result).toContain("count");
  });

  it("should extract from conditionals", () => {
    const result = extractPlaceholders("{{#if active}}Active{{/if}}");
    expect(result).toContain("active");
  });

  it("should extract from each blocks", () => {
    const result = extractPlaceholders("{{#each items}}{{this}}{{/each}}");
    expect(result).toContain("items");
  });

  it("should not include special keywords", () => {
    const result = extractPlaceholders("{{#each items}}{{this}} {{@index}}{{/each}}");
    expect(result).not.toContain("this");
    expect(result).not.toContain("@index");
  });

  it("should deduplicate placeholders", () => {
    const result = extractPlaceholders("{{name}} {{name}} {{name}}");
    expect(result).toEqual(["name"]);
  });

  it("should return empty array for no placeholders", () => {
    const result = extractPlaceholders("Just plain text");
    expect(result).toEqual([]);
  });
});

describe("validateVariables", () => {
  const template: PromptTemplate = {
    id: "test",
    name: "Test",
    featureType: "text-revision",
    systemPrompt: "",
    userPromptTemplate: "",
    isBuiltIn: true,
    quickAccess: false,
    isDefault: false,
    placeholders: ["text", "speaker"],
  };

  it("should pass when all required placeholders are provided", () => {
    const result = validateVariables(template, { text: "Hello", speaker: "Alice" });
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("should fail when placeholders are missing", () => {
    const result = validateVariables(template, { text: "Hello" });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("speaker");
  });

  it("should handle empty placeholders list", () => {
    const noPlaceholders: PromptTemplate = { ...template, placeholders: [] };
    const result = validateVariables(noPlaceholders, {});
    expect(result.valid).toBe(true);
  });
});

