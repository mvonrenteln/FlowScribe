const DB_NAME = "flowscribe";
const STORE_NAME = "audio-handles";
const HANDLE_KEY = "latest";

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

export const saveAudioHandle = async (handle: FileSystemFileHandle): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};

export const loadAudioHandle = async (): Promise<FileSystemFileHandle | null> => {
  const db = await openDb();
  const handle = await new Promise<FileSystemFileHandle | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    request.onsuccess = () => resolve((request.result as FileSystemFileHandle) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return handle;
};

export const clearAudioHandle = async (): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
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
