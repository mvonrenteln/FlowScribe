import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStorageScheduler } from "@/lib/storage";

class MockWorker {
  static instances: MockWorker[] = [];
  lastMessage: unknown;
  private messageHandler: ((event: MessageEvent<unknown>) => void) | null = null;

  constructor() {
    MockWorker.instances.push(this);
  }

  addEventListener(type: "message", handler: (event: MessageEvent<unknown>) => void) {
    if (type === "message") {
      this.messageHandler = handler;
    }
  }

  postMessage(message: unknown) {
    this.lastMessage = message;
  }

  emitMessage(data: unknown) {
    this.messageHandler?.({ data } as MessageEvent<unknown>);
  }

  terminate() {}
}

const sessionsState = {
  sessions: { demo: { segments: [], speakers: [], tags: [] } },
  activeSessionKey: "demo",
};
const globalState = { lexiconEntries: [], spellcheckEnabled: false };

describe("createStorageScheduler (worker serialization)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    MockWorker.instances = [];
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("writes persisted state after worker serialization", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const schedule = createStorageScheduler(0, () => new MockWorker());

    schedule(sessionsState, globalState);
    vi.runAllTimers();

    const worker = MockWorker.instances[0];
    const posted = worker?.lastMessage as { jobId: number };
    expect(posted?.jobId).toBe(1);
    expect(setItemSpy).not.toHaveBeenCalled();

    worker.emitMessage({
      jobId: posted.jobId,
      sessionsJson: JSON.stringify(sessionsState),
      globalJson: JSON.stringify(globalState),
    });

    expect(setItemSpy).toHaveBeenCalledWith("flowscribe:sessions", JSON.stringify(sessionsState));
    expect(setItemSpy).toHaveBeenCalledWith("flowscribe:global", JSON.stringify(globalState));
  });

  it("ignores stale worker responses when a newer job is scheduled", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const schedule = createStorageScheduler(0, () => new MockWorker());

    schedule(sessionsState, globalState);
    vi.runAllTimers();

    const worker = MockWorker.instances[0];
    const first = worker?.lastMessage as { jobId: number };

    schedule(
      { ...sessionsState, activeSessionKey: "newer" },
      { ...globalState, spellcheckEnabled: true },
    );
    vi.runAllTimers();

    const second = worker?.lastMessage as { jobId: number };
    expect(second.jobId).toBeGreaterThan(first.jobId);

    worker.emitMessage({
      jobId: first.jobId,
      sessionsJson: JSON.stringify(sessionsState),
      globalJson: JSON.stringify(globalState),
    });
    expect(setItemSpy).not.toHaveBeenCalled();

    worker.emitMessage({
      jobId: second.jobId,
      sessionsJson: JSON.stringify({ ...sessionsState, activeSessionKey: "newer" }),
      globalJson: JSON.stringify({ ...globalState, spellcheckEnabled: true }),
    });
    expect(setItemSpy).toHaveBeenCalled();
  });
});

