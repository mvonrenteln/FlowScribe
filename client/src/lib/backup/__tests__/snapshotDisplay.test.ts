import { describe, expect, it } from "vitest";
import {
  formatSnapshotSize,
  groupSnapshotsBySession,
  reasonTranslationKey,
} from "../snapshotDisplay";
import type { SnapshotEntry } from "../types";

const makeEntry = (overrides: Partial<SnapshotEntry> & { sessionKeyHash: string }): SnapshotEntry =>
  ({
    filename: `sessions/${overrides.sessionKeyHash}/snap.br`,
    sessionLabel: null,
    createdAt: Date.now(),
    reason: "manual",
    appVersion: "1.0.0",
    schemaVersion: 1,
    compressedSize: 1024,
    checksum: "abc123",
    ...overrides,
  }) as SnapshotEntry;

// ────────────────────────────────────────────────────────────────
// formatSnapshotSize
// ────────────────────────────────────────────────────────────────
describe("formatSnapshotSize", () => {
  it("formats bytes below 1 MB as KB", () => {
    expect(formatSnapshotSize(512)).toBe("1 KB");
    expect(formatSnapshotSize(1024)).toBe("1 KB");
    expect(formatSnapshotSize(51200)).toBe("50 KB");
    expect(formatSnapshotSize(1_000_000 - 1)).toBe("977 KB");
  });

  it("formats bytes >= 1 MB as MB with one decimal", () => {
    expect(formatSnapshotSize(1_048_576)).toBe("1.0 MB");
    expect(formatSnapshotSize(2_621_440)).toBe("2.5 MB");
  });
});

// ────────────────────────────────────────────────────────────────
// reasonTranslationKey
// ────────────────────────────────────────────────────────────────
describe("reasonTranslationKey", () => {
  const cases: Array<[import("../types").BackupReason, string]> = [
    ["scheduled", "backup.snapshots.reasonScheduled"],
    ["critical", "backup.snapshots.reasonCritical"],
    ["manual", "backup.snapshots.reasonManual"],
    ["enabled", "backup.snapshots.reasonEnabled"],
    ["before-unload", "backup.snapshots.reasonBeforeUnload"],
  ];

  it.each(cases)("maps %s → %s", (reason, expected) => {
    expect(reasonTranslationKey(reason)).toBe(expected);
  });
});

// ────────────────────────────────────────────────────────────────
// groupSnapshotsBySession
// ────────────────────────────────────────────────────────────────
describe("groupSnapshotsBySession", () => {
  it("returns an empty array for no snapshots", () => {
    expect(groupSnapshotsBySession([])).toEqual([]);
  });

  it("groups entries by sessionKeyHash", () => {
    const entries = [
      makeEntry({ sessionKeyHash: "hash-a", createdAt: 1000 }),
      makeEntry({ sessionKeyHash: "hash-b", createdAt: 2000 }),
      makeEntry({ sessionKeyHash: "hash-a", createdAt: 1500 }),
    ];
    const groups = groupSnapshotsBySession(entries);
    expect(groups).toHaveLength(2);
    const groupA = groups.find((g) => g.hash === "hash-a");
    expect(groupA?.entries).toHaveLength(2);
  });

  it("sorts entries within each group newest first", () => {
    const entries = [
      makeEntry({ sessionKeyHash: "hash-a", createdAt: 1000 }),
      makeEntry({ sessionKeyHash: "hash-a", createdAt: 3000 }),
      makeEntry({ sessionKeyHash: "hash-a", createdAt: 2000 }),
    ];
    const groups = groupSnapshotsBySession(entries);
    const [first, second, third] = groups[0].entries;
    expect(first.createdAt).toBe(3000);
    expect(second.createdAt).toBe(2000);
    expect(third.createdAt).toBe(1000);
  });

  it("sorts groups by most recent snapshot (newest group first)", () => {
    const entries = [
      makeEntry({ sessionKeyHash: "hash-old", createdAt: 500 }),
      makeEntry({ sessionKeyHash: "hash-new", createdAt: 9000 }),
    ];
    const groups = groupSnapshotsBySession(entries);
    expect(groups[0].hash).toBe("hash-new");
    expect(groups[1].hash).toBe("hash-old");
  });

  it("uses the sessionLabel from the first entry that has one", () => {
    const entries = [
      makeEntry({ sessionKeyHash: "hash-a", sessionLabel: null }),
      makeEntry({ sessionKeyHash: "hash-a", sessionLabel: "My Session" }),
    ];
    const groups = groupSnapshotsBySession(entries);
    expect(groups[0].label).toBe("My Session");
  });

  it("prefers sessionLabel from first entry if already set", () => {
    const entries = [
      makeEntry({ sessionKeyHash: "hash-a", sessionLabel: "First Label", createdAt: 1000 }),
      makeEntry({ sessionKeyHash: "hash-a", sessionLabel: "Second Label", createdAt: 2000 }),
    ];
    const groups = groupSnapshotsBySession(entries);
    // label is set from the first entry encountered (insertion order)
    expect(groups[0].label).toBe("First Label");
  });

  it("sets label to null when no entry has a label", () => {
    const entries = [
      makeEntry({ sessionKeyHash: "hash-a", sessionLabel: null }),
      makeEntry({ sessionKeyHash: "hash-a", sessionLabel: null }),
    ];
    const groups = groupSnapshotsBySession(entries);
    expect(groups[0].label).toBeNull();
  });
});
