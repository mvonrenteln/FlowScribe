import type { BackupProvider } from "../BackupProvider";
import {
  clearDirectoryHandle,
  loadDirectoryHandle,
  saveDirectoryHandle,
} from "../backupHandleStorage";
import type { BackupManifest, SnapshotEntry } from "../types";

// File System Access API type augmentations (not fully typed in TypeScript lib by default)
type DirectoryPickerOptions = { mode?: "read" | "readwrite" };
type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
};
type ExtendedWindow = Window & {
  showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
};
type ExtendedDirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (desc: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (desc: { mode: string }) => Promise<PermissionState>;
};

const getSubDirectory = async (
  parent: FileSystemDirectoryHandle,
  name: string,
  create = true,
): Promise<FileSystemDirectoryHandle> => {
  return parent.getDirectoryHandle(name, { create });
};

/**
 * Normalize legacy "global/…" snapshot paths to the canonical
 * "sessions/global/…" layout so that read/delete find the file
 * where writeSnapshot actually stored it.
 */
const normalizeSnapshotPath = (filename: string): string => {
  if (filename.startsWith("global/")) {
    return `sessions/${filename}`;
  }
  return filename;
};

/**
 * Validate that a snapshot path is safe (no directory traversal).
 * Accepts paths like "sessions/{hash}/{timestamp}_{reason}.json.gz"
 * and legacy "global/{timestamp}_{reason}.json.gz".
 */
export const isValidSnapshotPath = (filename: string): boolean => {
  if (!filename) return false;
  if (filename.includes("..")) return false;
  if (filename.startsWith("/") || filename.startsWith("\\")) return false;
  if (filename.includes("\\")) return false;

  const parts = filename.split("/");
  const safeSegmentPattern = /^[a-zA-Z0-9_.-]+$/;
  return parts.every((part) => safeSegmentPattern.test(part));
};

const writeFile = async (
  dir: FileSystemDirectoryHandle,
  filename: string,
  data: Uint8Array | string,
): Promise<void> => {
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await (
    fileHandle as FileSystemFileHandle & {
      createWritable: () => Promise<FileSystemWritableFileStream>;
    }
  ).createWritable();
  const writeData =
    typeof data === "string" ? new TextEncoder().encode(data) : (data as Uint8Array<ArrayBuffer>);
  await writable.write(writeData);
  await writable.close();
};

