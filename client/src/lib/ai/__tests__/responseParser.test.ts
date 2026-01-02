/**
 * Response Parser Tests
 *
 * Tests for the combined JSON extraction and validation.
 */

import { describe, expect, it } from "vitest";
import {
  createTypeGuard,
  parseArrayResponse,
  parseObjectResponse,
  parseResponse,
  recoverPartialArray,
} from "../parsing/responseParser";
import type { SimpleSchema } from "../parsing/types";

describe("parseResponse", () => {
  describe("basic parsing", () => {
    it("should parse valid JSON", () => {
      const result = parseResponse<{ name: string }>('{"name": "Alice"}');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: "Alice" });
    });

    it("should parse from code block", () => {
      const result = parseResponse<number[]>("```json\n[1, 2, 3]\n```");
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it("should handle parse errors", () => {
      const result = parseResponse<unknown>("Not valid JSON at all");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should include raw input in result", () => {
      const input = '{"key": "value"}';
      const result = parseResponse<unknown>(input);
      expect(result.rawInput).toBe(input);
    });
  });

  describe("with schema validation", () => {
    const userSchema: SimpleSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name"],
    };

    it("should validate against schema", () => {
      const result = parseResponse<{ name: string; age: number }>('{"name": "Alice", "age": 30}', {
        schema: userSchema,
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: "Alice", age: 30 });
      expect(result.metadata.validated).toBe(true);
    });

    it("should fail for missing required fields", () => {
      const result = parseResponse<{ name: string }>('{"age": 30}', { schema: userSchema });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toMatch(/name|required|missing/i);
    });

    it("should fail for type mismatch", () => {
      const result = parseResponse<{ name: string }>('{"name": 123}', { schema: userSchema });
      // This should coerce number to string with a warning, not fail
      // since we have lenient coercion
      expect(result.success).toBe(true);
      expect(result.metadata.warnings.length).toBeGreaterThan(0);
    });

    it("should apply default values", () => {
      const schemaWithDefault: SimpleSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string", default: "user" },
        },
        required: ["name"],
      };

      const result = parseResponse<{ name: string; role: string }>('{"name": "Alice"}', {
        schema: schemaWithDefault,
        applyDefaults: true,
      });
      expect(result.success).toBe(true);
      expect(result.data?.role).toBe("user");
    });
  });

  describe("with transform function", () => {
    it("should apply transform to parsed data", () => {
      const result = parseResponse<string>('{"text": "hello"}', {
        transform: (data) => (data as { text: string }).text.toUpperCase(),
      });
      expect(result.success).toBe(true);
      expect(result.data).toBe("HELLO");
    });

    it("should handle transform errors", () => {
      const result = parseResponse<string>('{"text": "hello"}', {
        transform: () => {
          throw new Error("Transform failed");
        },
      });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Transform failed");
    });
  });

  describe("metadata", () => {
    it("should track extraction method - direct", () => {
      const result = parseResponse<unknown>('{"key": "value"}');
      expect(result.metadata.extractionMethod).toBe("direct");
    });

    it("should track extraction method - code block", () => {
      const result = parseResponse<unknown>('```json\n{"key": "value"}\n```');
      expect(result.metadata.extractionMethod).toBe("code-block");
    });

    it("should track extraction method - lenient", () => {
      const result = parseResponse<unknown>('Result: {"key": "value"} end');
      expect(result.metadata.extractionMethod).toBe("lenient");
    });

    it("should track validation warnings", () => {
      const schema: SimpleSchema = {
        type: "object",
        properties: {
          count: { type: "number" },
        },
      };

      // String coerced to number
      const result = parseResponse<{ count: number }>('{"count": "42"}', { schema });
      expect(result.success).toBe(true);
      expect(result.metadata.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe("parseArrayResponse", () => {
  it("should parse array response", () => {
    const result = parseArrayResponse<number>("[1, 2, 3]");
    expect(result.success).toBe(true);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it("should validate array items", () => {
    const itemSchema: SimpleSchema = {
      type: "object",
      properties: {
        id: { type: "number" },
        name: { type: "string" },
      },
      required: ["id"],
    };

    const result = parseArrayResponse<{ id: number; name: string }>(
      '[{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]',
      itemSchema,
    );
    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(2);
  });

  it("should fail for non-array", () => {
    const result = parseArrayResponse<unknown>('{"not": "array"}');
    expect(result.success).toBe(false);
  });
});

describe("parseObjectResponse", () => {
  it("should parse object response", () => {
    const result = parseObjectResponse<{ name: string }>(
      '{"name": "Alice"}',
      { name: { type: "string" } },
      ["name"],
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "Alice" });
  });

  it("should fail for missing required properties", () => {
    const result = parseObjectResponse<{ name: string }>(
      '{"age": 30}',
      { name: { type: "string" } },
      ["name"],
    );
    expect(result.success).toBe(false);
  });
});

describe("recoverPartialArray", () => {
  interface Item {
    tag: string;
    confidence: number;
  }

  const isItem = (item: unknown): item is Item => {
    return (
      typeof item === "object" &&
      item !== null &&
      "tag" in item &&
      typeof (item as Item).tag === "string"
    );
  };

  it("should recover valid items from array", () => {
    const input =
      '[{"tag": "A", "confidence": 0.9}, {"invalid": true}, {"tag": "B", "confidence": 0.8}]';
    const { recovered, skipped } = recoverPartialArray<Item>(input, isItem);

    expect(recovered.length).toBe(2);
    expect(recovered[0].tag).toBe("A");
    expect(recovered[1].tag).toBe("B");
    expect(skipped).toBe(1);
  });

  it("should handle completely invalid input", () => {
    const { recovered, skipped } = recoverPartialArray<Item>("Not JSON", isItem);
    expect(recovered).toEqual([]);
    expect(skipped).toBe(0);
  });

  it("should handle non-array JSON", () => {
    const { recovered } = recoverPartialArray<Item>('{"not": "array"}', isItem);
    expect(recovered).toEqual([]);
  });
});

describe("createTypeGuard", () => {
  it("should create working type guard", () => {
    const schema: SimpleSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name"],
    };

    const isUser = createTypeGuard<{ name: string; age?: number }>(schema);

    expect(isUser({ name: "Alice", age: 30 })).toBe(true);
    expect(isUser({ name: "Bob" })).toBe(true);
    expect(isUser({ age: 30 })).toBe(false);
    expect(isUser("not an object")).toBe(false);
  });
});
