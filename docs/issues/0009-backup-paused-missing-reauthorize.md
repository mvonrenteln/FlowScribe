# Backup: Paused state has no "Re-authorize" button

**Type:** Bug
**Oberticket:** [#0005 External Backup System](./0005-external-backup-system.md)

---


## Problem

If the backup folder loses read permission after a browser restart (status = `"paused"`), the settings UI only shows a warning text, but no dedicated **"Re-authorize"** button. The user has to click "Change folder" and select the same folder again, which is unintuitive.

---


## Expected Behavior (Spec)

From the spec [#0005, section "Backup tab (paused — permission lost)"]:

```
┌─ Backup ──────────────────────────────────────────────────────────────┐
│                                                                       │
│  ⚠  Backups paused — browser permission was revoked                  │
│     [ Re-authorize ]                                                  │
│                                                                       │
│  Folder: ~/Documents/flowscribe-backup/                               │
│  Last successful backup: yesterday at 14:23                           │
│                                                                       │
│  [ Disable backups ]                                                  │
└───────────────────────────────────────────────────────────────────────┘
```


The "Re-authorize" button calls `requestPermission({ mode: "readwrite" })` on the stored handle — **without** requiring the user to select a folder again.

---


## Current State

In [`BackupSettings.tsx`](../../client/src/components/settings/sections/BackupSettings.tsx):

```tsx
{backupConfig.status === "paused" && (
  <div className="rounded-md bg-amber-50 ...">
    Backup folder is not accessible. Re-open your browser and grant permission,
    or choose a new folder.
  </div>
)}
```


No button — the user has to click "Change folder" and navigate again.

---


## Desired Solution


New handler `handleReauthorize`:

```typescript
const handleReauthorize = useCallback(async () => {
  const { FileSystemProvider } = await import("@/lib/backup/providers/FileSystemProvider");
  const provider = new FileSystemProvider();
  const granted = await provider.reauthorize(); // requestPermission auf gespeichertem Handle
  if (granted) {
    setBackupConfig({ status: "enabled", lastError: null });
    window.dispatchEvent(new CustomEvent("flowscribe:backup-critical"));
  } else {
    setBackupConfig({ status: "error", lastError: "Permission denied" });
  }
}, [setBackupConfig]);
```


`FileSystemProvider` needs a new method `reauthorize()`:
```typescript
async reauthorize(): Promise<boolean> {
  const handle = await this.getHandle();
  if (!handle) return false;
  const typedHandle = handle as ExtendedDirHandle;
  if (!typedHandle.requestPermission) return true;
  const perm = await typedHandle.requestPermission({ mode: "readwrite" });
  return perm === "granted";
}
```


In the paused state of the settings:
```tsx
{backupConfig.status === "paused" && (
  <div className="rounded-md bg-amber-50 ...">
    <p>⚠ Backups paused — browser permission was revoked</p>
    <Button onClick={handleReauthorize}>Re-authorize</Button>
  </div>
)}
```

---


## Affected Files

- `client/src/lib/backup/providers/FileSystemProvider.ts` — new method `reauthorize()`
- `client/src/lib/backup/BackupProvider.ts` — extend interface
- `client/src/components/settings/sections/BackupSettings.tsx` — handler + button
