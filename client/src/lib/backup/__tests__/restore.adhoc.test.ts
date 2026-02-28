import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersistedSessionsState } from "../../store/types";
import type { BackupProvider } from "../BackupProvider";
import { checkForRestoreCandidate, openRestoreFromFolder, validateManifest } from "../restore";
import type { BackupManifest, SnapshotEntry } from "../types";

// Mock FileSystemProvider so tests do not touch the real File System Access API
const mockReadManifest = vi.fn();
const mockFromHandle = vi.fn();

vi.mock("@/lib/backup/providers/FileSystemProvider", () => ({
  FileSystemProvider: {
    fromHandle: (...args: unknown[]) => mockFromHandle(...args),
  },
}));

type ExtendedWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
};

const fakeHandle = { name: "backup-folder" } as unknown as FileSystemDirectoryHandle;

const validSnapshotEntry: SnapshotEntry = {
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

const validManifest: BackupManifest = {
  manifestVersion: 1,
  snapshots: [validSnapshotEntry],
  globalSnapshots: [],
};

const makeProvider = (manifest: unknown = null) => {
  const provider = { readManifest: mockReadManifest };
  mockFromHandle.mockReturnValue(provider);
  mockReadManifest.mockResolvedValue(manifest);
  return provider;
};

describe("openRestoreFromFolder", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    delete (window as ExtendedWindow).showDirectoryPicker;
  });

  it("throws when File System Access API is not supported", async () => {
    delete (window as ExtendedWindow).showDirectoryPicker;

    await expect(openRestoreFromFolder()).rejects.toThrow(
      "File System Access API not supported in this browser",
    );
  });

  it("re-throws AbortError when the user cancels the picker", async () => {
    const mockPicker = vi
      .fn()
      .mockRejectedValue(new DOMException("The user aborted a request.", "AbortError"));
    (window as ExtendedWindow).showDirectoryPicker = mockPicker;

    await expect(openRestoreFromFolder()).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(mockPicker).toHaveBeenCalledOnce();
  });

  it("throws when the selected folder has no manifest.json", async () => {
    const mockPicker = vi.fn().mockResolvedValue(fakeHandle);
    (window as ExtendedWindow).showDirectoryPicker = mockPicker;

    makeProvider(null); // readManifest returns null

    await expect(openRestoreFromFolder()).rejects.toThrow("Not a valid FlowScribe backup folder");
    expect(mockFromHandle).toHaveBeenCalledWith(fakeHandle);
  });

  it("throws when the manifest exists but contains no snapshots", async () => {
    const mockPicker = vi.fn().mockResolvedValue(fakeHandle);
    (window as ExtendedWindow).showDirectoryPicker = mockPicker;

    makeProvider({ manifestVersion: 1, snapshots: [], globalSnapshots: [] });

    await expect(openRestoreFromFolder()).rejects.toThrow("Not a valid FlowScribe backup folder");
  });

  it("returns provider, manifest, and handle on success", async () => {
    const manifest = validManifest;
    const mockPicker = vi.fn().mockResolvedValue(fakeHandle);
    (window as ExtendedWindow).showDirectoryPicker = mockPicker;

    const provider = makeProvider(manifest);

    const result = await openRestoreFromFolder();

    expect(result.handle).toBe(fakeHandle);
    expect(result.provider).toBe(provider);
    expect(result.manifest).toBe(manifest);
    expect(mockPicker).toHaveBeenCalledWith({ mode: "readwrite" });
    expect(mockFromHandle).toHaveBeenCalledWith(fakeHandle);
  });
});

describe("validateManifest", () => {
  it("passes for a valid manifest", () => {
    expect(validateManifest(validManifest)).toBe(true);
  });

  it("fails when manifestVersion is missing", () => {
    const manifest = {
      snapshots: [validSnapshotEntry],
      globalSnapshots: [],
    };

    expect(validateManifest(manifest)).toBe(false);
  });

  it("fails when manifestVersion is wrong", () => {
    const manifest = {
      ...validManifest,
      manifestVersion: 2,
    };

    expect(validateManifest(manifest)).toBe(false);
  });

  it("fails when snapshots is not an array", () => {
    const manifest = {
      ...validManifest,
      snapshots: null,
    };

    expect(validateManifest(manifest)).toBe(false);
  });

  it("fails when snapshot entry is missing filename", () => {
    const invalidSnapshot = {
      ...validSnapshotEntry,
      filename: undefined,
    };
    const manifest = {
      ...validManifest,
      snapshots: [invalidSnapshot],
    };

    expect(validateManifest(manifest)).toBe(false);
  });
});

describe("checkForRestoreCandidate", () => {
  it("returns null when manifest schema is invalid", async () => {
    const provider: BackupProvider = {
      isSupported: vi.fn().mockReturnValue(true),
      enable: vi.fn().mockResolvedValue({ ok: true, locationLabel: "test-location" }),
      verifyAccess: vi.fn().mockResolvedValue(true),
      writeSnapshot: vi.fn(),
      writeManifest: vi.fn(),
      readManifest: vi.fn().mockResolvedValue({ snapshots: [], globalSnapshots: [] }),
      readSnapshot: vi.fn().mockResolvedValue(null),
      deleteSnapshots: vi.fn(),
    };
    const currentSessionsState: PersistedSessionsState = {
      sessions: {},
      activeSessionKey: null,
    };

    const result = await checkForRestoreCandidate(provider, currentSessionsState);

    expect(result).toBeNull();
  });
});
