const DB_NAME = "flowscribe-backup";
const STORE_NAME = "handles";
const HANDLE_KEY = "directory";

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
 * Persist the user-chosen backup directory handle in IndexedDB.
 */
export const saveDirectoryHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (_e) {
    // Non-critical in test/node environment where indexedDB is unavailable.
  }
};

/**
 * Load the stored backup directory handle from IndexedDB.
 * Returns null if not found or unavailable.
 */
export const loadDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    const db = await openDb();
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      request.onsuccess = () =>
        resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return handle;
  } catch (_e) {
    return null;
  }
};

/**
 * Remove the stored backup directory handle from IndexedDB.
 */
export const clearDirectoryHandle = async (): Promise<void> => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (_e) {
    // ignore
  }
};
