import { describe, expect, it } from "vitest";
import { indexById, mapById } from "../arrayUtils";

describe("arrayUtils", () => {
  it("indexById returns empty map for empty array", () => {
    const map = indexById<{ id: string }>([]);
    expect(map.size).toBe(0);
  });

  it("indexById maps ids to indices", () => {
    const arr = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const map = indexById(arr);
    expect(map.get("a")).toBe(0);
    expect(map.get("b")).toBe(1);
    expect(map.get("c")).toBe(2);
  });

  it("indexById keeps first index for duplicate ids", () => {
    const arr: { id: string }[] = [{ id: "x" }, { id: "y" }, { id: "x" }];
    const map = indexById(arr);
    expect(map.get("x")).toBe(0);
    expect(map.get("y")).toBe(1);
  });

  it("mapById returns element map and keeps first item on duplicates", () => {
    const first = { id: "1", v: 1 };
    const second = { id: "2", v: 2 };
    const dup = { id: "1", v: 3 };
    const map = mapById([first, second, dup]);
    expect(map.get("1")).toBe(first);
    expect(map.get("2")).toBe(second);
  });
});
