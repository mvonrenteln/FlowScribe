import { beforeEach, describe, expect, it, vi } from "vitest";

// Dynamic import to get a fresh module for each test
describe("persistenceGuard", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("starts with persistence not suppressed", async () => {
    const { isPersistenceSuppressed } = await import("../persistenceGuard");
    expect(isPersistenceSuppressed()).toBe(false);
  });

  it("returns true after suppressPersistence() is called", async () => {
    const { isPersistenceSuppressed, suppressPersistence } = await import("../persistenceGuard");

    suppressPersistence();

    expect(isPersistenceSuppressed()).toBe(true);
  });

  it("stays suppressed once set (no unsuppress)", async () => {
    const { isPersistenceSuppressed, suppressPersistence } = await import("../persistenceGuard");

    suppressPersistence();
    suppressPersistence(); // idempotent

    expect(isPersistenceSuppressed()).toBe(true);
  });
});
