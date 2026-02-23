import type { BackupManifest, SnapshotEntry } from "./types";

/**
 * Prune a backup manifest to stay within configured limits.
 *
 * - Groups session snapshots by sessionKeyHash, keeps newest N per session
 * - Keeps newest M global snapshots
 * - Returns the pruned manifest and filenames to physically delete
 */
export function pruneManifest(
  manifest: BackupManifest,
  maxPerSession: number,
  maxGlobal: number,
): { manifest: BackupManifest; toDelete: string[] } {
  const toDelete: string[] = [];

  // Prune session snapshots: group by sessionKeyHash, keep newest N
  const bySession = new Map<string, SnapshotEntry[]>();
  for (const entry of manifest.snapshots) {
    const group = bySession.get(entry.sessionKeyHash) ?? [];
    group.push(entry);
    bySession.set(entry.sessionKeyHash, group);
  }

  const keptSnapshots: SnapshotEntry[] = [];
  for (const [, entries] of bySession) {
    // Sort newest first (highest createdAt first)
    const sorted = entries.slice().sort((a, b) => b.createdAt - a.createdAt);
    const keep = sorted.slice(0, maxPerSession);
    const remove = sorted.slice(maxPerSession);
    keptSnapshots.push(...keep);
    toDelete.push(...remove.map((e) => e.filename));
  }

  // Prune global snapshots: keep newest M
  const sortedGlobal = manifest.globalSnapshots.slice().sort((a, b) => b.createdAt - a.createdAt);
  const keptGlobal = sortedGlobal.slice(0, maxGlobal);
  const removedGlobal = sortedGlobal.slice(maxGlobal);
  toDelete.push(...removedGlobal.map((e) => e.filename));

  return {
    manifest: {
      manifestVersion: 1,
      snapshots: keptSnapshots,
      globalSnapshots: keptGlobal,
    },
    toDelete,
  };
}
