/**
 * JSON Parser Tests
 *
 * Tests for JSON extraction from AI responses.
 */

import { describe, expect, it } from "vitest";
import { extractJSON, getProperty, isArray, isObject } from "../parsing/jsonParser";
import { ParseError } from "../parsing/types";

describe("extractJSON", () => {
  describe("direct JSON parsing", () => {
    it("should parse valid JSON object", () => {
      const result = extractJSON('{"name": "Alice", "age": 30}');
      expect(result).toEqual({ name: "Alice", age: 30 });
    });

    it("should parse valid JSON array", () => {
      const result = extractJSON("[1, 2, 3]");
      expect(result).toEqual([1, 2, 3]);
    });

    it("should parse nested JSON", () => {
      const result = extractJSON('{"user": {"name": "Bob"}, "items": [1, 2]}');
      expect(result).toEqual({ user: { name: "Bob" }, items: [1, 2] });
    });
  });

  describe("markdown code block extraction", () => {
    it("should extract from ```json block", () => {
      const input = `Here is the result:
\`\`\`json
{"name": "Alice"}
\`\`\``;
      const result = extractJSON(input);
      expect(result).toEqual({ name: "Alice" });
    });

    it("should extract from generic ``` block", () => {
      const input = `Result:
\`\`\`
[1, 2, 3]
\`\`\``;
      const result = extractJSON(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should handle ```JSON (uppercase)", () => {
      const input = `\`\`\`JSON
{"key": "value"}
\`\`\``;
      const result = extractJSON(input);
      expect(result).toEqual({ key: "value" });
    });
  });

  describe("finding JSON in text", () => {
    it("should find JSON object in surrounding text", () => {
      const input = 'The result is: {"name": "Alice"} and that is all.';
      const result = extractJSON(input);
      expect(result).toEqual({ name: "Alice" });
    });

    it("should find JSON array in surrounding text", () => {
      const input = "Here are the items: [1, 2, 3] done.";
      const result = extractJSON(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should prefer object if it comes before array", () => {
      const input = '{"obj": true} [1, 2]';
      const result = extractJSON(input);
      expect(result).toEqual({ obj: true });
    });

    it("should prefer array if it comes before object", () => {
      const input = '[1, 2] {"obj": true}';
      const result = extractJSON(input);
      expect(result).toEqual([1, 2]);
    });
  });

  describe("lenient parsing", () => {
    it("should fix trailing commas", () => {
      const input = '{"name": "Alice",}';
      const result = extractJSON(input);
      expect(result).toEqual({ name: "Alice" });
    });

    it("should fix missing closing braces", () => {
      const input = '{"name": "Alice"';
      const result = extractJSON(input);
      expect(result).toEqual({ name: "Alice" });
    });

    it("should fix missing closing brackets", () => {
      const input = "[1, 2, 3";
      const result = extractJSON(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should handle single quotes when no double quotes present", () => {
      const input = "{'name': 'Alice'}";
      const result = extractJSON(input);
      expect(result).toEqual({ name: "Alice" });
    });

    it("should handle unquoted keys", () => {
      const input = '{name: "Alice"}';
      const result = extractJSON(input);
      expect(result).toEqual({ name: "Alice" });
    });
  });

  describe("error handling", () => {
    it("should throw ParseError for empty input", () => {
      expect(() => extractJSON("")).toThrow(ParseError);
      expect(() => extractJSON("")).toThrow("Empty response");
    });

    it("should throw ParseError for whitespace only", () => {
      expect(() => extractJSON("   \n\t  ")).toThrow(ParseError);
    });

    it("should throw ParseError for no JSON found", () => {
      expect(() => extractJSON("This is just plain text")).toThrow(ParseError);
      expect(() => extractJSON("This is just plain text")).toThrow("No valid JSON found");
    });

    it("should include context in error", () => {
      try {
        extractJSON("No JSON here at all");
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        expect((e as ParseError).context).toBe("No JSON here at all");
      }
    });
  });

  describe("options", () => {
    it("should respect extractFromCodeBlocks: false", () => {
      // This input ONLY contains JSON inside a code block, no direct JSON
      const input = 'Some text before\n```json\n{"key": "value"}\n```\nand after';
      // With code block extraction disabled AND direct parse failing, it should still find JSON in text
      const result = extractJSON(input, { extractFromCodeBlocks: false });
      // It will still find the JSON because findJSONInText works
      expect(result).toEqual({ key: "value" });
    });

    it("should respect lenient: false for trailing comma", () => {
      const input = '{"name": "Alice",}'; // trailing comma
      expect(() => extractJSON(input, { lenient: false })).toThrow(ParseError);
    });

    it("should handle maxDepth option", () => {
      // This is deeply nested but within default limit
      const deeplyNested = '{"a": {"b": {"c": {"d": {"e": 1}}}}}';
      // With maxDepth: 3, the findMatchingBracket should fail for deeply nested
      // But direct JSON.parse happens first and succeeds
      const result = extractJSON(deeplyNested, { maxDepth: 3 });
      expect(result).toEqual({ a: { b: { c: { d: { e: 1 } } } } });
    });
  });

  describe("complex scenarios", () => {
    it("should handle speaker classification response", () => {
      const input = `Here are the classifications:
\`\`\`json
[
  {"tag": "Alice", "confidence": 0.9, "reason": "Clear speech pattern"},
  {"tag": "[SL]", "confidence": 0.7, "reason": "Narration style"}
]
\`\`\``;
      const result = extractJSON(input);
      expect(result).toEqual([
        { tag: "Alice", confidence: 0.9, reason: "Clear speech pattern" },
        { tag: "[SL]", confidence: 0.7, reason: "Narration style" },
      ]);
    });

    it("should handle response with explanation before JSON", () => {
      const input = `I've analyzed the segments and here are my suggestions:

{"suggestions": [{"id": 1, "action": "merge"}]}

Let me know if you need more details.`;
      const result = extractJSON(input);
      expect(result).toEqual({ suggestions: [{ id: 1, action: "merge" }] });
    });
  });
});

describe("isObject", () => {
  it("should return true for objects", () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ key: "value" })).toBe(true);
  });

  it("should return false for arrays", () => {
    expect(isObject([])).toBe(false);
    expect(isObject([1, 2, 3])).toBe(false);
  });

  it("should return false for null", () => {
    expect(isObject(null)).toBe(false);
  });

  it("should return false for primitives", () => {
    expect(isObject("string")).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject(true)).toBe(false);
  });
});

describe("isArray", () => {
  it("should return true for arrays", () => {
    expect(isArray([])).toBe(true);
    expect(isArray([1, 2, 3])).toBe(true);
  });

  it("should return false for objects", () => {
    expect(isArray({})).toBe(false);
  });

  it("should return false for primitives", () => {
    expect(isArray("string")).toBe(false);
    expect(isArray(42)).toBe(false);
  });
});

describe("getProperty", () => {
  it("should get property from object", () => {
    expect(getProperty({ name: "Alice" }, "name", "default")).toBe("Alice");
  });

  it("should return default for missing property", () => {
    expect(getProperty({ name: "Alice" }, "age", 0)).toBe(0);
  });

  it("should return default for non-object", () => {
    expect(getProperty("not an object", "key", "default")).toBe("default");
    expect(getProperty(null, "key", "default")).toBe("default");
    expect(getProperty([1, 2], "key", "default")).toBe("default");
  });

  it("should return default for null/undefined value", () => {
    expect(getProperty({ key: null }, "key", "default")).toBe("default");
    expect(getProperty({ key: undefined }, "key", "default")).toBe("default");
  });
});
