# Backup: beforeunload flag not checked on startup

**Type:** Bug / UX Enhancement
**Parent issue:** [#0005 External Backup System](./0005-external-backup-system.md)

---


## Problem

The `BackupScheduler` sets a flag on the `beforeunload` event to mark that the page was closed with unsaved (dirty) backup state. However, this flag is **never checked** on the next app start — no recovery action is taken, no user notification is shown, and the flag is silently ignored.

---


## Usability Review (original approach rejected)

The original spec proposed silently calling `backupNow("before-unload")` on startup. A usability review identified three compounding problems with that approach:

### 1. Silent action — no user feedback

A silent `backupNow()` on startup means the user never learns that (a) their last session had unsaved data, (b) a recovery backup was attempted, or (c) whether that backup succeeded or failed. This violates every established crash-recovery UX pattern (VS Code, Google Docs, Figma all surface recovery state visibly).

### 2. File System Access API permission gap

After a browser restart, the File System Access API resets permission state to `"prompt"`. Calling `backupNow()` on startup (without a user gesture) fails silently because `verifyAccess()` returns `false`. The recovery backup cannot work in the most common scenario it targets.

### 3. `sessionStorage` does not survive actual crashes

`sessionStorage` is destroyed when the browser fully closes or crashes — the exact scenarios where recovery matters most. The flag only survives tab-close within a still-running browser, which is the least dangerous case.

| Scenario | `sessionStorage` survives? | Recovery needed? |
|---|---|---|
| Tab closed, reopened in same window | Yes | Maybe |
| Browser closed normally, reopened | **No** | Yes |
| Browser crash | **No** | **Yes** |
| OS crash / power loss | **No** | **Yes** |

### 4. No-backup-configured case silently drops data

The original proposal clears the flag unconditionally, even when backup is not configured. The only evidence that the previous session had unsaved data is discarded without any notification.

---


## Expected Behavior

On startup, if the dirty-unload flag is detected:

1. Show a **non-blocking banner** informing the user that their previous session was closed with pending edits.
2. Offer an explicit **"Create safety backup"** button (user gesture — solves the File System Access API permission problem).
3. Handle all edge cases with appropriate messaging (no backup configured, permission revoked, folder missing).
4. Show success/failure feedback inline in the banner.
5. Clear the flag only after the user has seen the notification (dismiss or backup completion).

This follows the same pattern as the existing [`RestoreBanner`](../../client/src/components/backup/RestoreBanner.tsx), which already handles a related but distinct scenario (empty localStorage + backup folder has snapshots).

---


## Current State

### Setting the flag (correctly implemented, wrong storage)

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

**Problems:**
- Uses `sessionStorage` (lost on browser/OS crash — see usability review above).
- Stores no timestamp (stale flags are indistinguishable from fresh ones).
- Key is `"flowscribe:backup-dirty"` but the original spec says `"flowscribe:dirty-unload"` — minor inconsistency.

### Checking on startup (missing)

In [`store.ts`](../../client/src/lib/store.ts), `initBackup()`:

```typescript
const initBackup = async () => {
  const fsProvider = new FileSystemProvider();
  await fsProvider.initialize();
  const provider = fsProvider.isSupported() ? fsProvider : new DownloadProvider();
  const scheduler = new BackupScheduler(provider);
  scheduler.start(useTranscriptStore);
  // No check for dirty-unload flag
};
```

---


## Desired Solution

### Part 1: Move dirty flag from `sessionStorage` to `localStorage` with timestamp

Standardize on the key `"flowscribe:dirty-unload"` and store a timestamp instead of `"1"`.

In `BackupScheduler.ts`:

```typescript
const DIRTY_UNLOAD_KEY = "flowscribe:dirty-unload";
const DIRTY_UNLOAD_MAX_AGE_MS = 24 * 60 * 60_000; // 24 hours

// In start():
window.addEventListener("beforeunload", () => {
  if (this.hasDirty()) {
    try {
      localStorage.setItem(DIRTY_UNLOAD_KEY, String(Date.now()));
    } catch (_e) { /* ignore */ }
  }
});
```

Remove the old `sessionStorage` key (`"flowscribe:backup-dirty"`) usage.

### Part 2: Read and validate the flag (utility function)

```typescript
export function readDirtyUnloadFlag(): { present: true; age: number } | { present: false } {
  try {
    const raw = localStorage.getItem(DIRTY_UNLOAD_KEY);
    if (!raw) return { present: false };
    const ts = Number(raw);
    if (Number.isNaN(ts)) return { present: false };
    const age = Date.now() - ts;
    if (age > DIRTY_UNLOAD_MAX_AGE_MS) {
      localStorage.removeItem(DIRTY_UNLOAD_KEY);
      return { present: false };
    }
    return { present: true, age };
  } catch {
    return { present: false };
  }
}

export function clearDirtyUnloadFlag(): void {
  try { localStorage.removeItem(DIRTY_UNLOAD_KEY); } catch { /* ignore */ }
}
```

### Part 3: `DirtyUnloadBanner` component

A new component following the same pattern as `RestoreBanner`. Shown on startup when the dirty flag is present. Three variants based on backup state:

**Variant A — Backup configured and accessible:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚠  Your last session was closed with unsaved edits.                │
│     [ Create safety backup ]  [ Dismiss ]                           │
└──────────────────────────────────────────────────────────────────────┘
```

On click: calls `backupNow("before-unload")` → shows inline spinner → replaces with success ("Safety backup saved") or error message. Clears flag on success or dismiss.

**Variant B — Backup configured but paused (permission revoked):**

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚠  Your last session was closed with unsaved edits.                │
│     Re-authorize your backup folder to create a safety backup.      │
│     [ Re-authorize & backup ]  [ Dismiss ]                          │
└──────────────────────────────────────────────────────────────────────┘
```

On click: calls `requestPermission()` (valid — this is a user gesture), then `backupNow("before-unload")`. Clears flag on success or dismiss.

**Variant C — Backup not configured:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚠  Your last session was closed with unsaved edits.                │
│     Browser storage should be intact. Enable backups for extra      │
│     safety.  [ Enable backups ]  [ Dismiss ]                        │
└──────────────────────────────────────────────────────────────────────┘
```

"Enable backups" opens Settings > Backup. Clears flag on dismiss.

---


## UX Flow

### Happy path (backup configured, permission retained)

1. User edits transcript, closes tab without waiting for backup interval
2. `beforeunload` fires → `localStorage.setItem("flowscribe:dirty-unload", timestamp)`
3. User reopens app (same browser session or later)
4. `DirtyUnloadBanner` mounts, reads flag, checks `backupConfig.enabled` and `backupState.status`
5. Banner appears: "Your last session was closed with unsaved edits." + **[Create safety backup]**
6. User clicks → `backupNow("before-unload")` runs (user gesture satisfies permission)
7. Banner shows spinner, then "Safety backup saved" with green checkmark
8. Banner auto-dismisses after 4 seconds, flag cleared

### Permission revoked path

Steps 1–4 same. At step 4, `backupState.status === "paused"`.

5. Banner appears with "Re-authorize & backup" button
6. User clicks → browser shows permission prompt → user grants
7. `backupNow("before-unload")` runs → success feedback → flag cleared
8. If user denies permission: banner shows error inline, dismiss button remains

### No backup configured path

Steps 1–4 same. At step 4, `backupConfig.enabled === false`.

5. Banner appears: "Browser storage should be intact. Enable backups for extra safety."
6. User clicks "Enable backups" → Settings opens to Backup tab
7. User clicks "Dismiss" → flag cleared, banner disappears

### Stale flag path

1. Flag exists in `localStorage` but is older than 24 hours
2. `readDirtyUnloadFlag()` returns `{ present: false }`, deletes stale flag
3. No banner shown

### Backup folder missing/deleted

1. Flag detected, backup configured, but `verifyAccess()` fails
2. Banner shows: "Your backup folder is no longer accessible." + **[Choose new folder]** + **[Dismiss]**

---


## Edge Cases

| Edge case | Behavior |
|---|---|
| Flag exists, backup `enabled`, folder accessible | Show banner with "Create safety backup" — do NOT auto-backup |
| Flag exists, backup `paused` (permission revoked) | Show banner with "Re-authorize & backup" |
| Flag exists, backup not configured | Show informational banner with "Enable backups" CTA |
| Flag older than 24 hours | Silently discard, no banner |
| Flag exists but `localStorage` has no segments (fresh state) | Still show banner — the flag indicates something happened |
| `DirtyUnloadBanner` and `RestoreBanner` both active | `RestoreBanner` takes priority (handles worse scenario — data loss). `DirtyUnloadBanner` yields if `RestoreBanner` is active |
| Multiple tabs: tab A sets flag, tab B reads it on load | Acceptable — the flag means "some tab had dirty data," which is still useful |
| `backupNow()` fails during banner flow | Show error inline in banner; keep dismiss button; do NOT clear the flag |
| Download provider (Firefox fallback) | Variant B behavior: offer a manual download action instead of filesystem backup |

---


## i18n Keys

Add to `en.json` and `de.json` under `backup.dirtyUnload`:

```
backup.dirtyUnload.title
backup.dirtyUnload.descriptionBackupAvailable
backup.dirtyUnload.descriptionPermissionNeeded
backup.dirtyUnload.descriptionNoBackup
backup.dirtyUnload.descriptionFolderMissing
backup.dirtyUnload.createBackupButton
backup.dirtyUnload.reauthorizeButton
backup.dirtyUnload.enableBackupsButton
backup.dirtyUnload.chooseFolderButton
backup.dirtyUnload.dismissButton
backup.dirtyUnload.savingMessage
backup.dirtyUnload.successMessage
backup.dirtyUnload.errorMessage
```

---


## Affected Files

| File | Change |
|---|---|
| `client/src/lib/backup/BackupScheduler.ts` | Move flag from `sessionStorage` to `localStorage` with timestamp; export `DIRTY_UNLOAD_KEY` constant; export `readDirtyUnloadFlag()` and `clearDirtyUnloadFlag()` utilities |
| `client/src/components/backup/DirtyUnloadBanner.tsx` | **New file** — banner component with three variants |
| `client/src/components/transcript-editor/EditorDialogs.tsx` | Mount `DirtyUnloadBanner` (alongside existing `RestoreBanner`) |
| `client/src/translations/en.json` | Add `backup.dirtyUnload.*` keys |
| `client/src/translations/de.json` | Add `backup.dirtyUnload.*` keys |
| `client/src/lib/backup/__tests__/BackupScheduler.test.ts` | Test `readDirtyUnloadFlag`, `clearDirtyUnloadFlag`, timestamp expiry |
| `client/src/components/backup/__tests__/DirtyUnloadBanner.test.tsx` | Test all three banner variants, success/error flows, interaction with RestoreBanner |
