import type { BackupReason, SnapshotEntry } from "./types";

/**
 * Groups a flat list of snapshot entries by session (`sessionKeyHash`).
 * Each group is sorted by `createdAt` descending (newest first).
 * The groups themselves are ordered by the most recent snapshot of each session (newest first).
 */
export interface SnapshotSession {
  hash: string;
  label: string | null;
  entries: SnapshotEntry[];
}

export function groupSnapshotsBySession(snapshots: SnapshotEntry[]): SnapshotSession[] {
  const map = new Map<string, SnapshotSession>();

  for (const entry of snapshots) {
    const existing = map.get(entry.sessionKeyHash);
    if (existing) {
      existing.entries.push(entry);
      // Update label if we have one and didn't before
      if (!existing.label && entry.sessionLabel) {
        existing.label = entry.sessionLabel;
      }
    } else {
      map.set(entry.sessionKeyHash, {
        hash: entry.sessionKeyHash,
        label: entry.sessionLabel,
        entries: [entry],
      });
    }
  }

  // Sort each group's entries newest first
  for (const group of map.values()) {
    group.entries.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Sort groups by the newest snapshot in each group
  return Array.from(map.values()).sort(
    (a, b) => (b.entries[0]?.createdAt ?? 0) - (a.entries[0]?.createdAt ?? 0),
  );
}

/**
 * Formats a compressed byte size into a human-readable string (KB / MB).
 */
export function formatSnapshotSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns a stable i18n key suffix for a `BackupReason`.
 * The caller is responsible for prepending the namespace, e.g. `t(\`backup.snapshots.reason\${key}\`)`.
 */
export function reasonI18nKey(reason: BackupReason): string {
  switch (reason) {
    case "scheduled":
      return "Scheduled";
    case "critical":
      return "Critical";
    case "manual":
      return "Manual";
    case "enabled":
      return "Enabled";
    case "before-unload":
      return "BeforeUnload";
    default:
      return "Scheduled";
  }
}

/**
 * Maps a `BackupReason` to the full i18n translation key for the reason label.
 */
export function reasonTranslationKey(reason: BackupReason): string {
  switch (reason) {
    case "scheduled":
      return "backup.snapshots.reasonScheduled";
    case "critical":
      return "backup.snapshots.reasonCritical";
    case "manual":
      return "backup.snapshots.reasonManual";
    case "enabled":
      return "backup.snapshots.reasonEnabled";
    case "before-unload":
      return "backup.snapshots.reasonBeforeUnload";
    default:
      return "backup.snapshots.reasonScheduled";
  }
}
