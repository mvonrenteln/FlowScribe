import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BackupProvider } from "../BackupProvider";
import { BackupScheduler } from "../BackupScheduler";
import type { BackupConfig, BackupState } from "../types";
import { DEFAULT_BACKUP_CONFIG, DEFAULT_BACKUP_STATE } from "../types";

// Mutable mock so individual tests can override readGlobalState per-call.
const mockReadGlobalState = vi.fn(() => null as Record<string, unknown> | null);

// Mock storage module — readSessionsState is no longer called by BackupScheduler;
// the scheduler reads from getSessionsCache() on the MinimalStore instead.
vi.mock("@/lib/storage", () => ({
  readGlobalState: () => mockReadGlobalState(),
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

/** Default session content used by makeStore (matches the session-key entry). */
const DEFAULT_SESSION_ENTRY = {
  audioRef: null,
  transcriptRef: null,
  segments: [{ id: "1", text: "hello", speaker: "A", start: 0, end: 1, words: [] }] as unknown[],
  speakers: [] as unknown[],
  tags: [] as unknown[],
  chapters: [] as unknown[],
  selectedSegmentId: null,
  currentTime: 0,
  isWhisperXFormat: false,
};

const makeStore = (config?: Partial<BackupConfig>) => {
  let state = {
    segments: [{ id: "1" }] as unknown[],
    speakers: [] as unknown[],
    tags: [] as unknown[],
    chapters: [] as unknown[],
    sessionKey: "session-key",
    sessionLabel: null as string | null,
    globalStateFingerprint: "fp-initial",
    backupConfig: { ...DEFAULT_BACKUP_CONFIG, enabled: true, ...config },
    backupState: { ...DEFAULT_BACKUP_STATE, status: "enabled" } as BackupState,
    setBackupConfig: vi.fn((patch: Partial<BackupConfig>) => {
      state.backupConfig = { ...state.backupConfig, ...patch };
    }),
    setBackupState: vi.fn((patch: Partial<BackupState>) => {
      state.backupState = { ...state.backupState, ...patch };
    }),
  };
  // Start with a sessions cache that mirrors the initial store state.
  let sessionsCache: Record<string, typeof DEFAULT_SESSION_ENTRY> = {
    "session-key": { ...DEFAULT_SESSION_ENTRY },
  };
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    getSessionsCache: () => sessionsCache as Record<string, unknown>,
    /** Replaces the entry for the active session key in the cache. */
    setSessionEntry: (entry: Partial<typeof DEFAULT_SESSION_ENTRY>) => {
      sessionsCache = {
        ...sessionsCache,
        [state.sessionKey]: { ...DEFAULT_SESSION_ENTRY, ...entry },
      };
    },
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

  it("non-content changes (same array references) do not mark session dirty", async () => {
    const provider = makeMockProvider();
    const store = makeStore({ backupIntervalMinutes: 5 });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    // Notify without changing any content references (pure UI-state changes like currentTime)
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

  it("prevents concurrent backupNow calls from writing duplicate snapshots", async () => {
    const provider = makeMockProvider();
    const store = makeStore({ backupIntervalMinutes: 5, includeGlobalState: false });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
    store.notify();

    await Promise.all([scheduler.backupNow("manual"), scheduler.backupNow("manual")]);

    expect(provider.writeSnapshot).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it("dispatches flowscribe:backup-complete after a successful critical backup", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const provider = makeMockProvider();
    const store = makeStore({ backupIntervalMinutes: 5 });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
    store.notify();

    window.dispatchEvent(new CustomEvent("flowscribe:backup-critical"));

    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const completeEvents = dispatchSpy.mock.calls.filter(
      ([e]) => e instanceof CustomEvent && (e as CustomEvent).type === "flowscribe:backup-complete",
    );
    expect(completeEvents).toHaveLength(1);
    scheduler.stop();
  });

  it("does not dispatch flowscribe:backup-complete for scheduled backups", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const provider = makeMockProvider();
    const store = makeStore({ backupIntervalMinutes: 5 });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
    store.notify();

    // Advance to trigger scheduled backup
    await vi.advanceTimersByTimeAsync(INTERVAL_MS + 60_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const completeEvents = dispatchSpy.mock.calls.filter(
      ([e]) => e instanceof CustomEvent && (e as CustomEvent).type === "flowscribe:backup-complete",
    );
    expect(completeEvents).toHaveLength(0);
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

  it("updates backupState after a successful backup", async () => {
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

    const setStateCalls = (store.getState().setBackupState as ReturnType<typeof vi.fn>).mock.calls;
    expect(setStateCalls.length).toBeGreaterThan(0);
    const lastCall = setStateCalls[setStateCalls.length - 1][0] as Partial<BackupState>;
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

  // ─── Session-dirty isolation tests ────────────────────────────────────────

  describe("session dirty isolation", () => {
    it("detects dirty when segment content changes but count stays the same", async () => {
      const provider = makeMockProvider();
      const store = makeStore({ backupIntervalMinutes: 5 });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      // Replace the segments array with a NEW reference but same element count.
      // This simulates editing a segment's text, speaker, or timestamps.
      store.setState({ segments: [{ id: "1", text: "edited" }] as unknown[] });
      store.notify();

      await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(provider.writeSnapshot).toHaveBeenCalled();
      scheduler.stop();
    });

    it("detects dirty when speakers change", async () => {
      const provider = makeMockProvider();
      const store = makeStore({ backupIntervalMinutes: 5 });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      // Segments unchanged, but speakers reference is new (user renamed a speaker)
      store.setState({ speakers: [{ id: "A", name: "Alice" }] as unknown[] });
      store.notify();

      await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(provider.writeSnapshot).toHaveBeenCalled();
      scheduler.stop();
    });

    it("detects dirty when tags change", async () => {
      const provider = makeMockProvider();
      const store = makeStore({ backupIntervalMinutes: 5 });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      store.setState({ tags: [{ id: "t1", label: "Important" }] as unknown[] });
      store.notify();

      await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(provider.writeSnapshot).toHaveBeenCalled();
      scheduler.stop();
    });

    it("detects dirty when chapters change", async () => {
      const provider = makeMockProvider();
      const store = makeStore({ backupIntervalMinutes: 5 });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      store.setState({ chapters: [{ id: "c1", title: "Intro" }] as unknown[] });
      store.notify();

      await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(provider.writeSnapshot).toHaveBeenCalled();
      scheduler.stop();
    });

    it("resets sessionDirty after a successful backup and does not re-write unchanged session", async () => {
      const provider = makeMockProvider();
      const store = makeStore({ backupIntervalMinutes: 5 });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      // First cycle: edit triggers backup
      store.setState({ segments: [{ id: "1", text: "v1" }] as unknown[] });
      store.notify();

      await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const callsAfterFirst = (provider.writeSnapshot as ReturnType<typeof vi.fn>).mock.calls
        .length;
      expect(callsAfterFirst).toBeGreaterThan(0);

      // Second interval: no reference change — session NOT dirty anymore
      await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect((provider.writeSnapshot as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
        callsAfterFirst,
      );

      scheduler.stop();
    });
  });

  // ─── Global-dirty isolation tests ─────────────────────────────────────────

  describe("global dirty isolation", () => {
    beforeEach(() => {
      mockReadGlobalState.mockReturnValue({ lexiconEntries: [] });
    });

    afterEach(() => {
      mockReadGlobalState.mockReturnValue(null);
    });

    it("does NOT write a global snapshot when only session content changes", async () => {
      const provider = makeMockProvider();
      const store = makeStore({ backupIntervalMinutes: 5, includeGlobalState: true });
      const scheduler = new BackupScheduler(provider);
      // Start with fingerprint that never changes (global state unchanged)
      scheduler.start(store);

      // Only session segments change — globalStateFingerprint stays the same
      store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
      store.notify();

      await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const calls = (provider.writeSnapshot as ReturnType<typeof vi.fn>).mock.calls as Array<
        [{ sessionKeyHash: string }]
      >;
      const globalCalls = calls.filter(([entry]) => entry.sessionKeyHash === "global");
      expect(globalCalls).toHaveLength(0);

      // Session snapshot must still have been written
      const sessionCalls = calls.filter(([entry]) => entry.sessionKeyHash !== "global");
      expect(sessionCalls.length).toBeGreaterThan(0);

      scheduler.stop();
    });

    it("DOES write a global snapshot when globalStateFingerprint changes", async () => {
      const provider = makeMockProvider();
      const store = makeStore({ backupIntervalMinutes: 5, includeGlobalState: true });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      // Change the fingerprint to signal global state modification
      store.setState({ globalStateFingerprint: "fp-changed" });
      store.notify();

      await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const calls = (provider.writeSnapshot as ReturnType<typeof vi.fn>).mock.calls as Array<
        [{ sessionKeyHash: string; filename: string }]
      >;
      const globalCalls = calls.filter(([entry]) => entry.sessionKeyHash === "global");
      expect(globalCalls.length).toBeGreaterThan(0);

      // Global entry filename must use the canonical sessions/global/... path
      const globalFilename = (globalCalls[0][0] as { filename: string }).filename;
      expect(globalFilename).toMatch(/^sessions\/global\//);
      expect(globalFilename).not.toMatch(/^global\//);

      scheduler.stop();
    });

    it("does NOT write a session snapshot when only global state changes", async () => {
      const provider = makeMockProvider();
      const store = makeStore({ backupIntervalMinutes: 5, includeGlobalState: true });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      // Change only fingerprint — session segments unchanged
      store.setState({ globalStateFingerprint: "fp-global-only" });
      store.notify();

      await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const calls = (provider.writeSnapshot as ReturnType<typeof vi.fn>).mock.calls as Array<
        [{ sessionKeyHash: string }]
      >;
      const sessionCalls = calls.filter(([entry]) => entry.sessionKeyHash !== "global");
      expect(sessionCalls).toHaveLength(0);

      scheduler.stop();
    });

    it("resets globalDirty after a successful backup and does not re-write unchanged global state", async () => {
      const provider = makeMockProvider();
      const store = makeStore({ backupIntervalMinutes: 5, includeGlobalState: true });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      // First cycle: global fingerprint changes → triggers global backup
      store.setState({
        segments: [{ id: "1" }, { id: "2" }] as unknown[],
        globalStateFingerprint: "fp-v2",
      });
      store.notify();

      await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const callsAfterFirst = (provider.writeSnapshot as ReturnType<typeof vi.fn>).mock.calls
        .length;
      expect(callsAfterFirst).toBeGreaterThan(0);

      // Second cycle: same fingerprint, different session content
      store.setState({ segments: [{ id: "1" }, { id: "2" }, { id: "3" }] as unknown[] });
      store.notify();

      await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const callsAfterSecond = (provider.writeSnapshot as ReturnType<typeof vi.fn>).mock.calls;
      const globalCallsSecond = (callsAfterSecond as Array<[{ sessionKeyHash: string }]>).filter(
        ([entry]) => entry.sessionKeyHash === "global",
      );

      // Global snapshot should NOT have been written a second time
      expect(globalCallsSecond).toHaveLength(1);

      scheduler.stop();
    });

    it("preserves globalDirty when includeGlobalState is disabled and writes after re-enabling", async () => {
      const provider = makeMockProvider();
      const store = makeStore({
        backupIntervalMinutes: 5,
        includeGlobalState: false,
      });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      store.setState({ globalStateFingerprint: "fp-global-dirty-persisted" });
      store.notify();

      await scheduler.backupNow("manual");

      store.setState({
        backupConfig: { ...store.getState().backupConfig, includeGlobalState: true },
      });
      await scheduler.backupNow("manual");

      const calls = (provider.writeSnapshot as ReturnType<typeof vi.fn>).mock.calls as Array<
        [{ sessionKeyHash: string }]
      >;
      const globalCalls = calls.filter(([entry]) => entry.sessionKeyHash === "global");
      expect(globalCalls).toHaveLength(1);

      scheduler.stop();
    });
  });

  it("dispatches reminder when provider is unsupported and a session stays dirty past threshold", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const provider = makeMockProvider();
    (provider.isSupported as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const store = makeStore({ backupIntervalMinutes: 60, disableDirtyReminders: false });
    const scheduler = new BackupScheduler(provider);
    scheduler.start(store);

    store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
    store.notify();

    await vi.advanceTimersByTimeAsync(41 * 60_000);

    const reminderEvents = dispatchSpy.mock.calls.filter(
      ([event]) => event instanceof CustomEvent && event.type === "flowscribe:backup-reminder",
    );
    expect(reminderEvents).toHaveLength(1);

    scheduler.stop();
  });

  // ─── isSaving / isDirty state tracking ────────────────────────────────────

  describe("isSaving and isDirty state tracking", () => {
    it("sets isDirty=true in backupState when content changes", () => {
      const provider = makeMockProvider();
      const store = makeStore({ backupIntervalMinutes: 5 });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      // Simulate content change
      store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
      store.notify();

      const setStateCalls = (store.getState().setBackupState as ReturnType<typeof vi.fn>).mock
        .calls as Array<[Partial<BackupState>]>;
      const dirtyCall = setStateCalls.find(([patch]) => patch.isDirty === true);
      expect(dirtyCall).toBeDefined();

      scheduler.stop();
    });

    it("sets isSaving=true then isSaving=false and isDirty=false after successful backup", async () => {
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

      const setStateCalls = (store.getState().setBackupState as ReturnType<typeof vi.fn>).mock
        .calls as Array<[Partial<BackupState>]>;

      // isSaving=true must have been set before the backup write
      const savingStartCall = setStateCalls.find(([patch]) => patch.isSaving === true);
      expect(savingStartCall).toBeDefined();

      // Final call must clear isSaving and isDirty
      const lastPatch = setStateCalls[setStateCalls.length - 1][0];
      expect(lastPatch).toMatchObject({ isSaving: false, isDirty: false, status: "enabled" });

      scheduler.stop();
    });

    it("clears isSaving=false on backup error", async () => {
      const provider = makeMockProvider();
      (provider.verifyAccess as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (provider.writeSnapshot as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("disk full"),
      );
      const store = makeStore({ backupIntervalMinutes: 5 });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
      store.notify();

      await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const setStateCalls = (store.getState().setBackupState as ReturnType<typeof vi.fn>).mock
        .calls as Array<[Partial<BackupState>]>;

      const lastPatch = setStateCalls[setStateCalls.length - 1][0];
      expect(lastPatch).toMatchObject({ status: "error", isSaving: false });

      scheduler.stop();
    });

    it("does not set isDirty when content is unchanged (no-op notify)", () => {
      const provider = makeMockProvider();
      const store = makeStore({ backupIntervalMinutes: 5 });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      // Notify without changing content
      store.notify();

      const setStateCalls = (store.getState().setBackupState as ReturnType<typeof vi.fn>).mock
        .calls as Array<[Partial<BackupState>]>;
      const dirtyCall = setStateCalls.find(([patch]) => patch.isDirty === true);
      expect(dirtyCall).toBeUndefined();

      scheduler.stop();
    });
  });

  describe("beforeunload flag", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("writes dirty-unload flag to localStorage when dirty on beforeunload", () => {
      const provider = makeMockProvider();
      const store = makeStore({ backupIntervalMinutes: 5 });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
      store.notify();

      window.dispatchEvent(new Event("beforeunload"));

      expect(localStorage.getItem("flowscribe:dirty-unload")).not.toBeNull();
      scheduler.stop();
    });

    it("does NOT write flag when not dirty on beforeunload", () => {
      const provider = makeMockProvider();
      const store = makeStore({ backupIntervalMinutes: 5 });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      // Do not notify or change content — store should not be dirty
      window.dispatchEvent(new Event("beforeunload"));

      expect(localStorage.getItem("flowscribe:dirty-unload")).toBeNull();
      scheduler.stop();
    });

    it("does NOT write the old sessionStorage key", () => {
      const provider = makeMockProvider();
      const store = makeStore({ backupIntervalMinutes: 5 });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      store.setState({ segments: [{ id: "1" }, { id: "2" }] as unknown[] });
      store.notify();
      window.dispatchEvent(new Event("beforeunload"));

      expect(sessionStorage.getItem("flowscribe:backup-dirty")).toBeNull();
      scheduler.stop();
    });
  });

  // ─── In-memory cache regression ───────────────────────────────────────────

  describe("snapshot data source: in-memory cache, not localStorage", () => {
    it("uses getSessionsCache() data so a critical backup captures edits not yet flushed to localStorage", async () => {
      // Regression for: backupBatch used readSessionsState() (localStorage) rather
      // than the in-memory sessions cache, causing snapshots to silently capture
      // stale data when the throttled persistence worker had not yet flushed.

      const provider = makeMockProvider();
      const { serializeSnapshot } = await import("../snapshotSerializer");
      const store = makeStore({ backupIntervalMinutes: 5 });
      const scheduler = new BackupScheduler(provider);
      scheduler.start(store);

      // Simulate an edit that is in-memory (cache) but NOT yet in localStorage.
      // We put the latest data only in the sessions cache via setSessionEntry and
      // mark the session dirty by changing the store's segments reference.
      const latestSegments = [{ id: "1", text: "updated-only-in-memory" }] as unknown[];
      store.setSessionEntry({ segments: latestSegments });
      store.setState({ segments: latestSegments });
      store.notify();

      // Trigger a critical backup (bypasses the grace period immediately)
      window.dispatchEvent(new CustomEvent("flowscribe:backup-critical"));
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // The snapshot must have been written
      expect(provider.writeSnapshot).toHaveBeenCalled();

      // Verify that serializeSnapshot was called with the in-memory session data
      // (segments from getSessionsCache, not the stale localStorage copy).
      const serializeCalls = (serializeSnapshot as ReturnType<typeof vi.fn>).mock.calls as Array<
        [{ session: { segments: unknown[] } }]
      >;
      expect(serializeCalls.length).toBeGreaterThan(0);
      const capturedSession = serializeCalls[serializeCalls.length - 1][0].session;
      expect((capturedSession.segments[0] as { text: string }).text).toBe("updated-only-in-memory");

      scheduler.stop();
    });
  });
});
