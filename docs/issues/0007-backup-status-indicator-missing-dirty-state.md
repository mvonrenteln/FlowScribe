# Backup: Toolbar indicator does not show dirty state

**Type:** Bug
**Oberticket:** [#0005 External Backup System](./0005-external-backup-system.md)

---


## Problem

The `BackupStatusIndicator` in the toolbar only knows three states: `enabled` (green), `paused` (amber), `error` (red). The spec also describes an **amber state for "dirty > X minutes"** to indicate that there are unsaved changes.

---


## Expected Behavior (Spec)

From the spec [#0005, section "Toolbar Status Indicator"]:

| State | Visual | Tooltip |
|-------|--------|---------|
| OK (last backup < 5 min) | green icon | "Last backup: 3 min ago" |
| **Working / dirty > 5 min** | **amber icon** | **"Backup scheduled…"** |
| Paused (permission lost) | amber icon | "Backups paused — click to re-authorize" |
| Error | red icon | "Backup error — see Settings" |

---


## Current State

In [`BackupStatusIndicator.tsx`](../../client/src/components/backup/BackupStatusIndicator.tsx):

```typescript
const getIcon = () => {
  switch (backupConfig.status) {
    case "enabled":  return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "paused":   return <PauseCircle  className="h-4 w-4 text-amber-500" />;
    case "error":    return <AlertCircle  className="h-4 w-4 text-destructive" />;
    default:         return <HardDrive   className="h-4 w-4 text-muted-foreground" />;
  }
};
```


The indicator only reads `backupConfig.status` from the store. There is no information about whether there are currently unsaved changes or when something was last changed.

---


## Desired Solution

The indicator should turn amber if:
- Backup is `enabled`
- There are unsaved changes (`dirty`)
- The last backup is older than the configured threshold (e.g. 5 minutes or half the configured interval)

**Option A**: `BackupScheduler` writes an `isDirty: boolean` flag to the store (`backupConfig` or a separate slice), which the indicator can read.

**Option B**: The indicator reads `backupConfig.lastBackupAt` and compares it to `Date.now()`. If the difference > threshold and backup is enabled, show amber.

Option B is simpler and does not require scheduler changes.

---

## Betroffene Dateien

- `client/src/components/backup/BackupStatusIndicator.tsx` — Icon-Logik erweitern
