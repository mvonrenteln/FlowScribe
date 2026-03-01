import { describe, expect, it, vi } from "vitest";
import type { BackupProvider } from "../BackupProvider";
import { reconcileManifestWithDisk } from "../manifestSync";
import type { BackupManifest, SnapshotEntry } from "../types";

const entry = (filename: string, sessionKeyHash: string): SnapshotEntry => ({
  filename,
  sessionKeyHash,
  sessionLabel: null,
  createdAt: 1,
  reason: "scheduled",
  appVersion: "1.0.0",
  schemaVersion: 1,
  compressedSize: 42,
  checksum: "deadbeef",
});

const makeProvider = (
  existing: Set<string>,
): BackupProvider & { readSnapshot: ReturnType<typeof vi.fn> } => ({
  isSupported: vi.fn(() => true),
  enable: vi.fn(async () => ({ ok: true, locationLabel: "test" }) as const),
  verifyAccess: vi.fn(async () => true),
  writeSnapshot: vi.fn(async () => undefined),
  writeManifest: vi.fn(async () => undefined),
  readManifest: vi.fn(async () => null),
  readSnapshot: vi.fn(async (filename: string) =>
    existing.has(filename) ? new Uint8Array([1, 2, 3]) : null,
  ),
  deleteSnapshots: vi.fn(async () => undefined),
});

describe("reconcileManifestWithDisk", () => {
  it("keeps manifest unchanged when all files exist", async () => {
    const manifest: BackupManifest = {
      manifestVersion: 1,
      snapshots: [entry("sessions/a/1.json.gz", "a")],
      globalSnapshots: [entry("sessions/global/2.json.gz", "global")],
    };
    const provider = makeProvider(new Set(["sessions/a/1.json.gz", "sessions/global/2.json.gz"]));

    const result = await reconcileManifestWithDisk(provider, manifest);

    expect(result.changed).toBe(false);
    expect(result.manifest).toEqual(manifest);
  });

  it("removes snapshot entries whose files are missing", async () => {
    const manifest: BackupManifest = {
      manifestVersion: 1,
      snapshots: [entry("sessions/a/1.json.gz", "a"), entry("sessions/b/2.json.gz", "b")],
      globalSnapshots: [entry("sessions/global/3.json.gz", "global")],
    };
    const provider = makeProvider(new Set(["sessions/a/1.json.gz"]));

    const result = await reconcileManifestWithDisk(provider, manifest);

    expect(result.changed).toBe(true);
    expect(result.manifest.snapshots).toEqual([entry("sessions/a/1.json.gz", "a")]);
    expect(result.manifest.globalSnapshots).toEqual([]);
  });
});