describe("createStorageScheduler (sync fallback)", () => {
  const windowWithIdle = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  const originalRequestIdleCallback = windowWithIdle.requestIdleCallback;
  const originalCancelIdleCallback = windowWithIdle.cancelIdleCallback;

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    if (originalRequestIdleCallback) {
      windowWithIdle.requestIdleCallback = originalRequestIdleCallback;
    } else {
      delete windowWithIdle.requestIdleCallback;
    }
    if (originalCancelIdleCallback) {
      windowWithIdle.cancelIdleCallback = originalCancelIdleCallback;
    } else {
      delete windowWithIdle.cancelIdleCallback;
    }
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("defers sync fallback persistence with requestIdleCallback when available", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const idleCallbackSpy = vi.fn((callback: IdleRequestCallback, options?: IdleRequestOptions) => {
      callback({ didTimeout: false, timeRemaining: () => 50 });
      expect(options?.timeout).toBeTypeOf("number");
      return 1;
    });
    windowWithIdle.requestIdleCallback = idleCallbackSpy;
    windowWithIdle.cancelIdleCallback = vi.fn();

    const schedule = createStorageScheduler(0, () => null);
    schedule(sessionsState, globalState);
    vi.runAllTimers();

    expect(idleCallbackSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith("flowscribe:sessions", JSON.stringify(sessionsState));
    expect(setItemSpy).toHaveBeenCalledWith("flowscribe:global", JSON.stringify(globalState));
  });

  it("falls back to timeout if requestIdleCallback never fires", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const idleCallbackSpy = vi.fn(() => 42);
    const cancelIdleCallbackSpy = vi.fn();
    windowWithIdle.requestIdleCallback = idleCallbackSpy;
    windowWithIdle.cancelIdleCallback = cancelIdleCallbackSpy;

    const schedule = createStorageScheduler(0, () => null);
    schedule(sessionsState, globalState);
    vi.runAllTimers();

    expect(idleCallbackSpy).toHaveBeenCalledTimes(1);
    expect(cancelIdleCallbackSpy).toHaveBeenCalledWith(42);
    expect(setItemSpy).toHaveBeenCalledWith("flowscribe:sessions", JSON.stringify(sessionsState));
    expect(setItemSpy).toHaveBeenCalledWith("flowscribe:global", JSON.stringify(globalState));
  });

  it("logs when sync fallback payloads are large", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const largeValue = "x".repeat(300_000);
    const schedule = createStorageScheduler(0, () => null);

    schedule(
      {
        sessions: {
          demo: {
            segments: [],
            speakers: [],
            tags: [],
            transcriptRef: { name: largeValue },
          },
        },
        activeSessionKey: "demo",
      },
      { lexiconEntries: [largeValue], spellcheckEnabled: false },
    );
    vi.runAllTimers();

    expect(warnSpy).toHaveBeenCalledWith(
      "Large sync fallback persistence payload; expect main-thread work.",
      { totalChars: expect.any(Number) },
    );
  });

  it("uses setTimeout fallback when requestIdleCallback is unavailable", () => {
    delete windowWithIdle.requestIdleCallback;
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    const schedule = createStorageScheduler(0, () => null);
    schedule(sessionsState, globalState);
    vi.runAllTimers();

    expect(setItemSpy).toHaveBeenCalledWith("flowscribe:sessions", JSON.stringify(sessionsState));
    expect(setItemSpy).toHaveBeenCalledWith("flowscribe:global", JSON.stringify(globalState));
  });

  it("only persists latest state when multiple fallback writes are scheduled", () => {
    delete windowWithIdle.requestIdleCallback;
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    // Use non-zero throttle to allow separate schedule cycles
    const schedule = createStorageScheduler(100, () => null);

    // Schedule first write
    const firstState = { ...sessionsState, activeSessionKey: "first" };
    schedule(firstState, globalState);

    // Schedule second write immediately (within throttle window)
    // This will overwrite pendingSessions/pendingGlobal before persist runs
    const secondState = { ...sessionsState, activeSessionKey: "second" };
    const updatedGlobal = { ...globalState, spellcheckEnabled: true };
    schedule(secondState, updatedGlobal);

    // Advance time to trigger the throttled persist (only one cycle runs due to throttling)
    vi.runAllTimers();

    // Verify first (stale) state was never persisted
    const firstStateJson = JSON.stringify(firstState);
    expect(setItemSpy).not.toHaveBeenCalledWith("flowscribe:sessions", firstStateJson);

    // Verify only the latest state was persisted
    const allSessionsCalls = setItemSpy.mock.calls.filter(
      (call) => call[0] === "flowscribe:sessions",
    );
    const allGlobalCalls = setItemSpy.mock.calls.filter((call) => call[0] === "flowscribe:global");

    // Should only have one call for each key (throttling coalesced the writes)
    expect(allSessionsCalls).toHaveLength(1);
    expect(allGlobalCalls).toHaveLength(1);

    expect(allSessionsCalls[0][1]).toBe(JSON.stringify(secondState));
    expect(allGlobalCalls[0][1]).toBe(JSON.stringify(updatedGlobal));
  });

  it("prevents out-of-order writes when deferred callbacks execute late", () => {
    // Mock setTimeout to capture callbacks without executing them
    const deferredCallbacks: Array<() => void> = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      callback: () => void,
      delay: number,
    ) => {
      if (delay === 0) {
        // This is a syncFallback callback - capture it
        deferredCallbacks.push(callback);
        return 999 as unknown as ReturnType<typeof setTimeout>;
      }
      // This is a persistTimeout - execute normally
      return originalSetTimeout(callback, delay);
    }) as typeof setTimeout);

    delete windowWithIdle.requestIdleCallback;
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const schedule = createStorageScheduler(100, () => null);

    // Schedule first write and complete throttle cycle
    const firstState = { ...sessionsState, activeSessionKey: "first" };
    schedule(firstState, globalState);
    vi.advanceTimersByTime(100); // syncFallback1 captured, not executed

    // Schedule second write and complete throttle cycle
    const secondState = { ...sessionsState, activeSessionKey: "second" };
    const updatedGlobal = { ...globalState, spellcheckEnabled: true };
    schedule(secondState, updatedGlobal);
    vi.advanceTimersByTime(100); // syncFallback2 captured, not executed

    // Now execute both deferred callbacks (simulating delayed execution)
    for (const cb of deferredCallbacks) {
      cb();
    }

    // Verify first (stale) state was never persisted
    const firstStateJson = JSON.stringify(firstState);
    expect(setItemSpy).not.toHaveBeenCalledWith("flowscribe:sessions", firstStateJson);

    // Verify only the latest state was persisted
    const allSessionsCalls = setItemSpy.mock.calls.filter(
      (call) => call[0] === "flowscribe:sessions",
    );
    const allGlobalCalls = setItemSpy.mock.calls.filter((call) => call[0] === "flowscribe:global");

    expect(allSessionsCalls).toHaveLength(1);
    expect(allGlobalCalls).toHaveLength(1);

    expect(allSessionsCalls[0][1]).toBe(JSON.stringify(secondState));
    expect(allGlobalCalls[0][1]).toBe(JSON.stringify(updatedGlobal));

    vi.mocked(globalThis.setTimeout).mockRestore();
  });

  it("prevents out-of-order writes with requestIdleCallback", () => {
    const idleCallbacks: Array<() => void> = [];
    windowWithIdle.requestIdleCallback = vi.fn((callback: () => void) => {
      idleCallbacks.push(callback);
      return idleCallbacks.length;
    });

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    // Use non-zero throttle to allow separate schedule cycles
    const schedule = createStorageScheduler(100, () => null);

    // Schedule first write and complete the throttle cycle
    const firstState = { ...sessionsState, activeSessionKey: "first" };
    schedule(firstState, globalState);
    vi.advanceTimersByTime(100); // Complete first throttle cycle, requestIdleCallback(syncFallback) is queued

    // Schedule second write before first callback executes
    const secondState = { ...sessionsState, activeSessionKey: "second" };
    const updatedGlobal = { ...globalState, spellcheckEnabled: true };
    schedule(secondState, updatedGlobal);
    vi.advanceTimersByTime(100); // Complete second throttle cycle, requestIdleCallback(syncFallback) is queued

    // Verify two callbacks were captured
    expect(idleCallbacks).toHaveLength(2);

    // Execute callbacks in order (simulating idle callback queue)
    for (const cb of idleCallbacks) {
      cb();
    }

    // Verify first (stale) state was never persisted
    const firstStateJson = JSON.stringify(firstState);
    expect(setItemSpy).not.toHaveBeenCalledWith("flowscribe:sessions", firstStateJson);

    // Verify only the latest state was persisted
    const allSessionsCalls = setItemSpy.mock.calls.filter(
      (call) => call[0] === "flowscribe:sessions",
    );
    const allGlobalCalls = setItemSpy.mock.calls.filter((call) => call[0] === "flowscribe:global");

    // Should only have one call for each key
    expect(allSessionsCalls).toHaveLength(1);
    expect(allGlobalCalls).toHaveLength(1);

    expect(allSessionsCalls[0][1]).toBe(JSON.stringify(secondState));
    expect(allGlobalCalls[0][1]).toBe(JSON.stringify(updatedGlobal));
  });
});
