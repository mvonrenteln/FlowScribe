/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";
import {
  applyRecoveryStrategies,
  createStandardStrategies,
  jsonSubstringStrategy,
  lenientParseStrategy,
  type RecoveryStrategy,
} from "../recoveryStrategies";
import type { SimpleSchema } from "../types";

const arraySchemaWithValues: SimpleSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "string" },
      value: { type: "number" },
    },
    required: ["id", "value"],
  },
};

const arraySchemaWithIds: SimpleSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "string" },
    },
    required: ["id"],
  },
};

describe("RecoveryStrategies", () => {
  describe("applyRecoveryStrategies", () => {
    it("should return data from first successful strategy", () => {
      const strategies: RecoveryStrategy<{ id: string }>[] = [
        {
          name: "fail-strategy",
          attempt: () => null,
        },
        {
          name: "success-strategy",
          attempt: () => [{ id: "1" }],
        },
        {
          name: "not-called",
          attempt: vi.fn(() => [{ id: "2" }]),
        },
      ];

      const result = applyRecoveryStrategies('{"invalid"}', strategies);

      expect(result.data).toEqual([{ id: "1" }]);
      expect(result.usedStrategy).toBe("success-strategy");
      expect(result.attemptedStrategies).toBe(2);
      expect(strategies[2].attempt).not.toHaveBeenCalled();
    });

    it("should return null when all strategies fail", () => {
      const strategies: RecoveryStrategy<unknown>[] = [
        { name: "fail-1", attempt: () => null },
        { name: "fail-2", attempt: () => [] },
        {
          name: "fail-3",
          attempt: () => {
            throw new Error("fail");
          },
        },
      ];

      const result = applyRecoveryStrategies("invalid", strategies);

      expect(result.data).toBeNull();
      expect(result.usedStrategy).toBeNull();
      expect(result.attemptedStrategies).toBe(3);
    });

    it("should handle strategy throwing errors", () => {
      const strategies: RecoveryStrategy<unknown>[] = [
        {
          name: "throw-strategy",
          attempt: () => {
            throw new Error("Strategy failed");
          },
        },
        {
          name: "success-strategy",
          attempt: () => [{ id: "1" }],
        },
      ];

      const result = applyRecoveryStrategies("test", strategies);

      expect(result.data).toEqual([{ id: "1" }]);
      expect(result.usedStrategy).toBe("success-strategy");
    });

    it("should skip strategies that return empty arrays", () => {
      const strategies: RecoveryStrategy<unknown>[] = [
        { name: "empty", attempt: () => [] },
        { name: "success", attempt: () => [{ id: "1" }] },
      ];

      const result = applyRecoveryStrategies("test", strategies);

      expect(result.usedStrategy).toBe("success");
    });
  });

  describe("lenientParseStrategy", () => {
    const schema = arraySchemaWithValues;

    it("should parse valid JSON", () => {
      const strategy = lenientParseStrategy(schema);
      const data = [{ id: "1", value: 42 }];
      const result = strategy.attempt(JSON.stringify(data));

      expect(result).toEqual(data);
    });

    it("should handle lenient JSON parsing", () => {
      const strategy = lenientParseStrategy(schema);
      // Trailing comma is lenient JSON
      const result = strategy.attempt('[{"id":"1","value":42,}]');

      expect(result).toBeTruthy();
      expect(result?.[0].id).toBe("1");
    });

    it("should return null for invalid data", () => {
      const strategy = lenientParseStrategy(schema);
      const result = strategy.attempt("not json at all");

      expect(result).toBeNull();
    });

    it("should return null when schema validation fails", () => {
      const strategy = lenientParseStrategy(schema);
      const result = strategy.attempt('[{"id":"1"}]'); // missing value

      expect(result).toBeNull();
    });
  });

  describe("jsonSubstringStrategy", () => {
    it("should extract valid JSON array from text", () => {
      const strategy = jsonSubstringStrategy<{ id: string }>();
      const text = 'Some text before [{"id":"1"},{"id":"2"}] and after';
      const result = strategy.attempt(text);

      expect(result).toEqual([{ id: "1" }, { id: "2" }]);
    });

    it("should return null when no brackets found", () => {
      const strategy = jsonSubstringStrategy();
      const result = strategy.attempt("no brackets here");

      expect(result).toBeNull();
    });

    it("should return null for invalid JSON", () => {
      const strategy = jsonSubstringStrategy();
      const result = strategy.attempt("[{invalid json}]");

      expect(result).toBeNull();
    });

    it("should return null for empty array", () => {
      const strategy = jsonSubstringStrategy();
      const result = strategy.attempt("[]");

      expect(result).toBeNull();
    });

    it("should handle nested brackets", () => {
      const strategy = jsonSubstringStrategy<{ data: { id: string } }>();
      const text = '[{"data":{"id":"1"}}]';
      const result = strategy.attempt(text);

      expect(result).toEqual([{ data: { id: "1" } }]);
    });
  });

  describe("createStandardStrategies", () => {
    const schema = arraySchemaWithIds;
    const typeGuard = (item: unknown): item is { id: string } =>
      typeof item === "object" && item !== null && "id" in item;

    it("should create array of strategies", () => {
      const strategies = createStandardStrategies(schema, typeGuard);

      expect(strategies).toHaveLength(3);
      expect(strategies[0].name).toBe("lenient-parse");
      expect(strategies[1].name).toBe("partial-array");
      expect(strategies[2].name).toBe("json-substring");
    });

    it("should create functional strategies", () => {
      const strategies = createStandardStrategies(schema, typeGuard);
      const validJson = '[{"id":"1"}]';

      // First strategy should succeed
      const result = strategies[0].attempt(validJson);
      expect(result).toEqual([{ id: "1" }]);
    });

    it("should work with applyRecoveryStrategies", () => {
      const strategies = createStandardStrategies(schema, typeGuard);
      const text = 'Wrapped [{"id":"test"}] in text';

      const result = applyRecoveryStrategies(text, strategies);

      expect(result.data).toBeTruthy();
      expect(result.usedStrategy).toBeTruthy();
    });
  });

  describe("Strategy Integration", () => {
    it("should fall back through strategies correctly", () => {
      const schema = arraySchemaWithValues;
      const typeGuard = (item: unknown): item is { id: string } =>
        typeof item === "object" && item !== null && "id" in item;

      const strategies = createStandardStrategies(schema, typeGuard);

      // This should fail lenient parse but succeed with JSON substring
      const malformed = 'Error: [{"id":"1"}]';
      const result = applyRecoveryStrategies(malformed, strategies);

      expect(result.data).toEqual([{ id: "1" }]);
      expect(result.usedStrategy).toBe("partial-array");
      expect(result.attemptedStrategies).toBeGreaterThan(1);
    });
  });
});
