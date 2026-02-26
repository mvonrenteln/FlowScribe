/**
 * Guard flag to suppress store-to-localStorage persistence writes.
 *
 * When a backup restore writes session data directly to localStorage,
 * the in-memory Zustand store still holds the OLD (pre-restore) data.
 * Without suppression, two mechanisms overwrite the restored data:
 *
 * 1. The persistence subscriber fires when any persisted state changes
 *    (e.g. `setBackupConfig`) and writes the stale sessions cache.
 * 2. The `beforeunload` handler fires during `window.location.reload()`
 *    and writes the stale sessions cache.
 *
 * Calling `suppressPersistence()` prevents both from writing until the
 * page reloads and the store reinitialises from the (now correct) localStorage.
 */
let suppressed = false;

export function suppressPersistence(): void {
  suppressed = true;
}

export function isPersistenceSuppressed(): boolean {
  return suppressed;
}
