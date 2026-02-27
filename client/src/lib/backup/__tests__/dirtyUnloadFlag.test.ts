import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDirtyUnloadFlag,
  DIRTY_UNLOAD_KEY,
  readDirtyUnloadFlag,
  setDirtyUnloadFlag,
} from "../dirtyUnloadFlag";

describe("dirtyUnloadFlag", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("setDirtyUnloadFlag() writes a numeric timestamp string to localStorage", () => {
    setDirtyUnloadFlag();
    const value = localStorage.getItem(DIRTY_UNLOAD_KEY);
    expect(value).not.toBeNull();
    expect(Number(value)).toBe(Date.now());
  });

  it("readDirtyUnloadFlag() returns { present: true, age } for a fresh flag", () => {
    setDirtyUnloadFlag();
    const result = readDirtyUnloadFlag();
    expect(result).toEqual({ present: true, age: 0 });
  });

  it("readDirtyUnloadFlag() returns { present: false } when no flag exists", () => {
    const result = readDirtyUnloadFlag();
    expect(result).toEqual({ present: false });
  });

  it("readDirtyUnloadFlag() returns { present: false } and removes the key for a stale flag (>24h)", () => {
    setDirtyUnloadFlag();
    vi.advanceTimersByTime(24 * 60 * 60_000 + 1_000); // 24h + 1s
    const result = readDirtyUnloadFlag();
    expect(result).toEqual({ present: false });
    expect(localStorage.getItem(DIRTY_UNLOAD_KEY)).toBeNull();
  });

  it("readDirtyUnloadFlag() returns { present: false } for a corrupt/non-numeric value", () => {
    localStorage.setItem(DIRTY_UNLOAD_KEY, "not-a-number");
    const result = readDirtyUnloadFlag();
    expect(result).toEqual({ present: false });
  });

  it("clearDirtyUnloadFlag() removes the key from localStorage", () => {
    setDirtyUnloadFlag();
    expect(localStorage.getItem(DIRTY_UNLOAD_KEY)).not.toBeNull();
    clearDirtyUnloadFlag();
    expect(localStorage.getItem(DIRTY_UNLOAD_KEY)).toBeNull();
  });

  it("each function handles localStorage errors gracefully (no throws)", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() => setDirtyUnloadFlag()).not.toThrow();

    setItemSpy.mockRestore();

    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("access denied");
    });

    expect(() => readDirtyUnloadFlag()).not.toThrow();
    expect(readDirtyUnloadFlag()).toEqual({ present: false });

    getItemSpy.mockRestore();

    const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("access denied");
    });

    expect(() => clearDirtyUnloadFlag()).not.toThrow();

    removeItemSpy.mockRestore();
  });
});
