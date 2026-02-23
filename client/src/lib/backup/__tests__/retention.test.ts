import { describe, expect, it } from "vitest";
import { pruneManifest } from "../retention";
import type { BackupManifest, SnapshotEntry } from "../types";

const makeEntry = (
  sessionKeyHash: string,
  createdAt: number,
  overrides?: Partial<SnapshotEntry>,
): SnapshotEntry => ({
  filename: `sessions/${sessionKeyHash}/${createdAt}_scheduled.json.gz`,
  sessionKeyHash,
  sessionLabel: null,
  createdAt,
  reason: "scheduled",
  appVersion: "1.0.0",
  schemaVersion: 1,
  compressedSize: 100,
  checksum: "abc123",
  ...overrides,
});

const makeGlobalEntry = (createdAt: number): SnapshotEntry =>
  makeEntry("global", createdAt, {
    filename: `global/${createdAt}_scheduled.json.gz`,
    sessionKeyHash: "global",
  });

describe("pruneManifest", () => {
  it("keeps newest N snapshots per session", () => {
    const manifest: BackupManifest = {
      manifestVersion: 1,
      snapshots: [
        makeEntry("abc", 1000),
        makeEntry("abc", 2000),
        makeEntry("abc", 3000),
        makeEntry("abc", 4000),
        makeEntry("abc", 5000),
      ],
      globalSnapshots: [],
    };

    const { manifest: pruned, toDelete } = pruneManifest(manifest, 3, 20);

    expect(pruned.snapshots).toHaveLength(3);
    // Should keep the 3 newest
    const kept = pruned.snapshots.map((e) => e.createdAt);
    expect(kept).toContain(5000);
    expect(kept).toContain(4000);
    expect(kept).toContain(3000);

    // Should delete the 2 oldest
    expect(toDelete).toHaveLength(2);
    expect(toDelete.some((f) => f.includes("1000"))).toBe(true);
    expect(toDelete.some((f) => f.includes("2000"))).toBe(true);
  });

  it("handles multiple sessions independently", () => {
    const manifest: BackupManifest = {
      manifestVersion: 1,
      snapshots: [
        makeEntry("session1", 1000),
        makeEntry("session1", 2000),
        makeEntry("session1", 3000),
        makeEntry("session2", 100),
        makeEntry("session2", 200),
      ],
      globalSnapshots: [],
    };

    const { manifest: pruned, toDelete } = pruneManifest(manifest, 2, 20);

    const s1 = pruned.snapshots.filter((e) => e.sessionKeyHash === "session1");
    const s2 = pruned.snapshots.filter((e) => e.sessionKeyHash === "session2");
    expect(s1).toHaveLength(2);
    expect(s2).toHaveLength(2);
    expect(toDelete).toHaveLength(1);
    // Oldest of session1 (1000) should be deleted
    expect(toDelete[0]).toContain("1000");
  });

  it("respects global snapshot limit", () => {
    const manifest: BackupManifest = {
      manifestVersion: 1,
      snapshots: [],
      globalSnapshots: [
        makeGlobalEntry(100),
        makeGlobalEntry(200),
        makeGlobalEntry(300),
        makeGlobalEntry(400),
        makeGlobalEntry(500),
      ],
    };

    const { manifest: pruned, toDelete } = pruneManifest(manifest, 50, 3);

    expect(pruned.globalSnapshots).toHaveLength(3);
    expect(toDelete).toHaveLength(2);
    // Kept newest 3: 300, 400, 500
    const kept = pruned.globalSnapshots.map((e) => e.createdAt);
    expect(kept).toContain(500);
    expect(kept).toContain(400);
    expect(kept).toContain(300);
  });

  it("returns empty toDelete for empty manifest", () => {
    const manifest: BackupManifest = {
      manifestVersion: 1,
      snapshots: [],
      globalSnapshots: [],
    };

    const { manifest: pruned, toDelete } = pruneManifest(manifest, 50, 20);
    expect(pruned.snapshots).toHaveLength(0);
    expect(pruned.globalSnapshots).toHaveLength(0);
    expect(toDelete).toHaveLength(0);
  });

  it("keeps all when under limits", () => {
    const manifest: BackupManifest = {
      manifestVersion: 1,
      snapshots: [makeEntry("abc", 1000), makeEntry("abc", 2000)],
      globalSnapshots: [makeGlobalEntry(100)],
    };

    const { toDelete } = pruneManifest(manifest, 50, 20);
    expect(toDelete).toHaveLength(0);
  });

  it("returns correct toDelete list when both session and global need pruning", () => {
    const manifest: BackupManifest = {
      manifestVersion: 1,
      snapshots: [makeEntry("sess", 1), makeEntry("sess", 2), makeEntry("sess", 3)],
      globalSnapshots: [makeGlobalEntry(10), makeGlobalEntry(20), makeGlobalEntry(30)],
    };

    const { toDelete } = pruneManifest(manifest, 2, 2);
    expect(toDelete).toHaveLength(2);
    // oldest session entry (1) and oldest global entry (10) should be in toDelete
    expect(toDelete.some((f) => f.includes("_1_") || f.includes("/1_"))).toBe(true);
    expect(toDelete.some((f) => f.includes("_10_") || f.includes("/10_"))).toBe(true);
  });
});
