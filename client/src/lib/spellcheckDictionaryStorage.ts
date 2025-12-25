import type { SpellcheckCustomDictionary } from "@/lib/store";

const DB_NAME = "flowscribe-spellcheck";
const STORE_NAME = "custom-dictionaries";
const DB_VERSION = 1;

const canUseIndexedDb = () =>
  typeof window !== "undefined" && typeof window.indexedDB !== "undefined";

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

export const loadSpellcheckDictionaries = async (): Promise<SpellcheckCustomDictionary[]> => {
  if (!canUseIndexedDb()) return [];
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as SpellcheckCustomDictionary[]);
  });
};

export const saveSpellcheckDictionary = async (
  dictionary: SpellcheckCustomDictionary,
): Promise<void> => {
  if (!canUseIndexedDb()) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(dictionary);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const removeSpellcheckDictionary = async (id: string): Promise<void> => {
  if (!canUseIndexedDb()) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};
