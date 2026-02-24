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

  // All tests use backupIntervalMinutes: 5 (300 s) to keep timer advances short.
  const INTERVAL_MS = 5 * 60_000;

  it("backs up after the configured interval when not actively editing", async () => {
    const provider = makeMockProvider();
    const store = makeStore({ backupIntervalMinutes: 5 });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    // Mark session dirty (segment count changes)
    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
    store.notify();

    // Advance just past the 5-minute interval
    await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(provider.writeSnapshot).toHaveBeenCalled();
    scheduler.stop();
  });

  it("defers backup by grace period when user is actively editing at interval fire time", async () => {
    const provider = makeMockProvider();
    const store = makeStore({ backupIntervalMinutes: 5 });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    // Mark session dirty early on
    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
    store.notify();

    // Just before the interval fires (4:55), simulate a new content change
    // so lastContentChangeAt is only 5 s old when the interval fires
    await vi.advanceTimersByTimeAsync(INTERVAL_MS - 5_000);
    store.setState({ segments: [{ id: "1" }, { id: "2" }, { id: "3" }] as unknown[] });
    store.notify();

    // Interval fires at 5 min — user edited 5 s ago → defer ~25 s
    await vi.advanceTimersByTimeAsync(5_001);
    await Promise.resolve();

    // Must NOT have backed up yet (inside 30 s grace period)
    expect(provider.writeSnapshot).not.toHaveBeenCalled();

    // Advance past the grace period (30 s after last edit)
    await vi.advanceTimersByTimeAsync(30_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(provider.writeSnapshot).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it("forces backup after MAX_DEFER_MS even if user edits continuously", async () => {
    const provider = makeMockProvider();
    const store = makeStore({ backupIntervalMinutes: 5 });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    let segCount = 2;
    store.setState({ segments: Array(segCount).fill({ id: "x" }) as unknown[] });
    store.notify();

    // Advance in 20-second steps making content changes each time.
    // After 5 min: interval fires and starts deferring.
    // After 5 more min (MAX_DEFER_MS): backup is forced despite active editing.
    const steps = (10 * 60_000) / 20_000; // 30 steps of 20 s = 10 min total
    for (let i = 0; i < steps; i++) {
      await vi.advanceTimersByTimeAsync(20_000);
      segCount++;
      store.setState({ segments: Array(segCount).fill({ id: "x" }) as unknown[] });
      store.notify();
    }

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(provider.writeSnapshot).toHaveBeenCalled();
    scheduler.stop();
  });

  it("does not backup before the interval fires even with many content changes", async () => {
    const provider = makeMockProvider();
    const store = makeStore({ backupIntervalMinutes: 5 });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    // Rapid content changes — do not trigger backup on their own
    for (let i = 1; i <= 10; i++) {
      store.setState({ segments: Array(i).fill({ id: `${i}` }) as unknown[] });
      store.notify();
      await vi.advanceTimersByTimeAsync(20_000);
    }

    // Total elapsed: 200 s < 300 s interval → no backup yet
    expect(provider.writeSnapshot).not.toHaveBeenCalled();

    // Advance past the interval
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(provider.writeSnapshot).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it("non-content changes (same segment count) do not mark session dirty", async () => {
    const provider = makeMockProvider();
    const store = makeStore({ backupIntervalMinutes: 5 });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    // Notify without changing segment count (pure UI-state changes)
    store.notify();
    store.notify();
    store.notify();

    // Advance past the interval — interval fires, but isDirty is false → no backup
    await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(provider.writeSnapshot).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it("critical event triggers immediate backup bypassing the grace period", async () => {
    const provider = makeMockProvider();
    const store = makeStore({ backupIntervalMinutes: 5 });
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
    const store = makeStore({ enabled: false, backupIntervalMinutes: 5 });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
    store.notify();

    await vi.advanceTimersByTimeAsync(INTERVAL_MS + 60_000);
    await Promise.resolve();

    expect(provider.writeSnapshot).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it("reminder not shown when disableDirtyReminders is true", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const provider = makeMockProvider();
    // Provider does not support FS (simulates Firefox)
    (provider.isSupported as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const store = makeStore({ disableDirtyReminders: true, backupIntervalMinutes: 5 });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    // Mark dirty (segment count must change so isDirty = true)
    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
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

  it("updates backupConfig after a successful backup", async () => {
    const provider = makeMockProvider();
    const store = makeStore({ backupIntervalMinutes: 5 });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
    store.notify();

    await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
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

  it("does not backup before the interval and does backup after it", async () => {
    const provider = makeMockProvider();
    const store = makeStore({ backupIntervalMinutes: 5 });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
    store.notify();

    // 4 min — interval has not fired yet
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    await Promise.resolve();
    expect(provider.writeSnapshot).not.toHaveBeenCalled();

    // Past 5 min — interval fires
    await vi.advanceTimersByTimeAsync(60_000 + 1_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(provider.writeSnapshot).toHaveBeenCalled();
    scheduler.stop();
  });

  it("restarts hard interval when backupIntervalMinutes changes", async () => {
    const provider = makeMockProvider();
    const store = makeStore({ backupIntervalMinutes: 20 });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    // First dirty cycle: advance past 20-min interval
    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
    store.notify();
    await vi.advanceTimersByTimeAsync(20 * 60_000 + 1_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const callsAfterFirst = (provider.writeSnapshot as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    // Dirty again
    store.setState({ segments: [{ id: "1" }, { id: "2" }, { id: "3" }] as unknown[] });

    // Change config to 5-minute interval — scheduler should restart hard interval
    store.setState({
      backupConfig: { ...store.getState().backupConfig, backupIntervalMinutes: 5 },
    });
    store.notify();

    // Should not fire on the previous 20-min schedule any earlier than 5 min from now;
    // advance 5 min + 1 s to trigger the new shorter interval
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect((provider.writeSnapshot as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      callsAfterFirst,
    );
    scheduler.stop();
  });
});
