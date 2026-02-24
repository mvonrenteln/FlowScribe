import type { PersistedGlobalState, PersistedSession } from "@/lib/store/types";

export type BackupProviderType = "filesystem" | "download";
export type BackupStatus = "disabled" | "enabled" | "paused" | "error";
export type BackupReason = "scheduled" | "critical" | "manual" | "enabled" | "before-unload";

export interface BackupConfig {
  providerType: BackupProviderType;
  enabled: boolean;
  includeGlobalState: boolean;
  locationLabel: string | null;
  lastBackupAt: number | null;
  lastError: string | null;
  status: BackupStatus;
  maxSnapshotsPerSession: number;
  maxGlobalSnapshots: number;
  disableDirtyReminders: boolean;
  /** Minimum minutes between automatic backups (hard interval). Default: 20. Range: 5–60. */
  backupIntervalMinutes: number;
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  providerType: "filesystem",
  enabled: false,
  includeGlobalState: true,
  locationLabel: null,
  lastBackupAt: null,
  lastError: null,
  status: "disabled",
  maxSnapshotsPerSession: 50,
  maxGlobalSnapshots: 20,
  disableDirtyReminders: false,
  backupIntervalMinutes: 20,
};

export interface SnapshotEntry {
  filename: string;
  sessionKeyHash: string;
  sessionLabel: string | null;
  createdAt: number;
  reason: BackupReason;
  appVersion: string;
  schemaVersion: number;
  compressedSize: number;
  checksum: string;
}

export interface BackupManifest {
  manifestVersion: 1;
  snapshots: SnapshotEntry[];
  globalSnapshots: SnapshotEntry[];
}

export const EMPTY_MANIFEST: BackupManifest = {
  manifestVersion: 1,
  snapshots: [],
  globalSnapshots: [],
};

export interface SessionSnapshot {
  schemaVersion: number;
  appVersion: string;
  createdAt: number;
  sessionKey: string;
  reason: BackupReason;
  checksum: string;
  session: PersistedSession;
  globalState?: PersistedGlobalState;
}

export const SCHEMA_VERSION = 1;
export const APP_VERSION = "1.0.0";
