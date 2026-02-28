import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockWriteSessionsSync, mockWriteGlobalState, mockSuppressPersistence } = vi.hoisted(() => ({
  mockWriteSessionsSync: vi.fn().mockReturnValue(true),
  mockWriteGlobalState: vi.fn().mockReturnValue(true),
  mockSuppressPersistence: vi.fn(),
}));

// Must mock before importing the module under test
vi.mock("@/lib/storage", () => ({
  writeSessionsSync: mockWriteSessionsSync,
  writeGlobalState: mockWriteGlobalState,
}));

vi.mock("@/lib/store/persistenceGuard", () => ({
  suppressPersistence: mockSuppressPersistence,
}));

vi.mock("../snapshotSerializer", () => ({
  deserializeSnapshot: vi.fn(),
}));

import type { BackupProvider } from "../BackupProvider";
import { restoreSnapshot } from "../restore";
import { deserializeSnapshot } from "../snapshotSerializer";
import type { SnapshotEntry } from "../types";

const mockDeserializeSnapshot = vi.mocked(deserializeSnapshot);

const fakeEntry: SnapshotEntry = {
  filename: "sessions/abc123/snap-1.bin",
  sessionKeyHash: "abc123",
  sessionLabel: "Test Session",
  createdAt: Date.now(),
  reason: "manual",
  appVersion: "1.0.0",
  schemaVersion: 1,
  compressedSize: 1024,
  checksum: "deadbeef",
};

const fakeSnapshot = {
  schemaVersion: 1,
  appVersion: "1.0.0",
  createdAt: Date.now(),
  sessionKey: "session-key-1",
  reason: "manual" as const,
  checksum: "deadbeef",
  session: {
    audioRef: null,
    transcriptRef: null,
    segments: [{ id: "seg-1", text: "Hello", start: 0, end: 1 }],
    speakers: [],
    tags: [],
    selectedSegmentId: null,
    currentTime: 0,
    isWhisperXFormat: false,
  },
};

const fakeProvider: BackupProvider = {
  isSupported: vi.fn().mockReturnValue(true),
  enable: vi.fn().mockResolvedValue({ ok: true, locationLabel: "test-location" }),
  verifyAccess: vi.fn().mockResolvedValue(true),
  writeSnapshot: vi.fn(),
  writeManifest: vi.fn(),
  readManifest: vi
    .fn()
    .mockResolvedValue({ manifestVersion: 1, snapshots: [], globalSnapshots: [] }),
  readSnapshot: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  deleteSnapshots: vi.fn(),
};

describe("restoreSnapshot", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockWriteSessionsSync.mockReturnValue(true);
    mockWriteGlobalState.mockReturnValue(true);
    mockDeserializeSnapshot.mockResolvedValue(fakeSnapshot as never);
    (fakeProvider.readSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Uint8Array([1, 2, 3]),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes restored session data to localStorage and returns ok", async () => {
    const result = await restoreSnapshot(fakeProvider, fakeEntry);

    expect(result).toEqual({ ok: true });
    expect(mockWriteSessionsSync).toHaveBeenCalledWith({
      sessions: { "session-key-1": fakeSnapshot.session },
      activeSessionKey: "session-key-1",
    });
  });

  it("suppresses persistence before writing to prevent store from overwriting restored data", async () => {
    const result = await restoreSnapshot(fakeProvider, fakeEntry);

    expect(result.ok).toBe(true);
    expect(mockSuppressPersistence).toHaveBeenCalledOnce();
    const writeOrder = mockWriteSessionsSync.mock.invocationCallOrder[0];
    const suppressOrder = mockSuppressPersistence.mock.invocationCallOrder[0];
    expect(suppressOrder).toBeLessThan(writeOrder);
  });

  it("returns error when writeSessionsSync fails", async () => {
    mockWriteSessionsSync.mockReturnValue(false);

    const result = await restoreSnapshot(fakeProvider, fakeEntry);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("localStorage");
    }
    expect(mockSuppressPersistence).toHaveBeenCalledOnce();
  });

  it("returns error when snapshot file is not found", async () => {
    (fakeProvider.readSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await restoreSnapshot(fakeProvider, fakeEntry);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not found");
    }
  });

  it("writes globalState when snapshot includes it", async () => {
    const globalState = { backupConfig: { enabled: true } };
    mockDeserializeSnapshot.mockResolvedValue({
      ...fakeSnapshot,
      globalState,
    } as never);

    const result = await restoreSnapshot(fakeProvider, fakeEntry);

    expect(result.ok).toBe(true);
    expect(mockWriteGlobalState).toHaveBeenCalledWith(globalState);
  });

  it("does not write globalState when snapshot does not include it", async () => {
    const result = await restoreSnapshot(fakeProvider, fakeEntry);

    expect(result.ok).toBe(true);
    expect(mockWriteGlobalState).not.toHaveBeenCalled();
  });
});
