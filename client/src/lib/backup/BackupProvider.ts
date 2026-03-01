import type { BackupManifest, SnapshotEntry } from "./types";

/**
 * Abstraction over different backup storage backends.
 * Implementations: FileSystemProvider (Chrome/Edge), DownloadProvider (Firefox fallback).
 */
export interface BackupProvider {
  isSupported(): boolean;
  enable(): Promise<{ ok: true; locationLabel: string } | { ok: false; error: string }>;
  verifyAccess(): Promise<boolean>;
  writeSnapshot(entry: SnapshotEntry, data: Uint8Array): Promise<void>;
  writeManifest(manifest: BackupManifest): Promise<void>;
  readManifest(): Promise<BackupManifest | null>;
  hasSnapshot?(filename: string): Promise<boolean>;
  readSnapshot(filename: string): Promise<Uint8Array | null>;
  deleteSnapshots(filenames: string[]): Promise<void>;
}
