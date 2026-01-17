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
  const OriginalWorker = globalThis.Worker;

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    MockWorker.instances = [];
    globalThis.Worker = MockWorker as unknown as typeof Worker;
  });

  afterEach(() => {
    globalThis.Worker = OriginalWorker;
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("writes persisted state after worker serialization", () => {
    const setItemSpy = vi.spyOn(window.localStorage, "setItem");
    const schedule = createStorageScheduler(0);

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
    const setItemSpy = vi.spyOn(window.localStorage, "setItem");
    const schedule = createStorageScheduler(0);

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
