import { afterEach, describe, expect, it, vi } from "vitest";
import { createFallbackPersister } from "@/lib/storage/persistenceFallback";
import type { PersistedGlobalState, PersistedSessionsState } from "@/lib/store/types";

const sessionsPayload: PersistedSessionsState = {
  sessions: {},
  activeSessionKey: null,
};

const globalPayload: PersistedGlobalState = {};

describe("createFallbackPersister", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists payloads via localStorage when window is available", () => {
    vi.useFakeTimers();
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    const persister = createFallbackPersister("flowscribe:sessions", "flowscribe:global");

    persister(sessionsPayload, globalPayload);
    vi.runAllTimers();

    expect(setItemSpy).toHaveBeenCalledWith("flowscribe:sessions", JSON.stringify(sessionsPayload));
    expect(setItemSpy).toHaveBeenCalledWith("flowscribe:global", JSON.stringify(globalPayload));
  });

  it("does nothing when window is unavailable", () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const persister = createFallbackPersister("flowscribe:sessions", "flowscribe:global");

    expect(() => persister(sessionsPayload, globalPayload)).not.toThrow();

    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });
});
