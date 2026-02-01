import type { FileReference } from "./fileReference";

const DB_NAME = "flowscribe";
const STORE_NAME = "audio-handles";

/**
 * Create a unique key for an audio file reference.
 * This allows multiple sessions with the same audio file to share the same handle.
 */
export const buildAudioRefKey = (audioRef: FileReference): string => {
  return JSON.stringify({
    name: audioRef.name,
    size: audioRef.size,
    lastModified: audioRef.lastModified,
  });
};

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new ReferenceError("indexedDB is not available in this environment"));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/**
 * Save an audio handle for a specific audio file reference.
 * Multiple sessions with the same audio file will share the same handle.
 * @param audioRefKey - A unique key for the audio reference (JSON stringified)
 * @param handle - The FileSystemFileHandle to save
 */
export const saveAudioHandleForAudioRef = async (
  audioRefKey: string,
  handle: FileSystemFileHandle,
): Promise<void> => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(handle, audioRefKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    try {
      globalThis.window?.dispatchEvent?.(
        new CustomEvent("flowscribe:audio-handle-updated", {
          detail: { audioRefKey, present: true },
        }),
      );
    } catch (_e) {
      // ignore
    }
  } catch (_e) {
    // Non-critical in test/node environment where indexedDB is unavailable.
    return;
  }
};

/**
 * Load an audio handle for a specific audio file reference.
 * @param audioRefKey - A unique key for the audio reference
 * @returns The FileSystemFileHandle if found, null otherwise
 */
export const loadAudioHandleForAudioRef = async (
  audioRefKey: string,
): Promise<FileSystemFileHandle | null> => {
  try {
    const db = await openDb();
    const handle = await new Promise<FileSystemFileHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(audioRefKey);
      request.onsuccess = () => resolve((request.result as FileSystemFileHandle) ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return handle;
  } catch (_e) {
    return null;
  }
};

/**
 * Clear the audio handle for a specific audio file reference.
 * @param audioRefKey - The audio reference key to clear the handle for
 */
export const clearAudioHandleForAudioRef = async (audioRefKey: string): Promise<void> => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(audioRefKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    try {
      globalThis.window?.dispatchEvent?.(
        new CustomEvent("flowscribe:audio-handle-updated", {
          detail: { audioRefKey, present: false },
        }),
      );
    } catch (_e) {
      // ignore
    }
  } catch (_e) {
    return;
  }
};

/**
 * Get all session keys that have audio handles stored.
 * Useful for debugging and cleanup operations.
 * @returns Array of session keys that have handles stored
 */
export const getAllAudioHandleKeys = async (): Promise<string[]> => {
  try {
    const db = await openDb();
    const keys = await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAllKeys();
      request.onsuccess = () => resolve((request.result as string[]) ?? []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return keys;
  } catch (_e) {
    return [];
  }
};

export const queryAudioHandlePermission = async (
  handle: FileSystemFileHandle,
): Promise<boolean> => {
  type PermissionDescriptor = { mode: "read" | "readwrite" };
  const permissionHandle = handle as FileSystemFileHandle & {
    queryPermission?: (descriptor: PermissionDescriptor) => Promise<PermissionState>;
  };
  if (!permissionHandle.queryPermission) return true;
  const result = await permissionHandle.queryPermission({ mode: "read" });
  return result === "granted";
};

export const requestAudioHandlePermission = async (
  handle: FileSystemFileHandle,
): Promise<boolean> => {
  type PermissionDescriptor = { mode: "read" | "readwrite" };
  const permissionHandle = handle as FileSystemFileHandle & {
    requestPermission?: (descriptor: PermissionDescriptor) => Promise<PermissionState>;
  };
  if (!permissionHandle.requestPermission) return true;
  const result = await permissionHandle.requestPermission({ mode: "read" });
  return result === "granted";
};
