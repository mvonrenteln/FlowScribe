import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BackupProvider } from "../BackupProvider";
import { BackupScheduler } from "../BackupScheduler";
import type { BackupConfig } from "../types";
import { DEFAULT_BACKUP_CONFIG } from "../types";

// Mock storage module
vi.mock("@/lib/storage", () => ({
  readSessionsState: () => ({
    sessions: {
      "session-key": {
        audioRef: null,
        transcriptRef: null,
        segments: [{ id: "1", text: "hello", speaker: "A", start: 0, end: 1, words: [] }],
        speakers: [],
        tags: [],
        selectedSegmentId: null,
        currentTime: 0,
        isWhisperXFormat: false,
      },
    },
    activeSessionKey: "session-key",
  }),
  readGlobalState: () => null,
}));

// Mock snapshotSerializer to avoid slow crypto/compression in unit tests
vi.mock("../snapshotSerializer", () => ({
  computeChecksum: vi.fn(
    async () => "aabbccdd001122334455aabbccdd001122334455aabbccdd001122334455aa00",
  ),
  serializeSnapshot: vi.fn(async () => new Uint8Array([1, 2, 3])),
  deserializeSnapshot: vi.fn(async () => ({})),
  compress: vi.fn(async (b: Uint8Array) => b),
  decompress: vi.fn(async (b: Uint8Array) => b),
}));

const makeMockProvider = (): BackupProvider => ({
  isSupported: vi.fn(() => true),
  enable: vi.fn(async () => ({ ok: true, locationLabel: "test-dir" }) as const),
  verifyAccess: vi.fn(async () => true),
  writeSnapshot: vi.fn(async () => undefined),
  writeManifest: vi.fn(async () => undefined),
  readManifest: vi.fn(async () => null),
  readSnapshot: vi.fn(async () => null),
  deleteSnapshots: vi.fn(async () => undefined),
});

const makeStore = (config?: Partial<BackupConfig>) => {
  let state = {
    segments: [{ id: "1" }] as unknown[],
    sessionKey: "session-key",
    sessionLabel: null as string | null,
    backupConfig: { ...DEFAULT_BACKUP_CONFIG, enabled: true, ...config },
    setBackupConfig: vi.fn((patch: Partial<BackupConfig>) => {
      state.backupConfig = { ...state.backupConfig, ...patch };
    }),
  };
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify: () => {
      for (const l of listeners) l();
    },
    setState: (updates: Partial<typeof state>) => {
      state = { ...state, ...updates };
    },
  };
};

describe("BackupScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("detects dirty session when segments change", async () => {
    const provider = makeMockProvider();
    const store = makeStore();
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    // Notify with new state (2 segments — dirtyKey changes)
    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
    store.notify();

    // Advance time past debounce and flush all pending promises
    await vi.advanceTimersByTimeAsync(31_000);
    // Flush the async backupBatch chain
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(provider.writeSnapshot).toHaveBeenCalled();
    scheduler.stop();
  });

  it("debounce collapses rapid changes into one backup call", async () => {
    const provider = makeMockProvider();
    const store = makeStore();
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    // Rapid changes within debounce window
    for (let i = 1; i <= 5; i++) {
      store.setState({ segments: Array(i).fill({ id: `${i}` }) as unknown[] });
      store.notify();
      await vi.advanceTimersByTimeAsync(5_000);
    }

    // Still within debounce window (5 * 5s = 25s < 30s debounce)
    expect(provider.writeSnapshot).not.toHaveBeenCalled();

    // Advance past debounce and flush
    await vi.advanceTimersByTimeAsync(30_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(provider.writeSnapshot).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it("critical event triggers immediate backup", async () => {
    const provider = makeMockProvider();
    const store = makeStore();
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    // Mark dirty
    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
    store.notify();

    // Dispatch critical event before debounce fires
    window.dispatchEvent(new CustomEvent("flowscribe:backup-critical"));

    // Flush the async backupNow → backupBatch chain
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(provider.writeSnapshot).toHaveBeenCalled();
    scheduler.stop();
  });

  it("does not backup when disabled", async () => {
    const provider = makeMockProvider();
    const store = makeStore({ enabled: false });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
    store.notify();

    await vi.advanceTimersByTimeAsync(60_000);
    await Promise.resolve();

    expect(provider.writeSnapshot).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it("reminder not shown when disableDirtyReminders is true", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const provider = makeMockProvider();
    // Provider does not support FS (simulates Firefox)
    (provider.isSupported as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const store = makeStore({ disableDirtyReminders: true });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    // Mark dirty
    store.setState({ segments: [{ id: "1" }] as unknown[] });
    store.notify();

    // Advance past reminder interval (20 min)
    await vi.advanceTimersByTimeAsync(25 * 60_000);

    const reminderEvents = dispatchSpy.mock.calls.filter(
      (call) =>
        call[0] instanceof CustomEvent &&
        (call[0] as CustomEvent).type === "flowscribe:backup-reminder",
    );
    expect(reminderEvents).toHaveLength(0);
    scheduler.stop();
  });

  it("updates backupConfig after successful backup", async () => {
    const provider = makeMockProvider();
    const store = makeStore();
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
    store.notify();

    await vi.advanceTimersByTimeAsync(31_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const setConfigCalls = (store.getState().setBackupConfig as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(setConfigCalls.length).toBeGreaterThan(0);
    const lastCall = setConfigCalls[setConfigCalls.length - 1][0] as Partial<BackupConfig>;
    expect(lastCall).toMatchObject({ status: "enabled" });
    expect(lastCall.lastBackupAt).toBeTypeOf("number");
    scheduler.stop();
  });
});
