import type { BackupProvider } from "../BackupProvider";
import type { BackupManifest, SnapshotEntry } from "../types";

/**
 * Fallback backup provider for browsers without File System Access API (e.g. Firefox).
 * Queues snapshots and triggers browser downloads on demand.
 */
export class DownloadProvider implements BackupProvider {
  private pendingDownloads: Array<{ entry: SnapshotEntry; data: Uint8Array }> = [];

  isSupported(): boolean {
    return true;
  }

  async enable(): Promise<{ ok: true; locationLabel: string } | { ok: false; error: string }> {
    return { ok: true, locationLabel: "Downloads" };
  }

  async verifyAccess(): Promise<boolean> {
    return true;
  }

  async writeSnapshot(entry: SnapshotEntry, data: Uint8Array): Promise<void> {
    this.pendingDownloads.push({ entry, data });
  }

  async writeManifest(_manifest: BackupManifest): Promise<void> {
    // no-op for download provider
  }

  async readManifest(): Promise<BackupManifest | null> {
    return null;
  }

  async hasSnapshot(_filename: string): Promise<boolean> {
    return false;
  }

  async readSnapshot(_filename: string): Promise<Uint8Array | null> {
    return null;
  }

  async deleteSnapshots(_filenames: string[]): Promise<void> {
    // no-op
  }

  /**
   * Trigger a browser download for the pending snapshot.
   */
  triggerDownload(): void {
    if (this.pendingDownloads.length === 0) return;

    const queue = this.pendingDownloads;
    this.pendingDownloads = [];

    const startDownload = (entry: SnapshotEntry, data: Uint8Array): void => {
      const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/gzip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = entry.filename.split("/").pop() ?? entry.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    if (queue.length === 1) {
      const { entry, data } = queue[0];
      startDownload(entry, data);
      return;
    }

    for (let i = 0; i < queue.length; i += 1) {
      const { entry, data } = queue[i];
      setTimeout(() => {
        startDownload(entry, data);
      }, i * 50);
    }
  }

  hasPendingDownload(): boolean {
    return this.pendingDownloads.length > 0;
  }
}