const readFile = async (
  dir: FileSystemDirectoryHandle,
  filename: string,
): Promise<Uint8Array | null> => {
  try {
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (_e) {
    return null;
  }
};

const deleteFile = async (dir: FileSystemDirectoryHandle, filename: string): Promise<void> => {
  try {
    await dir.removeEntry(filename);
  } catch (_e) {
    // ignore if already gone
  }
};

/**
 * Backup provider using the File System Access API (Chrome/Edge).
 */
export class FileSystemProvider implements BackupProvider {
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  /**
   * Create a provider from an already-obtained handle without persisting it.
   * Used for ad-hoc restore from an arbitrary folder.
   */
  static fromHandle(handle: FileSystemDirectoryHandle): FileSystemProvider {
    const provider = new FileSystemProvider();
    provider.directoryHandle = handle;
    return provider;
  }

  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof (window as ExtendedWindow).showDirectoryPicker === "function"
    );
  }

  async enable(): Promise<{ ok: true; locationLabel: string } | { ok: false; error: string }> {
    try {
      const picker = (window as ExtendedWindow).showDirectoryPicker;
      if (!picker) return { ok: false, error: "File System Access API not supported" };

      const handle = await picker({ mode: "readwrite" });
      const typedHandle = handle as ExtendedDirHandle;
      if (typedHandle.requestPermission) {
        const perm = await typedHandle.requestPermission({ mode: "readwrite" });
        if (perm !== "granted") {
          return { ok: false, error: "Permission denied" };
        }
      }
      await saveDirectoryHandle(handle);
      this.directoryHandle = handle;
      // Clean up any leftover tmp files from previous crash
      await this.cleanupTempFiles(handle);
      return { ok: true, locationLabel: handle.name };
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return { ok: false, error: "Cancelled" };
      }
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async verifyAccess(): Promise<boolean> {
    try {
      const handle = await this.getHandle();
      if (!handle) return false;
      const typedHandle = handle as ExtendedDirHandle;
      if (!typedHandle.queryPermission) return true;
      const perm = await typedHandle.queryPermission({ mode: "readwrite" });
      return perm === "granted";
    } catch (_e) {
      return false;
    }
  }

  async writeSnapshot(entry: SnapshotEntry, data: Uint8Array): Promise<void> {
    const dir = await this.requireHandle();
    const sessionsDir = await getSubDirectory(dir, "sessions");
    const sessionDir = await getSubDirectory(sessionsDir, entry.sessionKeyHash);

    // Use only the basename for the file within the session subdirectory
    const baseName = entry.filename.split("/").pop() ?? entry.filename;
    const tmpFilename = `.tmp_${baseName}`;

    // Write to tmp first (atomic-ish protection against crash mid-write)
    await writeFile(sessionDir, tmpFilename, data);
    // Write final file
    await writeFile(sessionDir, baseName, data);
    // Delete tmp
    await deleteFile(sessionDir, tmpFilename);
  }

  async writeManifest(manifest: BackupManifest): Promise<void> {
    const dir = await this.requireHandle();
    const json = JSON.stringify(manifest, null, 2);
    await writeFile(dir, "manifest.json", json);
  }

  async readManifest(): Promise<BackupManifest | null> {
    try {
      const dir = await this.requireHandle();
      const data = await readFile(dir, "manifest.json");
      if (!data) return null;
      const json = new TextDecoder().decode(data);
      return JSON.parse(json) as BackupManifest;
    } catch (_e) {
      return null;
    }
  }

  async readSnapshot(filename: string): Promise<Uint8Array | null> {
    try {
      const dir = await this.requireHandle();
      const normalized = normalizeSnapshotPath(filename);
      if (!isValidSnapshotPath(normalized)) return null;
      const parts = normalized.split("/");
      if (parts.length === 3 && parts[0] === "sessions") {
        const sessionsDir = await getSubDirectory(dir, "sessions", false);
        const sessionDir = await getSubDirectory(sessionsDir, parts[1], false);
        return readFile(sessionDir, parts[2]);
      }
      return readFile(dir, normalized);
    } catch (_e) {
      return null;
    }
  }

  async deleteSnapshots(filenames: string[]): Promise<void> {
    if (filenames.length === 0) return;
    try {
      const dir = await this.requireHandle();
      for (const fn of filenames) {
        const normalized = normalizeSnapshotPath(fn);
        if (!isValidSnapshotPath(normalized)) continue;
        const parts = normalized.split("/");
        if (parts.length === 3 && parts[0] === "sessions") {
          try {
            const sessionsDir = await getSubDirectory(dir, "sessions", false);
            const sessionDir = await getSubDirectory(sessionsDir, parts[1], false);
            await deleteFile(sessionDir, parts[2]);
          } catch (_e) {
            // ignore if dir doesn't exist
          }
        } else {
          await deleteFile(dir, normalized);
        }
      }
    } catch (_e) {
      // ignore errors during cleanup
    }
  }

  private async getHandle(): Promise<FileSystemDirectoryHandle | null> {
    if (this.directoryHandle) return this.directoryHandle;
    const handle = await loadDirectoryHandle();
    if (handle) this.directoryHandle = handle;
    return handle;
  }

  private async requireHandle(): Promise<FileSystemDirectoryHandle> {
    const handle = await this.getHandle();
    if (!handle) throw new Error("No backup directory configured");
    return handle;
  }

  private async cleanupTempFiles(dir: FileSystemDirectoryHandle): Promise<void> {
    try {
      const sessionsDir = await getSubDirectory(dir, "sessions", false);
      const iterableSessionsDir = sessionsDir as IterableDirectoryHandle;
      for await (const [, sessionHandle] of iterableSessionsDir.entries()) {
        if (sessionHandle.kind !== "directory") continue;
        const sessionDir = sessionHandle as IterableDirectoryHandle;
        for await (const [name] of sessionDir.entries()) {
          if (name.startsWith(".tmp_")) {
            await deleteFile(sessionHandle as FileSystemDirectoryHandle, name);
          }
        }
      }
    } catch (_e) {
      // sessions dir may not exist yet
    }
  }

  /**
   * Reset the stored handle (e.g., when user disables backup).
   */
  async reset(): Promise<void> {
    this.directoryHandle = null;
    await clearDirectoryHandle();
  }

  /**
   * Load handle from IDB on startup (so we don't need to call enable() again).
   */
  async initialize(): Promise<void> {
    const handle = await loadDirectoryHandle();
    if (handle) {
      this.directoryHandle = handle;
      await this.cleanupTempFiles(handle);
    }
  }
}
