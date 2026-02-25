# Backup: beforeunload flag is not checked on startup

**Type:** Bug
**Oberticket:** [#0005 External Backup System](./0005-external-backup-system.md)

---


## Problem

The `BackupScheduler` sets a flag in `sessionStorage` on the `beforeunload` event to mark a crash or unexpected page close. However, this flag is **not checked** on the next app start — no immediate backup is triggered, and the flag remains or is ignored.

---


## Expected Behavior (Spec)

From the spec [#0005, section "beforeunload handling"]:

> 1. In `beforeunload`: `sessionStorage.setItem("flowscribe:dirty-unload", "1")`
> 2. On next startup: if the flag is present and a backup folder is configured, run `backupNow("before-unload")` before clearing the flag.

---


## Current State

### Setting (correctly implemented)

In [`BackupScheduler.ts`](../../client/src/lib/backup/BackupScheduler.ts), `start()`:

```typescript
window.addEventListener("beforeunload", () => {
  if (this.hasDirty()) {
    try {
      sessionStorage.setItem("flowscribe:backup-dirty", "1");
    } catch (_e) { /* ignore */ }
  }
});
```


**Note**: The key is `"flowscribe:backup-dirty"` — the spec says `"flowscribe:dirty-unload"`. Minor inconsistency.


### Checking on startup (missing)

In [`store.ts`](../../client/src/lib/store.ts), `initBackup()`:

```typescript
const initBackup = async () => {
  const fsProvider = new FileSystemProvider();
  await fsProvider.initialize();
  const provider = fsProvider.isSupported() ? fsProvider : new DownloadProvider();
  const scheduler = new BackupScheduler(provider);
  scheduler.start(useTranscriptStore);
  // ❌ Kein Check auf sessionStorage-Flag!
};
```


The flag is not checked on startup, and `backupNow("before-unload")` is never called.

---


## Desired Solution

In `initBackup()` nach `scheduler.start()`:

```typescript
const DIRTY_UNLOAD_KEY = "flowscribe:backup-dirty"; // konsistent mit Scheduler

const wasDirtyOnUnload = (() => {
  try { return !!sessionStorage.getItem(DIRTY_UNLOAD_KEY); }
  catch { return false; }
})();

if (wasDirtyOnUnload) {
  try { sessionStorage.removeItem(DIRTY_UNLOAD_KEY); } catch { /* ignore */ }
  const state = useTranscriptStore.getState();
  if (state.backupConfig.enabled) {
    void scheduler.backupNow("before-unload");
  }
}
```


Alternatively, encapsulate in `BackupScheduler.checkDirtyUnload()` and call from `start()`.

**Key consistency**: Decide on either `"flowscribe:backup-dirty"` or `"flowscribe:dirty-unload"` — update both places.

---


## Affected Files

- `client/src/lib/store.ts` — extend `initBackup()` with flag check
- `client/src/lib/backup/BackupScheduler.ts` — optional: `checkDirtyUnload()` method + key constant
