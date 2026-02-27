# Backup: beforeunload flag not checked on startup

**Type:** Bug / UX improvement
**Parent ticket:** [#0005 External Backup System](./0005-external-backup-system.md)
**Status:** Implemented

---

## Problem

The `BackupScheduler` sets a flag in `sessionStorage` on the `beforeunload` event to mark a crash or unexpected page close. However:

1. The flag is **not checked** on the next app start — no backup is triggered and the flag is silently ignored.
2. `sessionStorage` does not survive browser crashes or full closes — the flag is lost in the exact scenarios it is meant to protect against.

---

## Solution (Implemented)

### 1. localStorage flag with 24-hour expiry

Replaced `sessionStorage` with `localStorage` so the flag survives browser crashes and full closes. The flag stores a `Date.now()` timestamp instead of `"1"`, and is considered expired after 24 hours.

**Utility module:** `client/src/lib/backup/dirtyUnloadFlag.ts`

- `setDirtyUnloadFlag()` — writes timestamp to `localStorage` under key `flowscribe:dirty-unload`
- `readDirtyUnloadFlag()` — returns `{ present: true, age: number }` or `{ present: false }` (expired/missing flags return `false`)
- `clearDirtyUnloadFlag()` — removes the key
- Key name: `flowscribe:dirty-unload` (consistent everywhere)

### 2. BackupScheduler updated

- `beforeunload` handler now calls `setDirtyUnloadFlag()` instead of writing to `sessionStorage` directly
- Handler reference is stored so `stop()` can remove the event listener (fixes a listener leak bug)

### 3. Interactive DirtyUnloadBanner component

On startup, if the flag is present, a user-facing banner appears at the bottom of the editor (same position and styling as `RestoreBanner`). The banner is **interactive** rather than auto-triggering a backup, because:

- Auto-backup on startup cannot request File System Access permissions (requires user gesture)
- The user should be informed about what happened and given a choice
- Different backup states require different actions

**Three variants based on backup configuration state:**

| Variant | Condition | Action |
|---------|-----------|--------|
| **A — Backup available** | `backupConfig.enabled && backupState.status === "enabled"` | "Create safety backup" → calls `backupNow("before-unload")` |
| **B — Permission needed** | `backupConfig.enabled && backupState.status !== "enabled"` | "Re-authorize & backup" → calls `scheduler.reauthorize()` then `backupNow` |
| **C — No backup** | `!backupConfig.enabled` | "Enable backups" → opens Settings to backup section |

**State machine:** `hidden → showing → saving → success / error`

- **Success:** clears flag, auto-dismisses after 4 seconds
- **Error:** shows inline error, keeps dismiss button, does NOT clear flag (so banner reappears on next load)
- **Dismiss:** clears flag, hides banner immediately
- **Scheduler not available:** treated as error (prevents false success)

**Component:** `client/src/components/backup/DirtyUnloadBanner.tsx`
**Mounted in:** `client/src/components/transcript-editor/EditorDialogs.tsx` (after `RestoreBanner`)

---

## Affected Files

### New files
- `client/src/lib/backup/dirtyUnloadFlag.ts` — flag utility (set/read/clear with 24h expiry)
- `client/src/lib/backup/__tests__/dirtyUnloadFlag.test.ts` — 7 tests
- `client/src/components/backup/DirtyUnloadBanner.tsx` — banner component
- `client/src/components/backup/__tests__/DirtyUnloadBanner.test.tsx` — 14 tests

### Modified files
- `client/src/lib/backup/BackupScheduler.ts` — uses `setDirtyUnloadFlag()`, stores handler ref, cleans up in `stop()`, adds `reauthorize()` method
- `client/src/lib/backup/__tests__/BackupScheduler.test.ts` — 3 new beforeunload tests
- `client/src/components/transcript-editor/EditorDialogs.tsx` — mounts `DirtyUnloadBanner`
- `client/src/translations/en.json` — 11 keys under `backup.dirtyUnload.*`
- `client/src/translations/de.json` — 11 keys under `backup.dirtyUnload.*`

---

## Design Decisions

1. **Interactive banner over silent auto-backup:** Auto-backup cannot request FS permissions (requires user gesture), and users deserve to see what happened. The banner pattern is consistent with `RestoreBanner`.
2. **localStorage over sessionStorage:** `sessionStorage` is cleared on browser close/crash, defeating the purpose. `localStorage` with a timestamp and 24h TTL avoids stale flags accumulating.
3. **`scheduler.reauthorize()` over new provider instance:** `FileSystemProvider.getHandle()` caches the directory handle on the instance. Creating a new provider instance and calling `enable()` saves a new handle to IndexedDB but leaves the scheduler's cached handle unchanged — subsequent `backupNow()` calls would use the old revoked handle. `reauthorize()` calls `enable()` on the scheduler's own provider, updating the cached handle in place.
4. **No coordination with RestoreBanner:** Both banners render independently. The scenario where both appear simultaneously is extremely unlikely (requires dirty unload + restorable snapshot from a different session).
