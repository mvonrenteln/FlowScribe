import type { BackupManifest, SnapshotEntry } from "./types";

/**
 * Abstraction over different backup storage backends.
 * Implementations: FileSystemProvider (Chrome/Edge), DownloadProvider (Firefox fallback).
 */
export interface BackupProvider {
  isSupported(): boolean;
  enable(): Promise<{ ok: true; locationLabel: string } | { ok: false; error: string }>;
  verifyAccess(): Promise<boolean>;
  /**
   * Re-request permission on an already stored handle without opening a picker.
   * Requires a user gesture. Returns true iff access is granted; false when
   * permission is denied or no handle is stored.
   */
  requestAccess?(): Promise<boolean>;
  writeSnapshot(entry: SnapshotEntry, data: Uint8Array): Promise<void>;
  writeManifest(manifest: BackupManifest): Promise<void>;
  readManifest(): Promise<BackupManifest | null>;
  hasSnapshot?(filename: string): Promise<boolean>;
  readSnapshot(filename: string): Promise<Uint8Array | null>;
  deleteSnapshots(filenames: string[]): Promise<void>;
}
