/**
 * Batch Processing Utilities Tests
 *
 * Tests for core batch processing functions.
 */

import { describe, expect, it } from "vitest";
import {
  buildMap,
  calculateBatches,
  filterItems,
  filterSegments,
  prepareBatch,
  sliceBatch,
} from "../core/batch";

describe("sliceBatch", () => {
  const items = [1, 2, 3, 4, 5];

  it("should slice from start", () => {
    expect(sliceBatch(items, 0, 2)).toEqual([1, 2]);
  });

  it("should slice from middle", () => {
    expect(sliceBatch(items, 2, 2)).toEqual([3, 4]);
  });

  it("should handle end of array", () => {
    expect(sliceBatch(items, 3, 5)).toEqual([4, 5]);
  });

  it("should handle out of bounds start", () => {
    expect(sliceBatch(items, 10, 2)).toEqual([]);
  });

  it("should handle empty array", () => {
    expect(sliceBatch([], 0, 10)).toEqual([]);
  });
});

describe("prepareBatch", () => {
  const items = [
    { id: "1", value: "a" },
    { id: "2", value: "b" },
    { id: "3", value: "c" },
  ];

  it("should transform items in batch", () => {
    const result = prepareBatch(items, 0, 2, (item) => item.id);
    expect(result).toEqual(["1", "2"]);
  });

  it("should slice correctly before transform", () => {
    const result = prepareBatch(items, 1, 2, (item) => item.value.toUpperCase());
    expect(result).toEqual(["B", "C"]);
  });
});

describe("filterItems", () => {
  const items = [
    { name: "Alice", active: true },
    { name: "Bob", active: false },
    { name: "Charlie", active: true },
  ];

  it("should filter by include values", () => {
    const result = filterItems(items, {
      includeValues: ["Alice", "Bob"],
      getValue: (i) => i.name,
    });
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.name)).toEqual(["Alice", "Bob"]);
  });

  it("should filter by exclusion condition", () => {
    const result = filterItems(items, {
      getValue: (i) => i.name,
      excludeIf: (i) => !i.active,
    });
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.active)).toBe(true);
  });

  it("should combine include and exclude", () => {
    const result = filterItems(items, {
      includeValues: ["Alice", "Bob"],
      getValue: (i) => i.name,
      excludeIf: (i) => !i.active,
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice");
  });

  it("should be case insensitive by default", () => {
    const result = filterItems(items, {
      includeValues: ["ALICE"],
      getValue: (i) => i.name,
    });
    expect(result).toHaveLength(1);
  });

  it("should support case sensitive matching", () => {
    const result = filterItems(items, {
      includeValues: ["ALICE"],
      getValue: (i) => i.name,
      caseInsensitive: false,
    });
    expect(result).toHaveLength(0);
  });

  it("should return all when no filters", () => {
    const result = filterItems(items, {
      getValue: (i) => i.name,
    });
    expect(result).toHaveLength(3);
  });
});

describe("filterSegments", () => {
  const segments = [
    { id: "1", speaker: "Alice", confirmed: false },
    { id: "2", speaker: "Bob", confirmed: true },
    { id: "3", speaker: "Alice", confirmed: false },
  ];

  it("should filter by speakers", () => {
    const result = filterSegments(segments, ["Alice"], false);
    expect(result).toHaveLength(2);
  });

  it("should exclude confirmed", () => {
    const result = filterSegments(segments, [], true);
    expect(result).toHaveLength(2);
    expect(result.find((s) => s.id === "2")).toBeUndefined();
  });

  it("should combine filters", () => {
    const result = filterSegments(segments, ["Alice", "Bob"], true);
    expect(result).toHaveLength(2);
  });
});

describe("buildMap", () => {
  it("should build map from items", () => {
    const items = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
    const map = buildMap(
      items,
      (i) => i.id,
      (i) => i.name,
    );
    expect(map.get("1")).toBe("Alice");
    expect(map.get("2")).toBe("Bob");
  });

  it("should handle empty array", () => {
    const map = buildMap(
      [],
      () => "k",
      () => "v",
    );
    expect(map.size).toBe(0);
  });

  it("should handle duplicate keys (last wins)", () => {
    const items = [
      { id: "1", name: "First" },
      { id: "1", name: "Second" },
    ];
    const map = buildMap(
      items,
      (i) => i.id,
      (i) => i.name,
    );
    expect(map.get("1")).toBe("Second");
  });
});

describe("calculateBatches", () => {
  it("should calculate batches correctly", () => {
    const batches = calculateBatches(10, 3);
    expect(batches).toHaveLength(4);
    expect(batches[0]).toEqual({ index: 0, start: 0, end: 3, size: 3 });
    expect(batches[1]).toEqual({ index: 1, start: 3, end: 6, size: 3 });
    expect(batches[2]).toEqual({ index: 2, start: 6, end: 9, size: 3 });
    expect(batches[3]).toEqual({ index: 3, start: 9, end: 10, size: 1 });
  });

  it("should handle exact division", () => {
    const batches = calculateBatches(6, 2);
    expect(batches).toHaveLength(3);
    expect(batches.every((b) => b.size === 2)).toBe(true);
  });

  it("should handle zero items", () => {
    const batches = calculateBatches(0, 5);
    expect(batches).toHaveLength(0);
  });

  it("should handle batch size larger than items", () => {
    const batches = calculateBatches(3, 10);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual({ index: 0, start: 0, end: 3, size: 3 });
  });
});
